/**
 * PrivacyManager - Handles GDPR compliance and user consent management
 * Ensures privacy-compliant data collection and provides opt-out mechanisms
 */
class PrivacyManager {
  constructor() {
    this.consentKey = "pavekit_consent";
    this.optOutKey = "pavekit_opt_out";
    this.hasUserConsent = false;
    this.isOptedOut = false;
    this.consentTimestamp = null;
    this.consentVersion = "1.0";

    // Initialize consent status from storage
    this.loadConsentStatus();
  }

  /**
   * Load consent status from localStorage
   */
  loadConsentStatus() {
    try {
      const consentData = localStorage.getItem(this.consentKey);
      const optOutData = localStorage.getItem(this.optOutKey);

      if (consentData) {
        const consent = JSON.parse(consentData);
        this.hasUserConsent = consent.granted || false;
        this.consentTimestamp = consent.timestamp;
        this.consentVersion = consent.version || "1.0";
      }

      this.isOptedOut = optOutData === "true";
    } catch (error) {
      console.warn("Failed to load consent status:", error);
      this.hasUserConsent = false;
      this.isOptedOut = false;
    }
  }

  /**
   * Save consent status to localStorage
   */
  saveConsentStatus() {
    try {
      const consentData = {
        granted: this.hasUserConsent,
        timestamp: this.consentTimestamp,
        version: this.consentVersion,
      };

      localStorage.setItem(this.consentKey, JSON.stringify(consentData));
      localStorage.setItem(this.optOutKey, this.isOptedOut.toString());
    } catch (error) {
      console.warn("Failed to save consent status:", error);
    }
  }

  /**
   * Check if user has given consent for data collection
   * @returns {boolean} True if user has consented
   */
  hasConsent() {
    return (
      this.hasUserConsent && !this.isOptedOut && !this.isDoNotTrackEnabled()
    );
  }

  /**
   * Check if Do Not Track is enabled in browser
   * @returns {boolean} True if DNT is enabled
   */
  isDoNotTrackEnabled() {
    return (
      navigator.doNotTrack === "1" ||
      navigator.msDoNotTrack === "1" ||
      window.doNotTrack === "1"
    );
  }

  /**
   * Request consent from user (can be customized)
   * @param {Object} options - Consent options
   * @returns {Promise<boolean>} Promise that resolves with consent status
   */
  async requestConsent(options = {}) {
    // If already consented or opted out, return current status
    if (this.hasUserConsent || this.isOptedOut) {
      return this.hasConsent();
    }

    // If DNT is enabled, respect it
    if (this.isDoNotTrackEnabled()) {
      console.log("Do Not Track detected, respecting user preference");
      return false;
    }

    // Default consent behavior (can be overridden)
    const showConsentBanner = options.showBanner !== false;

    if (showConsentBanner) {
      return await this.showConsentBanner(options);
    } else {
      // Implicit consent for essential functionality
      return this.grantConsent("implicit");
    }
  }

  /**
   * Show consent banner to user
   * @param {Object} options - Banner options
   * @returns {Promise<boolean>} Promise that resolves with consent status
   */
  async showConsentBanner(options = {}) {
    return new Promise((resolve) => {
      // Check if banner already exists
      if (document.getElementById("pavekit-consent-banner")) {
        resolve(this.hasConsent());
        return;
      }

      // Create consent banner
      const banner = this.createConsentBanner(options);
      document.body.appendChild(banner);

      // Handle consent responses
      const handleResponse = (granted) => {
        document.body.removeChild(banner);

        if (granted) {
          this.grantConsent("explicit");
        } else {
          this.denyConsent();
        }

        resolve(this.hasConsent());
      };

      // Add event listeners
      banner.querySelector("#pavekit-consent-accept").onclick = () =>
        handleResponse(true);
      banner.querySelector("#pavekit-consent-decline").onclick = () =>
        handleResponse(false);

      // Auto-hide after timeout if specified
      if (options.timeout) {
        setTimeout(() => {
          if (document.body.contains(banner)) {
            handleResponse(false);
          }
        }, options.timeout);
      }
    });
  }

