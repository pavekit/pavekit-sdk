/**
 * PaveKit Backend SDK - API Client
 * Version 1.1.0 - Backend-only SDK for server-side user tracking
 * 
 * This SDK is designed for backend/server-side use only.
 * Use it in your Node.js, Express, Next.js API routes, or other backend services.
 */

class PaveKitAPI {
  constructor() {
    this.baseURL = "http://localhost:8000";
    this.apiKey = null;
    this.timeout = 10000; // 10 second timeout for backend
    this.retryAttempts = 3;
    this.retryDelay = 1000;
    this.userId = null;
  }

  /**
   * Initialize the API client
   * @param {Object} config - Configuration
   * @param {string} config.apiKey - Your PaveKit API key (required)
   * @param {string} config.baseURL - API endpoint URL
   * @param {number} config.timeout - Request timeout in milliseconds
   */
  init(config) {
    if (!config.apiKey) {
      throw new Error("API key is required");
    }

    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || this.baseURL;
    this.timeout = config.timeout || this.timeout;

    if (config.debug) {
      console.log("[PaveKit] Initialized:", {
        baseURL: this.baseURL,
        hasApiKey: !!this.apiKey,
      });
    }
  }

  /**
   * Make HTTP request with retry logic
   * @private
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}/api${endpoint}`;

    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        ...options.headers,
      },
      ...options,
    };

    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    requestOptions.signal = controller.signal;

    let lastError = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, requestOptions);
        clearTimeout(timeoutId);

        if (response.ok) {
          return await response.json();
        }

        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error;

        // Don't retry on auth errors
        if (error.message && error.message.includes("401")) {
          throw error;
        }

        // Wait before retrying
        if (attempt < this.retryAttempts) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    throw lastError;
  }

  /**
   * Track user activity (unified method)
   * 
   * @param {Object} data - Activity data
   * @param {string} data.email - User email (required)
   * @param {string} [data.name] - User's full name
   * @param {Object} [data.metadata] - Custom metadata object
   * @param {boolean} [data.conversion_status=false] - Whether user has converted
   * @returns {Promise<Object>} Response with user_id
   * 
   * @example
   * // Track new user signup
   * await client.track({
   *   email: 'user@example.com',
   *   name: 'John Doe',
   *   metadata: {
   *     signup_source: 'api',
   *     plan: 'premium'
   *   }
   * });
   * 
   * @example
   * // Mark user as converted
   * await client.track({
   *   email: 'user@example.com',
   *   conversion_status: true,
   *   metadata: {
   *     plan: 'enterprise',
   *     value: 999
   *   }
   * });
   */
  async track(data) {
    if (!this.apiKey) {
      throw new Error("API key not configured. Call init() first.");
    }

    if (!data.email) {
      throw new Error("Email is required");
    }

    const payload = {
      email: data.email,
      name: data.name || undefined,
      metadata: data.metadata || undefined,
      conversion_status: data.conversion_status || false,
      user_id: this.userId || undefined,
    };

    // Remove undefined values
    Object.keys(payload).forEach(
      (key) => payload[key] === undefined && delete payload[key],
    );

    try {
      const result = await this.makeRequest("/v1/activity", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // Store user_id for future requests
      if (result.user_id) {
        this.userId = result.user_id;
      }

      return result;
    } catch (error) {
      console.error("[PaveKit] Track failed:", error.message);
      throw error;
    }
  }

  /**
   * Validate API key
   * @returns {Promise<Object>} Validation response
   */
  async validate() {
    if (!this.apiKey) {
      throw new Error("API key not configured");
    }

    try {
      return await this.makeRequest("/v1/validate", {
        method: "GET",
      });
    } catch (error) {
      console.error("[PaveKit] Validation failed:", error.message);
      throw error;
    }
  }

  /**
   * Get current client status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: !!this.apiKey,
      baseURL: this.baseURL,
      userId: this.userId,
      connected: true,
    };
  }

  /**
   * Delay helper for retries
   * @private
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Reset client state
   */
  reset() {
    this.apiKey = null;
    this.baseURL = "http://localhost:8000";
    this.timeout = 10000;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
    this.userId = null;
  }
}

// Export for CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PaveKitAPI;
}

