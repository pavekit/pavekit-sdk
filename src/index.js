/**
 * PaveKit SDK - Automated User Onboarding Detection
 *
 * Main entry point for the PaveKit JavaScript SDK.
 * Provides secure, privacy-compliant user signup detection and activity tracking.
 *
 * @version 1.0.0
 * @author PaveKit Team
 * @license MIT
 */

import SecurityUtils from "./core/security.js";
import APIClient from "./core/api.js";
import PrivacyManager from "./core/privacy.js";
import FormDetector from "./detectors/form-detector.js";
import OAuthDetector from "./detectors/oauth-detector.js";
import ActivityDetector from "./detectors/activity-detector.js";

/**
 * Main PaveKit SDK class
 */
class PaveKitSDK {
  constructor() {
    this.version = "1.0.0";
    this.initialized = false;
    this.offlineMode = false;
    this.config = {
      apiKey: null,
      baseURL: "http://localhost:8000",
      domain: null,
      detect: ["signups", "activity"],
      privacy: "gdpr-compliant",
      debug: false,
      autoCleanup: true,
      consentBanner: true,
    };

    // Initialize core components
    this.securityUtils = new SecurityUtils();
    this.apiClient = new APIClient();
    this.privacyManager = new PrivacyManager();

    // Initialize detectors (will be activated after init)
    this.detectors = {
      form: null,
      oauth: null,
      activity: null,
    };

    this.isDetecting = false;
    this.userEmail = null;
  }

  /**
   * Auto-initialization from script tag attributes
   * This method is called automatically when the SDK is loaded
   */
  static autoInit() {
    if (typeof window === "undefined") {
      console.warn("PaveKit SDK: Not running in browser environment");
      return null;
    }

    // Find the SDK script tag
    const script = document.querySelector('script[src*="pavekit"]');
    if (!script) {
      console.warn(
        "PaveKit SDK: Script tag not found, manual initialization required",
      );
      return null;
    }

    // Extract configuration from script tag data attributes
    const config = {
      apiKey: script.dataset.key,
      domain: script.dataset.domain,
      detect: script.dataset.detect
        ? script.dataset.detect.split(",")
        : ["signups", "activity"],
      privacy: script.dataset.privacy || "gdpr-compliant",
      debug: script.dataset.debug === "true",
      baseURL: script.dataset.baseUrl || "http://localhost:8000",
      consentBanner: script.dataset.consentBanner !== "false",
    };

    if (!config.apiKey) {
      console.error(
        'PaveKit SDK: API key is required. Add data-key="your-api-key" to script tag',
      );
      return null;
    }

    // Create and initialize SDK instance
    const sdk = new PaveKitSDK();
    sdk.init(config);

    // Make SDK globally available
    window.PaveKit = sdk;

    return sdk;
  }

  /**
   * Initialize the SDK with configuration
   * @param {Object} config - Configuration object
   */
  async init(config = {}) {
    if (this.initialized) {
      console.warn("PaveKit SDK: Already initialized");
      return;
    }

    // Merge configuration
    this.config = { ...this.config, ...config };

    if (this.config.debug) {
      console.log("PaveKit SDK: Initializing with config:", {
        ...this.config,
        apiKey: this.config.apiKey ? "[SET]" : "[MISSING]",
      });
    }

    // Validate required configuration
    if (!this.config.apiKey) {
      throw new Error("PaveKit SDK: API key is required");
    }

    // Check browser compatibility
    if (!this.securityUtils.isBrowserSupported()) {
      console.warn("PaveKit SDK: Browser not supported");
      return;
    }

    try {
      // Initialize API client
      this.apiClient.init({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL,
        debug: this.config.debug,
      });

      // Try to validate API key with backend (non-blocking)
      let backendConnected = false;
      try {
        await this.validateConfiguration();
        backendConnected = true;
        if (this.config.debug) {
          console.log("PaveKit SDK: Backend connection established ✅");
        }
      } catch (error) {
        // Backend validation failed - continue in offline mode
        console.warn(
          "PaveKit SDK: Backend validation failed, running in offline mode",
          error.message,
        );
        if (this.config.debug) {
          console.log(
            "PaveKit SDK: Client-side features will work, but events won't be sent to backend",
          );
        }
      }

      // Initialize detectors (they work even without backend)
      this.initializeDetectors();

      // Handle privacy and consent
      await this.handlePrivacyConsent();

      this.initialized = true;
      this.offlineMode = !backendConnected;

      if (this.config.debug) {
        console.log("PaveKit SDK: Successfully initialized", {
          mode: backendConnected ? "Online" : "Offline",
          backendConnected: backendConnected,
        });
      }

      // Dispatch initialization event
      this.dispatchEvent("initialized", {
        version: this.version,
        config: this.config,
        offlineMode: this.offlineMode,
      });
    } catch (error) {
      console.error("PaveKit SDK: Initialization failed:", error);
      throw error;
    }
  }

  /**
   * Validate configuration with backend
   */
  async validateConfiguration() {
    const validation = await this.apiClient.validateAPIKey();

    if (this.config.debug) {
      console.log("PaveKit SDK: API key validated successfully");
    }

    return validation;
  }

