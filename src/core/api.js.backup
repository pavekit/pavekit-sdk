/**
 * APIClient - Handles all communication with the PaveKit backend
 * Provides methods for signup registration, activity tracking, and conversion events
 */
class APIClient {
  constructor() {
    this.baseURL = "http://localhost:8000"; // Default for development
    this.apiKey = null;
    this.timeout = 5000; // 5 second timeout
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Initialize the API client with configuration
   * @param {Object} config - Configuration object
   * @param {string} config.apiKey - API key for authentication
   * @param {string} config.baseURL - Base URL for API endpoints
   * @param {number} config.timeout - Request timeout in milliseconds
   */
  init(config) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || this.baseURL;
    this.timeout = config.timeout || this.timeout;

    if (config.debug) {
      console.log("APIClient initialized:", {
        baseURL: this.baseURL,
        hasApiKey: !!this.apiKey,
      });
    }
  }

  /**
   * Make an HTTP request with retry logic
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Promise} Response promise
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}/api/onboarding/sdk${endpoint}`;

    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        ...options.headers,
      },
      ...options,
    };

    // Add timeout using AbortController
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

        // Handle HTTP errors
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error;

        // Don't retry on certain errors
        if (
          error.name === "AbortError" ||
          (error.message && error.message.includes("401"))
        ) {
          throw error;
        }

        // Wait before retrying (except on last attempt)
        if (attempt < this.retryAttempts) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    throw lastError;
  }

  /**
   * Register a user signup event
   * @param {Object} data - Signup data
   * @param {string} data.email - User email address
   * @param {string} data.signup_method - Signup method ('form', 'oauth_google', 'oauth_github')
   * @param {string} data.page_url - URL where signup occurred
   * @param {string} data.referrer - Referrer URL
   * @param {Object} data.metadata - Additional metadata
   * @returns {Promise} API response
   */
  async registerSignup(data) {
    if (!this.apiKey) {
      throw new Error("API key not configured");
    }

    if (!data.email) {
      throw new Error("Email is required for signup registration");
    }

    const payload = {
      email: data.email,
      signup_method: data.signup_method || "form",
      page_url: data.page_url || window.location.href,
      referrer: data.referrer || document.referrer,
      user_agent: navigator.userAgent,
      metadata: data.metadata || {},
    };

    console.log("APIClient: Registering signup with payload:", payload);
    console.log(
      "APIClient: JSON stringified payload:",
      JSON.stringify(payload),
    );

    try {
      const result = await this.makeRequest("/signup", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      console.log("APIClient: Signup registered successfully:", result);
      return result;
    } catch (error) {
      console.error("Failed to register signup:", error);
      console.error("APIClient: Payload that failed:", payload);
      throw error;
    }
  }

  /**
   * Track user activity (heartbeat)
   * @param {Object} data - Activity data
   * @param {string} data.email - User email address
   * @param {string} data.page_url - Current page URL
   * @returns {Promise} API response
   */
  async trackActivity(data) {
    if (!this.apiKey || !data.email) {
      return; // Silently fail for activity tracking
    }

    const payload = {
      email: data.email,
      page_url: data.page_url || window.location.href,
      timestamp: new Date().toISOString(),
    };

    try {
      return await this.makeRequest("/activity", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (error) {
      // Don't throw errors for activity tracking
      console.warn("Failed to track activity:", error.message);
    }
  }

  /**
   * Update user information
   * @param {Object} data - User data to update
   * @param {string} data.email - User email address (required to identify user)
   * @param {string} data.name - User's display name
   * @returns {Promise} API response
   */
  async updateUser(data) {
    if (!this.apiKey) {
      throw new Error("API key not configured");
    }

    if (!data.email) {
      throw new Error("Email is required to update user info");
    }

    const payload = {
      email: data.email,
      name: data.name || "",
    };

    try {
      return await this.makeRequest("/user-info", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("Failed to update user info:", error);
      throw error;
    }
  }

  /**
   * Track conversion event
   * @param {Object} data - Conversion data
   * @param {string} data.email - User email address
   * @param {string} data.conversion_type - Type of conversion ('purchase', 'upgrade', 'subscribe')
   * @param {number} data.value - Conversion value
   * @param {string} data.currency - Currency code
   * @param {Object} data.metadata - Additional metadata
   * @returns {Promise} API response
   */
  async trackConversion(data) {
    if (!this.apiKey) {
      throw new Error("API key not configured");
    }

    if (!data.email) {
      throw new Error("Email is required for conversion tracking");
    }

    const payload = {
      email: data.email,
      conversion_type: data.conversion_type || "purchase",
      value: data.value || 0,
      currency: data.currency || "USD",
      metadata: data.metadata || {},
    };

    try {
      return await this.makeRequest("/conversion", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("Failed to track conversion:", error);
      throw error;
    }
  }

  /**
   * Validate API key with the backend
   * @returns {Promise} Validation response
   */
  async validateAPIKey() {
    if (!this.apiKey) {
      throw new Error("API key not configured");
    }

    try {
      return await this.makeRequest("/validate", {
        method: "GET",
      });
    } catch (error) {
      console.error("API key validation failed:", error);
      throw error;
    }
  }

  /**
   * Send a batch of events (for offline support)
   * @param {Array} events - Array of events to send
   * @returns {Promise} Batch response
   */
  async sendBatch(events) {
    if (!this.apiKey || !events || events.length === 0) {
      return;
    }

    const payload = {
      events: events,
      batch_timestamp: new Date().toISOString(),
    };

    try {
      return await this.makeRequest("/batch", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("Failed to send batch:", error);
      throw error;
    }
  }

  /**
   * Get API configuration from backend
   * @returns {Promise} Configuration response
   */
  async getConfig() {
    if (!this.apiKey) {
      throw new Error("API key not configured");
    }

    try {
      return await this.makeRequest("/config", {
        method: "GET",
      });
    } catch (error) {
      console.warn("Failed to get config:", error);
      return {}; // Return empty config on failure
    }
  }

  /**
   * Test connection to the API
   * @returns {Promise<boolean>} True if connection successful
   */
  async testConnection() {
    try {
      await this.validateAPIKey();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Delay execution for specified milliseconds
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current API client status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: !!this.apiKey,
      baseURL: this.baseURL,
      hasConnection: true, // Would be set by periodic health checks
      lastError: null,
    };
  }

  /**
   * Update configuration
   * @param {Object} config - New configuration
   */
  updateConfig(config) {
    if (config.baseURL) this.baseURL = config.baseURL;
    if (config.timeout) this.timeout = config.timeout;
    if (config.retryAttempts) this.retryAttempts = config.retryAttempts;
    if (config.retryDelay) this.retryDelay = config.retryDelay;
  }

  /**
   * Reset API client to initial state
   */
  reset() {
    this.apiKey = null;
    this.baseURL = "http://localhost:8000";
    this.timeout = 5000;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
  }
}

export default APIClient;
