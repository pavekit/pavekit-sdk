/**
 * OAuthDetector - Detects OAuth authentication flows and signup completions
 * Securely identifies OAuth returns without accessing sensitive tokens
 */
class OAuthDetector {
  constructor(securityUtils, apiClient, privacyManager) {
    this.securityUtils = securityUtils;
    this.apiClient = apiClient;
    this.privacyManager = privacyManager;
    this.isActive = false;
    this.config = {
      checkInterval: 1000, // Check every second
      maxChecks: 30, // Stop checking after 30 seconds
      cleanupDelay: 5000, // Clean URL parameters after 5 seconds
      supportedProviders: [
        "google",
        "github",
        "microsoft",
        "facebook",
        "twitter",
      ],
    };
    this.checkCount = 0;
    this.intervalId = null;
    this.detectedFlows = new Set();
  }

  /**
   * Start OAuth flow detection
   * @param {Object} config - Detection configuration
   */
  start(config = {}) {
    if (this.isActive) return;

    this.config = { ...this.config, ...config };
    this.isActive = true;
    this.checkCount = 0;

    // Check immediately on start
    this.checkForOAuthReturn();

    // Set up periodic checking
    this.intervalId = setInterval(() => {
      this.checkForOAuthReturn();
      this.checkCount++;

      // Stop checking after max attempts
      if (this.checkCount >= this.config.maxChecks) {
        this.stopPeriodicChecking();
      }
    }, this.config.checkInterval);

    // Listen for URL changes (SPA navigation)
    this.attachURLChangeListener();

    console.log("OAuthDetector: Started");
  }

  /**
   * Stop OAuth flow detection
   */
  stop() {
    if (!this.isActive) return;

    this.isActive = false;
    this.stopPeriodicChecking();
    this.detachURLChangeListener();
    this.detectedFlows.clear();

    console.log("OAuthDetector: Stopped");
  }

  /**
   * Stop periodic checking
   */
  stopPeriodicChecking() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Attach URL change listener for SPAs
   */
  attachURLChangeListener() {
    this.originalPushState = history.pushState;
    this.originalReplaceState = history.replaceState;

    const self = this;

    history.pushState = function () {
      self.originalPushState.apply(history, arguments);
      setTimeout(() => self.checkForOAuthReturn(), 100);
    };

    history.replaceState = function () {
      self.originalReplaceState.apply(history, arguments);
      setTimeout(() => self.checkForOAuthReturn(), 100);
    };

    window.addEventListener("popstate", () => {
      setTimeout(() => this.checkForOAuthReturn(), 100);
    });
  }