  /**
   * Initialize detector components
   */
  initializeDetectors() {
    this.detectors.form = new FormDetector(
      this.securityUtils,
      this.apiClient,
      this.privacyManager,
    );

    this.detectors.oauth = new OAuthDetector(
      this.securityUtils,
      this.apiClient,
      this.privacyManager,
    );

    this.detectors.activity = new ActivityDetector(
      this.securityUtils,
      this.apiClient,
      this.privacyManager,
    );

    if (this.config.debug) {
      console.log("PaveKit SDK: Detectors initialized");
    }
  }

  /**
   * Handle privacy consent and GDPR compliance
   */
  async handlePrivacyConsent() {
    const consentRequired = this.privacyManager.isConsentRequired();

    if (consentRequired && this.config.consentBanner) {
      const hasConsent = await this.privacyManager.requestConsent({
        showBanner: true,
        timeout: 30000, // 30 seconds timeout
        message:
          "We use cookies and collect minimal data to improve your experience and send relevant onboarding emails.",
        privacyUrl: "/privacy",
      });

      if (!hasConsent) {
        console.log("PaveKit SDK: User declined consent, tracking disabled");
        return;
      }
    } else if (!this.privacyManager.hasConsent()) {
      // Grant implicit consent if not required to show banner
      this.privacyManager.grantConsent("implicit");
    }

    // Start detection if consent is granted
    if (this.privacyManager.hasConsent()) {
      this.startDetection();
    }
  }

  /**
   * Start user detection based on configuration
   */
  startDetection() {
    if (this.isDetecting || !this.privacyManager.hasConsent()) {
      return;
    }

    this.isDetecting = true;

    const detectConfig = {
      debug: this.config.debug,
    };

    // Start form detection
    if (this.config.detect.includes("signups") && this.detectors.form) {
      this.detectors.form.start(detectConfig);
    }

    // Start OAuth detection
    if (this.config.detect.includes("oauth") && this.detectors.oauth) {
      this.detectors.oauth.start(detectConfig);
    }

    // Start activity detection
    if (this.config.detect.includes("activity") && this.detectors.activity) {
      this.detectors.activity.start(detectConfig, this.userEmail);
    }

    if (this.config.debug) {
      console.log("PaveKit SDK: Detection started for:", this.config.detect);
    }

    // Dispatch detection started event
    this.dispatchEvent("detectionStarted", {
      detectors: this.config.detect,
    });
  }

  /**
   * Stop all detection
   */
  stopDetection() {
    if (!this.isDetecting) return;

    this.isDetecting = false;

    // Stop all detectors
    Object.values(this.detectors).forEach((detector) => {
      if (detector && detector.stop) {
        detector.stop();
      }
    });

    if (this.config.debug) {
      console.log("PaveKit SDK: Detection stopped");
    }

    // Dispatch detection stopped event
    this.dispatchEvent("detectionStopped");
  }

  /**
   * Manually track a signup event
   * @param {Object} data - Signup data
   */
  async trackSignup(data = {}) {
    if (!this.initialized || !this.privacyManager.hasConsent()) {
      throw new Error("SDK not initialized or consent not granted");
    }

    const signupData = {
      email: data.email || this.userEmail,
      signup_method: data.method || "manual",
      page_url: data.pageUrl || window.location.href,
      referrer: data.referrer || document.referrer,
      metadata: data.metadata || {},
    };

    if (!signupData.email) {
      throw new Error("Email is required for signup tracking");
    }

    try {
      const result = await this.apiClient.registerSignup(signupData);

      if (this.config.debug) {
        console.log("PaveKit SDK: Manual signup tracked:", signupData.email);
      }

      // Update user email for activity tracking
      this.setUserEmail(signupData.email);

      return result;
    } catch (error) {
      console.error("PaveKit SDK: Failed to track signup:", error);
      throw error;
    }
  }

  /**
   * Update user information (name, etc.)
   * @param {Object} data - User data to update
   * @param {string} data.email - User email (required to identify user)
   * @param {string} data.name - User's display name
   */
  async updateUser(data = {}) {
    if (!this.initialized || !this.privacyManager.hasConsent()) {
      throw new Error("SDK not initialized or consent not granted");
    }

    const userData = {
      email: data.email || this.userEmail,
      name: data.name || "",
    };

    if (!userData.email) {
      throw new Error("Email is required to update user info");
    }

    try {
      const result = await this.apiClient.updateUser(userData);

      if (this.config.debug) {
        console.log("PaveKit SDK: User info updated:", userData.email);
      }

      return result;
    } catch (error) {
      console.error("PaveKit SDK: Failed to update user:", error);
      throw error;
    }
  }