  /**
   * Create consent banner HTML element
   * @param {Object} options - Banner customization options
   * @returns {HTMLElement} Banner element
   */
  createConsentBanner(options = {}) {
    const banner = document.createElement("div");
    banner.id = "pavekit-consent-banner";
    banner.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #2c3e50;
      color: white;
      padding: 15px 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui;
      font-size: 14px;
      z-index: 999999;
      box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
    `;

    const message =
      options.message ||
      "We use cookies and collect minimal data to improve your experience and send relevant onboarding emails. By continuing, you agree to our data collection practices.";

    const privacyUrl = options.privacyUrl || "#";

    banner.innerHTML = `
      <div style="flex: 1; margin-right: 20px; min-width: 300px;">
        <span>${message}</span>
        <a href="${privacyUrl}" target="_blank" style="color: #3498db; text-decoration: underline; margin-left: 5px;">
          Privacy Policy
        </a>
      </div>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button id="pavekit-consent-decline" style="
          background: transparent;
          border: 1px solid #95a5a6;
          color: #95a5a6;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        ">
          Decline
        </button>
        <button id="pavekit-consent-accept" style="
          background: #27ae60;
          border: none;
          color: white;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        ">
          Accept
        </button>
      </div>
    `;

    return banner;
  }

  /**
   * Grant user consent
   * @param {string} type - Consent type ('explicit', 'implicit')
   * @returns {boolean} True if consent was granted
   */
  grantConsent(type = "explicit") {
    this.hasUserConsent = true;
    this.isOptedOut = false;
    this.consentTimestamp = new Date().toISOString();
    this.saveConsentStatus();

    // Dispatch consent event
    this.dispatchConsentEvent("granted", {
      type,
      timestamp: this.consentTimestamp,
    });

    console.log(`PaveKit: User consent granted (${type})`);
    return true;
  }

  /**
   * Deny user consent
   * @returns {boolean} False
   */
  denyConsent() {
    this.hasUserConsent = false;
    this.isOptedOut = false; // Not opted out, just declined
    this.consentTimestamp = new Date().toISOString();
    this.saveConsentStatus();

    // Dispatch consent event
    this.dispatchConsentEvent("denied", { timestamp: this.consentTimestamp });

    console.log("PaveKit: User consent denied");
    return false;
  }

  /**
   * Opt user out completely
   */
  optOut() {
    this.hasUserConsent = false;
    this.isOptedOut = true;
    this.consentTimestamp = new Date().toISOString();
    this.saveConsentStatus();

    // Clear any existing data
    this.clearStoredData();

    // Dispatch opt-out event
    this.dispatchConsentEvent("opted-out", {
      timestamp: this.consentTimestamp,
    });

    console.log("PaveKit: User opted out completely");
  }

  /**
   * Opt user back in
   * @returns {Promise<boolean>} Promise that resolves with consent status
   */
  async optIn() {
    this.isOptedOut = false;
    this.saveConsentStatus();

    // Request fresh consent
    return await this.requestConsent();
  }

  /**
   * Clear all stored data
   */
  clearStoredData() {
    try {
      // Clear consent data
      localStorage.removeItem(this.consentKey);
      localStorage.removeItem(this.optOutKey);

      // Clear any other PaveKit data
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("pavekit_")) {
          localStorage.removeItem(key);
        }
      });

      // Clear session storage as well
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith("pavekit_")) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn("Failed to clear stored data:", error);
    }
  }

  /**
   * Dispatch consent-related events
   * @param {string} type - Event type
   * @param {Object} data - Event data
   */
  dispatchConsentEvent(type, data = {}) {
    try {
      const event = new CustomEvent("pavekit-consent", {
        detail: {
          type,
          ...data,
        },
      });

      window.dispatchEvent(event);
    } catch (error) {
      console.warn("Failed to dispatch consent event:", error);
    }
  }

  /**
   * Get consent status information
   * @returns {Object} Consent status
   */
  getConsentStatus() {
    return {
      hasConsent: this.hasConsent(),
      isOptedOut: this.isOptedOut,
      consentTimestamp: this.consentTimestamp,
      consentVersion: this.consentVersion,
      doNotTrack: this.isDoNotTrackEnabled(),
    };
  }

  /**
   * Check if consent is required based on user's location (basic implementation)
   * @returns {boolean} True if consent is required
   */
  isConsentRequired() {
    // Basic implementation - in production, you might want to check user's location
    // For now, assume GDPR applies to all users for maximum compliance
    return true;
  }

  /**
   * Get privacy-compliant user identifier
   * @returns {string} Anonymous user identifier
   */
  getAnonymousId() {
    let anonymousId = localStorage.getItem("pavekit_anonymous_id");

    if (!anonymousId) {
      // Generate anonymous ID
      anonymousId =
        "anon_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);

      try {
        localStorage.setItem("pavekit_anonymous_id", anonymousId);
      } catch (error) {
        // Fallback to session-based ID if localStorage fails
        anonymousId = "session_" + Date.now();
      }
    }

    return anonymousId;
  }

  /**
   * Reset privacy manager to initial state
   */
  reset() {
    this.clearStoredData();
    this.hasUserConsent = false;
    this.isOptedOut = false;
    this.consentTimestamp = null;
    this.consentVersion = "1.0";
  }

  /**
   * Get data retention policy info
   * @returns {Object} Data retention information
   */
  getDataRetentionInfo() {
    return {
      consentData: "2 years",
      analyticsData: "26 months",
      emailData: "Until unsubscribe or opt-out",
      rightToErasure: "Available on request",
      dataController: "PaveKit Platform",
    };
  }
}

export default PrivacyManager;
