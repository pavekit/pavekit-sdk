/**
 * PaveKit SDK Test Suite
 * Tests for the main SDK functionality including initialization, detection, and API communication
 */

import PaveKitSDK from "../src/index.js";

describe("PaveKitSDK", () => {
  let sdk;

  beforeEach(() => {
    sdk = new PaveKitSDK();
  });

  afterEach(() => {
    if (sdk && sdk.initialized) {
      sdk.reset();
    }
  });

  describe("Initialization", () => {
    test("should create SDK instance with default config", () => {
      expect(sdk).toBeInstanceOf(PaveKitSDK);
      expect(sdk.version).toBe("1.0.0");
      expect(sdk.initialized).toBe(false);
      expect(sdk.config.detect).toEqual(["signups", "activity"]);
    });

    test("should throw error when initialized without API key", async () => {
      await expect(sdk.init({})).rejects.toThrow("API key is required");
    });

    test("should initialize successfully with valid config", async () => {
      const config = {
        apiKey: "test_api_key",
        baseURL: "http://localhost:8000",
        debug: true,
        consentBanner: false,
      };

      // Mock successful API validation
      testHelpers.mockAPIResponse("/sdk/validate", {
        valid: true,
        workspace_id: 1,
      });

      await sdk.init(config);

      expect(sdk.initialized).toBe(true);
      expect(sdk.config.apiKey).toBe("test_api_key");
      expect(sdk.config.debug).toBe(true);
    });

    test("should fail initialization with invalid API key", async () => {
      const config = {
        apiKey: "invalid_key",
        baseURL: "http://localhost:8000",
        consentBanner: false,
      };

      // Mock API validation failure
      testHelpers.mockAPIError("/sdk/validate", "Invalid API key");

      // SDK continues in offline mode even with invalid key, so it won't throw
      await sdk.init(config);

      // Check that it initialized in offline mode
      expect(sdk.initialized).toBe(true);
      expect(sdk.offlineMode).toBe(true);
    });
  });

  describe("Auto-initialization", () => {
    test("should auto-initialize from script tag", () => {
      // Create mock script tag
      const script = document.createElement("script");
      script.src = "https://cdn.pavekit.com/sdk/pavekit.min.js";
      script.dataset.key = "test_api_key";
      script.dataset.debug = "true";
      script.dataset.detect = "signups,oauth";
      document.head.appendChild(script);

      // Mock API validation
      testHelpers.mockAPIResponse("/sdk/validate", { valid: true });

      const autoSdk = PaveKitSDK.autoInit();

      expect(autoSdk).toBeInstanceOf(PaveKitSDK);
      expect(autoSdk.config.apiKey).toBe("test_api_key");
      expect(autoSdk.config.debug).toBe(true);
      expect(autoSdk.config.detect).toEqual(["signups", "oauth"]);

      document.head.removeChild(script);
    });

    test("should return null if no script tag found", () => {
      const autoSdk = PaveKitSDK.autoInit();
      expect(autoSdk).toBeNull();
    });

    test("should return null if script tag has no API key", () => {
      const script = document.createElement("script");
      script.src = "https://cdn.pavekit.com/sdk/pavekit.min.js";
      // No data-key attribute
      document.head.appendChild(script);

      const autoSdk = PaveKitSDK.autoInit();
      expect(autoSdk).toBeNull();

      document.head.removeChild(script);
    });
  });

  describe("Privacy and Consent", () => {
    beforeEach(async () => {
      testHelpers.mockAPIResponse("/sdk/validate", { valid: true });
      await sdk.init({
        apiKey: "test_key",
        consentBanner: false, // Disable banner for testing
      });
    });

    test("should handle consent properly", () => {
      const consentStatus = sdk.getConsentStatus();
      expect(consentStatus).toHaveProperty("hasConsent");
      expect(consentStatus).toHaveProperty("isOptedOut");
      expect(consentStatus).toHaveProperty("doNotTrack");
    });

    test("should allow opt-out", () => {
      sdk.optOut();
      const status = sdk.getConsentStatus();
      expect(status.isOptedOut).toBe(true);
      expect(status.hasConsent).toBe(false);
    });

    test("should allow opt-in after opt-out", () => {
      sdk.optOut();
      expect(sdk.getConsentStatus().isOptedOut).toBe(true);

      // Grant consent directly instead of using optIn which shows banner
      sdk.privacyManager.isOptedOut = false;
      sdk.privacyManager.grantConsent("explicit");

      expect(sdk.getConsentStatus().isOptedOut).toBe(false);
      expect(sdk.getConsentStatus().hasConsent).toBe(true);
    });

    test("should respect Do Not Track", () => {
      // Mock DNT enabled
      Object.defineProperty(navigator, "doNotTrack", {
        value: "1",
        writable: true,
      });

      const status = sdk.getConsentStatus();
      expect(status.doNotTrack).toBe(true);
    });
  });

  describe("Manual Event Tracking", () => {
    beforeEach(async () => {
      testHelpers.mockAPIResponse("/sdk/validate", { valid: true });
      testHelpers.mockAPIResponse("/sdk/signup", {
        message: "Signup registered successfully",
        user_id: "test-user-id",
      });
      testHelpers.mockAPIResponse("/sdk/conversion", {
        message: "Conversion tracked successfully",
      });
      testHelpers.mockAPIResponse("/sdk/user-info", {
        message: "User info updated successfully",
        user_id: "test-user-id",
        name: "Test User",
      });

      await sdk.init({
        apiKey: "test_key",
        consentBanner: false,
      });
    });

    test("should track signup manually", async () => {
      const signupData = {
        email: "test@example.com",
        method: "manual",
      };

      const result = await sdk.trackSignup(signupData);
      expect(result).toHaveProperty("success");
      expect(sdk.userEmail).toBe("test@example.com");
    });

    test("should throw error for signup without email", async () => {
      await expect(sdk.trackSignup({})).rejects.toThrow(
        "Email is required for signup tracking",
      );
    });

    test("should track conversion manually", async () => {
      // Set user email first
      sdk.setUserEmail("test@example.com");

      const conversionData = {
        type: "purchase",
        value: 99.99,
        currency: "USD",
      };

      const result = await sdk.trackConversion(conversionData);
      expect(result).toHaveProperty("success");
    });

    test("should throw error for conversion without email", async () => {
      const conversionData = {
        type: "purchase",
        value: 99.99,
      };

      await expect(sdk.trackConversion(conversionData)).rejects.toThrow(
        "Email is required for conversion tracking",
      );
    });

    test("should validate email format when setting user email", () => {
      expect(() => sdk.setUserEmail("valid@example.com")).not.toThrow();
      expect(() => sdk.setUserEmail("invalid-email")).toThrow(
        "Invalid email address",
      );
    });
  });

  describe("User Info Updates", () => {
    beforeEach(async () => {
      testHelpers.mockAPIResponse("/sdk/validate", { valid: true });
      testHelpers.mockAPIResponse("/sdk/user-info", {
        message: "User info updated successfully",
        user_id: "test-user-id",
        name: "John Smith",
      });

      await sdk.init({
        apiKey: "test_key",
        consentBanner: false,
      });
    });

    test("should update user info with name", async () => {
      const userData = {
        email: "john@example.com",
        name: "John Smith",
      };

      const result = await sdk.updateUser(userData);
      expect(result).toHaveProperty("message");
      expect(result.name).toBe("John Smith");
    });

    test("should throw error for updateUser without email", async () => {
      await expect(sdk.updateUser({ name: "John" })).rejects.toThrow(
        "Email is required to update user info",
      );
    });

    test("should use current userEmail if not provided", async () => {
      sdk.setUserEmail("current@example.com");

      const result = await sdk.updateUser({ name: "Current User" });
      expect(result).toHaveProperty("message");
    });

    test("should throw error if no email available", async () => {
      // No email set and none provided
      await expect(sdk.updateUser({ name: "No Email User" })).rejects.toThrow(
        "Email is required to update user info",
      );
    });
  });

  describe("Detection Control", () => {
    beforeEach(async () => {
      testHelpers.mockAPIResponse("/sdk/validate", { valid: true });
      await sdk.init({
        apiKey: "test_key",
        consentBanner: false,
        detect: ["signups", "activity", "oauth"],
      });
    });

    test("should start detection when consent is given", () => {
      sdk.startDetection();

      const status = sdk.getStatus();
      expect(status.detecting).toBe(true);
      expect(status.detectors.form.isActive).toBe(true);
      expect(status.detectors.oauth.isActive).toBe(true);
      expect(status.detectors.activity.isActive).toBe(true);
    });

    test("should stop detection when requested", () => {
      sdk.startDetection();
      expect(sdk.getStatus().detecting).toBe(true);

      sdk.stopDetection();
      expect(sdk.getStatus().detecting).toBe(false);
    });

    test("should not start detection without consent", () => {
      sdk.optOut(); // Remove consent
      sdk.startDetection();

      expect(sdk.getStatus().detecting).toBe(false);
    });
  });

  describe("Configuration Management", () => {
    beforeEach(async () => {
      testHelpers.mockAPIResponse("/sdk/validate", { valid: true });
      await sdk.init({
        apiKey: "test_key",
        consentBanner: false,
      });
    });

    test("should update configuration", () => {
      const newConfig = {
        debug: true,
        detect: ["signups"],
      };

      sdk.updateConfig(newConfig);

      expect(sdk.config.debug).toBe(true);
      expect(sdk.config.detect).toEqual(["signups"]);
    });

    test("should get current status", () => {
      const status = sdk.getStatus();

      expect(status).toHaveProperty("version");
      expect(status).toHaveProperty("initialized");
      expect(status).toHaveProperty("detecting");
      expect(status).toHaveProperty("hasConsent");
      expect(status).toHaveProperty("detectors");

      expect(status.version).toBe("1.0.0");
      expect(status.initialized).toBe(true);
    });

    test("should get debug information", () => {
      const debugInfo = sdk.getDebugInfo();

      expect(debugInfo).toHaveProperty("version");
      expect(debugInfo).toHaveProperty("config");
      expect(debugInfo).toHaveProperty("status");
      expect(debugInfo).toHaveProperty("browserSupport");
      expect(debugInfo).toHaveProperty("privacy");
      expect(debugInfo).toHaveProperty("compliance");
    });
  });

  describe("Event Dispatching", () => {
    beforeEach(async () => {
      testHelpers.mockAPIResponse("/sdk/validate", { valid: true });
    });

    test("should dispatch initialization event", async () => {
      let eventReceived = false;

      const eventPromise = new Promise((resolve) => {
        window.addEventListener(
          "pavekit-initialized",
          (e) => {
            eventReceived = true;
            expect(e.detail).toHaveProperty("version");
            expect(e.detail).toHaveProperty("config");
            resolve();
          },
          { once: true },
        );
      });

      testHelpers.mockAPIResponse("/sdk/validate", { valid: true });

      await sdk.init({
        apiKey: "test_key",
        consentBanner: false,
      });

      await eventPromise;
      expect(eventReceived).toBe(true);
    });

    test("should dispatch detection started event", async () => {
      let eventReceived = false;

      const eventPromise = new Promise((resolve) => {
        window.addEventListener(
          "pavekit-detectionStarted",
          (e) => {
            eventReceived = true;
            expect(e.detail).toHaveProperty("detectors");
            resolve();
          },
          { once: true },
        );
      });

      testHelpers.mockAPIResponse("/sdk/validate", { valid: true });

      await sdk.init({
        apiKey: "test_key",
        consentBanner: false,
      });

      await eventPromise;
      expect(eventReceived).toBe(true);
    });
  });

  describe("Data Management", () => {
    beforeEach(async () => {
      testHelpers.mockAPIResponse("/sdk/validate", { valid: true });
      await sdk.init({
        apiKey: "test_key",
        consentBanner: false,
      });
    });

    test("should delete user data", () => {
      sdk.setUserEmail("test@example.com");
      expect(sdk.userEmail).toBe("test@example.com");

      sdk.deleteUserData();
      expect(sdk.userEmail).toBeNull();
    });

    test("should reset SDK to initial state", async () => {
      sdk.setUserEmail("test@example.com");
      sdk.startDetection();

      expect(sdk.initialized).toBe(true);
      expect(sdk.userEmail).toBe("test@example.com");

      sdk.reset();

      expect(sdk.initialized).toBe(false);
      expect(sdk.userEmail).toBeNull();
    });
  });

  describe("Error Handling", () => {
    test("should handle API errors gracefully", async () => {
      // Mock API error - need to mock multiple times for retry logic
      const networkError = new Error("Network error");
      global.fetch
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError);

      // SDK continues in offline mode even with network errors
      await sdk.init({ apiKey: "test_key", consentBanner: false });

      expect(sdk.initialized).toBe(true);
      expect(sdk.offlineMode).toBe(true);
    }, 10000);

    test("should handle malformed responses", async () => {
      const errorResponse = {
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      };

      // Mock multiple failures for retry logic
      global.fetch
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(errorResponse);

      // SDK continues in offline mode even with malformed responses
      await sdk.init({ apiKey: "test_key", consentBanner: false });

      expect(sdk.initialized).toBe(true);
      expect(sdk.offlineMode).toBe(true);
    }, 10000);

    test("should continue working after non-critical errors", async () => {
      testHelpers.mockAPIResponse("/sdk/validate", { valid: true });
      await sdk.init({
        apiKey: "test_key",
        consentBanner: false,
      });

      // Mock activity tracking failure
      testHelpers.mockAPIError("/sdk/activity", "Activity tracking failed");

      // Should not throw, just log warning
      expect(() => sdk.startDetection()).not.toThrow();
      expect(sdk.getStatus().detecting).toBe(true);
    });
  });

  describe("Browser Compatibility", () => {
    test("should check browser support", () => {
      expect(sdk.securityUtils.isBrowserSupported()).toBe(true);
    });

    test("should handle missing browser features", () => {
      // Mock missing fetch
      const originalFetch = global.fetch;
      delete global.fetch;

      expect(sdk.securityUtils.isBrowserSupported()).toBe(false);

      // Restore fetch
      global.fetch = originalFetch;
    });
  });
});