  /**
   * Manually track a conversion event
   * @param {Object} data - Conversion data
   */
  async trackConversion(data = {}) {
    if (!this.initialized || !this.privacyManager.hasConsent()) {
      throw new Error("SDK not initialized or consent not granted");
    }

    const conversionData = {
      email: data.email || this.userEmail,
      conversion_type: data.type || "purchase",
      value: data.value || 0,
      currency: data.currency || "USD",
      metadata: data.metadata || {},
    };

    if (!conversionData.email) {
      throw new Error("Email is required for conversion tracking");
    }

    try {
      const result = await this.apiClient.trackConversion(conversionData);

      if (this.config.debug) {
        console.log("PaveKit SDK: Conversion tracked:", {
          email: conversionData.email,
          type: conversionData.conversion_type,
          value: conversionData.value,
        });
      }

      return result;
    } catch (error) {
      console.error("PaveKit SDK: Failed to track conversion:", error);
      throw error;
    }
  }

  /**
   * Set user email for tracking
   * @param {string} email - User email address
   */
  setUserEmail(email) {
    if (!this.securityUtils.isValidEmail(email)) {
      throw new Error("Invalid email address");
    }

    this.userEmail = email;

    // Update activity detector with user email
    if (this.detectors.activity) {
      this.detectors.activity.setUserEmail(email);
    }

    if (this.config.debug) {
      console.log("PaveKit SDK: User email set for tracking");
    }
  }

  /**
   * Get user consent status
   */
  getConsentStatus() {
    return this.privacyManager.getConsentStatus();
  }

  /**
   * Request user consent manually
   */
  async requestConsent() {
    return await this.privacyManager.requestConsent({
      showBanner: true,
    });
  }

  /**
   * Opt user out of all tracking
   */
  optOut() {
    this.stopDetection();
    this.privacyManager.optOut();

    if (this.config.debug) {
      console.log("PaveKit SDK: User opted out");
    }
  }

  /**
   * Opt user back into tracking
   */
  async optIn() {
    const hasConsent = await this.privacyManager.optIn();

    if (hasConsent) {
      this.startDetection();

      if (this.config.debug) {
        console.log("PaveKit SDK: User opted back in");
      }
    }

    return hasConsent;
  }

  /**
   * Delete all user data (GDPR right to erasure)
   */
  deleteUserData() {
    this.stopDetection();
    this.privacyManager.clearStoredData();
    this.userEmail = null;

    if (this.config.debug) {
      console.log("PaveKit SDK: User data deleted");
    }
  }

  /**
   * Get current SDK status
   */
  getStatus() {
    const status = {
      version: this.version,
      initialized: this.initialized,
      detecting: this.isDetecting,
      hasConsent: this.privacyManager.hasConsent(),
      hasUserEmail: !!this.userEmail,
      detectors: {},
    };

    // Get detector statuses
    Object.keys(this.detectors).forEach((key) => {
      const detector = this.detectors[key];
      if (detector && detector.getStatus) {
        status.detectors[key] = detector.getStatus();
      }
    });

    return status;
  }

  /**
   * Update SDK configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig = {}) {
    this.config = { ...this.config, ...newConfig };

    // Update API client if needed
    if (newConfig.baseURL || newConfig.apiKey) {
      this.apiClient.updateConfig({
        baseURL: newConfig.baseURL,
        apiKey: newConfig.apiKey,
      });
    }

    // Update detectors if needed
    Object.values(this.detectors).forEach((detector) => {
      if (detector && detector.updateConfig) {
        detector.updateConfig(newConfig);
      }
    });

    if (this.config.debug) {
      console.log("PaveKit SDK: Configuration updated");
    }
  }

  /**
   * Dispatch custom events
   * @param {string} eventName - Event name
   * @param {Object} data - Event data
   */
  dispatchEvent(eventName, data = {}) {
    try {
      const event = new CustomEvent(`pavekit-${eventName}`, {
        detail: {
          timestamp: new Date().toISOString(),
          version: this.version,
          ...data,
        },
      });

      window.dispatchEvent(event);
    } catch (error) {
      console.warn("PaveKit SDK: Failed to dispatch event:", error);
    }
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    return {
      version: this.version,
      config: this.config,
      status: this.getStatus(),
      browserSupport: this.securityUtils.isBrowserSupported(),
      privacy: this.privacyManager.getConsentStatus(),
      apiClient: this.apiClient.getStatus(),
      compliance: this.securityUtils.getComplianceInfo(),
    };
  }

  /**
   * Reset SDK to initial state
   */
  reset() {
    this.stopDetection();
    this.privacyManager.reset();
    this.apiClient.reset();
    this.userEmail = null;
    this.initialized = false;

    if (this.config.debug) {
      console.log("PaveKit SDK: Reset to initial state");
    }
  }
}

// Auto-initialize if loaded as script tag
if (typeof window !== "undefined" && document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    PaveKitSDK.autoInit();
  });
} else if (typeof window !== "undefined") {
  // DOM already loaded
  setTimeout(() => {
    PaveKitSDK.autoInit();
  }, 0);
}

// Export for module usage
export default PaveKitSDK;

// Also make available globally for script tag usage
if (typeof window !== "undefined") {
  window.PaveKitSDK = PaveKitSDK;
}
// Updated comment
// Trigger workflows
// Trigger workflows again
// Trigger workflows with package.json fix
// Trigger workflows after YAML fix
// Trigger workflows after YAML fix
// Trigger workflows after YAML fix
// Trigger workflows after YAML fix