  /**
   * Detach URL change listener
   */
  detachURLChangeListener() {
    if (this.originalPushState) {
      history.pushState = this.originalPushState;
    }
    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
    }
  }

  /**
   * Check for OAuth return indicators in current URL
   */
  async checkForOAuthReturn() {
    if (!this.isActive) {
      console.log("OAuthDetector: Not active, skipping check");
      return;
    }

    if (!this.privacyManager.hasConsent()) {
      console.log("OAuthDetector: No consent granted, skipping check");
      return;
    }

    console.log(
      "OAuthDetector: Checking for OAuth return in URL:",
      window.location.href,
    );

    const currentURL = window.location.href;
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));

    // Prevent processing the same OAuth return multiple times
    const flowId = this.generateFlowId(currentURL);
    if (this.detectedFlows.has(flowId)) return;

    const oauthData = this.detectOAuthFlow(urlParams, hashParams);

    console.log("OAuthDetector: Detection result:", oauthData);

    if (oauthData.isOAuthReturn) {
      console.log("OAuthDetector: Valid OAuth return detected, processing...");
      this.detectedFlows.add(flowId);
      await this.processOAuthReturn(oauthData);

      // Schedule URL cleanup
      setTimeout(() => {
        this.cleanOAuthParams();
      }, this.config.cleanupDelay);
    }
  }

  /**
   * Generate unique flow ID for deduplication
   * @param {string} url - Current URL
   * @returns {string} Unique flow identifier
   */
  generateFlowId(url) {
    const urlWithoutTokens = url
      .replace(/[?&](code|access_token|id_token)=[^&]*/g, "")
      .replace(/[?&](state|scope)=[^&]*/g, "");

    return `${urlWithoutTokens}_${Date.now()}`;
  }

  /**
   * Detect OAuth flow from URL parameters
   * @param {URLSearchParams} urlParams - URL search parameters
   * @param {URLSearchParams} hashParams - URL hash parameters
   * @returns {Object} OAuth detection result
   */
  detectOAuthFlow(urlParams, hashParams) {
    const result = {
      isOAuthReturn: false,
      provider: null,
      flowType: null,
      hasError: false,
      errorDescription: null,
      state: null,
    };

    // Check for OAuth authorization code (server-side flow)
    const authCode = urlParams.get("code");
    if (authCode) {
      result.isOAuthReturn = true;
      result.flowType = "authorization_code";
      result.state = urlParams.get("state");
    }

    // Check for OAuth implicit flow tokens (client-side flow)
    const accessToken =
      hashParams.get("access_token") || urlParams.get("access_token");
    const idToken = hashParams.get("id_token") || urlParams.get("id_token");

    if (accessToken || idToken) {
      result.isOAuthReturn = true;
      result.flowType = "implicit";
      result.state = hashParams.get("state") || urlParams.get("state");
    }

    // Check for OAuth errors
    const error = urlParams.get("error") || hashParams.get("error");
    if (error) {
      result.isOAuthReturn = true;
      result.hasError = true;
      result.errorDescription =
        urlParams.get("error_description") ||
        hashParams.get("error_description");
    }

    // Detect provider from referrer or URL patterns
    if (result.isOAuthReturn) {
      result.provider = this.detectOAuthProvider();
    }

    // Additional validation
    if (result.isOAuthReturn) {
      result.isOAuthReturn = this.validateOAuthReturn();
      console.log("OAuthDetector: Validation result:", result.isOAuthReturn);
    }

    return result;
  }

  /**
   * Detect OAuth provider from referrer and URL patterns
   * @returns {string|null} OAuth provider name
   */
  detectOAuthProvider() {
    const referrer = document.referrer.toLowerCase();
    const currentURL = window.location.href.toLowerCase();

    // Provider detection patterns
    const providers = {
      google: ["accounts.google.com", "googleapis.com", "google.com/oauth"],
      github: ["github.com", "api.github.com"],
      microsoft: ["login.microsoftonline.com", "login.live.com", "outlook.com"],
      facebook: ["facebook.com", "fb.com"],
      twitter: ["twitter.com", "api.twitter.com"],
      linkedin: ["linkedin.com", "api.linkedin.com"],
      apple: ["appleid.apple.com"],
    };

    // Check referrer first
    for (const [provider, domains] of Object.entries(providers)) {
      if (domains.some((domain) => referrer.includes(domain))) {
        return provider;
      }
    }

    // Check current URL for provider hints
    for (const [provider, domains] of Object.entries(providers)) {
      if (domains.some((domain) => currentURL.includes(domain))) {
        return provider;
      }
    }

    // Check for provider in state parameter or URL path
    const urlParams = new URLSearchParams(window.location.search);
    const state = urlParams.get("state");

    if (state) {
      const stateLower = state.toLowerCase();
      for (const provider of Object.keys(providers)) {
        if (stateLower.includes(provider)) {
          return provider;
        }
      }
    }

    return "unknown";
  }

  /**
   * Validate OAuth return using additional heuristics
   * @returns {boolean} True if valid OAuth return
   */
  validateOAuthReturn() {
    // Check if referrer is from a known OAuth provider
    const referrer = document.referrer.toLowerCase();
    const hasOAuthReferrer = this.config.supportedProviders.some(
      (provider) =>
        referrer.includes(provider) ||
        referrer.includes("oauth") ||
        referrer.includes("auth"),
    );

    // Check for OAuth-related URL patterns
    const currentURL = window.location.href.toLowerCase();
    const hasOAuthPattern =
      currentURL.includes("callback") ||
      currentURL.includes("redirect") ||
      currentURL.includes("auth") ||
      currentURL.includes("oauth");

    // Check for recent navigation (OAuth flows typically complete quickly)
    const navigationTiming = performance.getEntriesByType("navigation")[0];
    const isRecentNavigation =
      navigationTiming && Date.now() - navigationTiming.loadEventStart < 10000;

    return hasOAuthReferrer || hasOAuthPattern || isRecentNavigation;
  }

  /**
   * Process OAuth return and register signup
   * @param {Object} oauthData - OAuth detection data
   */
  async processOAuthReturn(oauthData) {
    console.log("OAuthDetector: processOAuthReturn called with:", oauthData);

    if (oauthData.hasError) {
      console.warn(
        "OAuthDetector: OAuth flow completed with error:",
        oauthData.errorDescription,
      );
      return;
    }

    try {
      // Extract email from page content if available
      console.log("OAuthDetector: Extracting email from page...");
      const email = await this.extractEmailFromPage();
      console.log("OAuthDetector: Extracted email:", email || "none found");

      const signupData = {
        email: email || "oauth_user@pending.com", // Placeholder if email not found
        signup_method: `oauth_${oauthData.provider}`,
        page_url: window.location.href,
        referrer: document.referrer,
        metadata: {
          oauth_provider: oauthData.provider,
          oauth_flow_type: oauthData.flowType,
          oauth_state: oauthData.state,
          detected_at: new Date().toISOString(),
          user_agent: navigator.userAgent,
        },
      };

      console.log("OAuthDetector: Sending signup data to backend:", signupData);
      const result = await this.apiClient.registerSignup(signupData);
      console.log("OAuthDetector: OAuth signup registered successfully!", {
        provider: oauthData.provider,
        email: email ? "found" : "pending",
        result: result,
      });
    } catch (error) {
      console.error("OAuthDetector: Failed to process OAuth return:", error);
      console.error("OAuthDetector: Error details:", {
        message: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Extract email from page content after OAuth completion
   * @returns {Promise<string|null>} Email address or null
   */
  async extractEmailFromPage() {
    // Wait a bit for page to update after OAuth
    await this.delay(1000);

    // Common selectors for email display
    const emailSelectors = [
      "[data-email]",
      ".email",
      ".user-email",
      ".account-email",
      'input[type="email"][value]',
      '[class*="email" i]:not([type="password"])',
      '[id*="email" i]:not([type="password"])',
    ];

    for (const selector of emailSelectors) {
      const elements = document.querySelectorAll(selector);

      for (const element of elements) {
        const email = this.extractEmailFromElement(element);
        if (email && this.securityUtils.isValidEmail(email)) {
          return email;
        }
      }
    }

    // Try to find email in text content (less reliable)
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const pageText = document.body.textContent || "";
    const emailMatches = pageText.match(emailRegex);

    if (emailMatches && emailMatches.length > 0) {
      // Return the first valid email found
      for (const email of emailMatches) {
        if (this.securityUtils.isValidEmail(email)) {
          return email;
        }
      }
    }

    return null;
  }

  /**
   * Extract email from a DOM element
   * @param {HTMLElement} element - DOM element
   * @returns {string|null} Email or null
   */
  extractEmailFromElement(element) {
    // Try data attribute
    if (element.dataset && element.dataset.email) {
      return element.dataset.email;
    }

    // Try input value
    if (element.value) {
      return element.value;
    }

    // Try text content
    if (element.textContent) {
      const text = element.textContent.trim();
      if (this.securityUtils.isValidEmail(text)) {
        return text;
      }
    }

    return null;
  }

  /**
   * Clean OAuth parameters from URL for security
   */
  cleanOAuthParams() {
    if (!this.isActive) return;

    const url = new URL(window.location.href);
    const params = url.searchParams;

    // Parameters to remove for security
    const sensitiveParams = [
      "code",
      "access_token",
      "id_token",
      "refresh_token",
      "token_type",
      "expires_in",
      "scope",
    ];

    let paramsChanged = false;

    sensitiveParams.forEach((param) => {
      if (params.has(param)) {
        params.delete(param);
        paramsChanged = true;
      }
    });

    // Clean hash parameters
    if (
      window.location.hash.includes("access_token") ||
      window.location.hash.includes("id_token")
    ) {
      url.hash = "";
      paramsChanged = true;
    }

    // Update URL if parameters were removed
    if (paramsChanged) {
      const newURL = url.toString();
      history.replaceState({}, document.title, newURL);
      console.log("OAuthDetector: Cleaned sensitive OAuth parameters from URL");
    }
  }

  /**
   * Delay execution
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get detector status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isActive: this.isActive,
      checkCount: this.checkCount,
      detectedFlows: this.detectedFlows.size,
      config: this.config,
      intervalActive: !!this.intervalId,
    };
  }

  /**
   * Update detector configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };

    if (this.isActive) {
      // Restart with new config
      this.stop();
      this.start(this.config);
    }
  }

  /**
   * Get detected OAuth flows information
   * @returns {Array} Array of detected flow information
   */
  getDetectedFlows() {
    return Array.from(this.detectedFlows).map((flowId) => ({
      flowId,
      detectedAt: new Date().toISOString(),
      url: window.location.href,
    }));
  }

  /**
   * Manual OAuth detection trigger
   * @returns {Promise<Object>} Detection result
   */
  async manualDetection() {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));

    return this.detectOAuthFlow(urlParams, hashParams);
  }
}

export default OAuthDetector;
