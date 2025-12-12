/**
 * FormDetector - Detects and monitors signup forms on the page
 * Securely captures email addresses while filtering sensitive data
 */
class FormDetector {
  constructor(securityUtils, apiClient, privacyManager) {
    this.securityUtils = securityUtils;
    this.apiClient = apiClient;
    this.privacyManager = privacyManager;
    this.isActive = false;
    this.detectedForms = new Set();
    this.processedSubmissions = new Set();
    this.config = {
      debounceDelay: 500,
      maxFormsToMonitor: 10,
      requireEmailField: true,
      autoDetect: true,
    };
  }

  /**
   * Start form detection
   * @param {Object} config - Detection configuration
   */
  start(config = {}) {
    if (this.isActive) return;

    this.config = { ...this.config, ...config };
    this.isActive = true;

    if (this.config.autoDetect) {
      this.scanForForms();
      this.attachDOMObserver();
    }

    this.attachGlobalFormListener();
    console.log("FormDetector: Started");
  }

  /**
   * Stop form detection
   */
  stop() {
    if (!this.isActive) return;

    this.isActive = false;
    this.detachGlobalFormListener();
    this.detachDOMObserver();
    this.detectedForms.clear();
    this.processedSubmissions.clear();

    console.log("FormDetector: Stopped");
  }

  /**
   * Scan existing forms on page load
   */
  scanForForms() {
    const forms = document.querySelectorAll("form");

    forms.forEach((form) => {
      if (this.detectedForms.size >= this.config.maxFormsToMonitor) return;

      if (this.isSignupForm(form)) {
        this.monitorForm(form);
      }
    });

    console.log(`FormDetector: Found ${this.detectedForms.size} signup forms`);
  }

  /**
   * Attach DOM observer to detect dynamically added forms
   */
  attachDOMObserver() {
    if (this.domObserver) return;

    this.domObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the added node is a form
            if (node.tagName === "FORM" && this.isSignupForm(node)) {
              this.monitorForm(node);
            }

            // Check for forms within added nodes
            const forms = node.querySelectorAll
              ? node.querySelectorAll("form")
              : [];
            forms.forEach((form) => {
              if (
                this.detectedForms.size < this.config.maxFormsToMonitor &&
                this.isSignupForm(form)
              ) {
                this.monitorForm(form);
              }
            });
          }
        });
      });
    });

    this.domObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Detach DOM observer
   */
  detachDOMObserver() {
    if (this.domObserver) {
      this.domObserver.disconnect();
      this.domObserver = null;
    }
  }

  /**
   * Attach global form submission listener
   */
  attachGlobalFormListener() {
    this.formSubmitHandler = this.handleFormSubmit.bind(this);
    document.addEventListener("submit", this.formSubmitHandler, true);
  }

  /**
   * Detach global form submission listener
   */
  detachGlobalFormListener() {
    if (this.formSubmitHandler) {
      document.removeEventListener("submit", this.formSubmitHandler, true);
      this.formSubmitHandler = null;
    }
  }

  /**
   * Handle form submission
   * @param {Event} event - Submit event
   */
  async handleFormSubmit(event) {
    if (!this.isActive || !this.privacyManager.hasConsent()) return;

    const form = event.target;
    if (!form || form.tagName !== "FORM") return;

    // Prevent processing the same submission multiple times
    const submissionId = this.getSubmissionId(form);
    if (this.processedSubmissions.has(submissionId)) return;

    if (this.isSignupForm(form)) {
      this.processedSubmissions.add(submissionId);

      // Add debouncing to prevent duplicate processing
      setTimeout(() => {
        this.processedSubmissions.delete(submissionId);
      }, this.config.debounceDelay);

      await this.processSignupForm(form);
    }
  }

  /**
   * Generate unique submission ID
   * @param {HTMLFormElement} form - Form element
   * @returns {string} Unique submission ID
   */
  getSubmissionId(form) {
    const formData = new FormData(form);
    const email = this.extractEmailFromForm(form);
    const timestamp = Date.now();

    return `${form.action || window.location.href}_${email}_${timestamp}`;
  }

  /**
   * Check if form is a signup form
   * @param {HTMLFormElement} form - Form element to check
   * @returns {boolean} True if signup form
   */
  isSignupForm(form) {
    if (!form || form.tagName !== "FORM") return false;

    // Check for email field (required for signup)
    const hasEmailField = this.hasEmailField(form);
    if (this.config.requireEmailField && !hasEmailField) return false;

    // Check form characteristics
    const formAction = (form.action || "").toLowerCase();
    const formId = (form.id || "").toLowerCase();
    const formClass = (form.className || "").toLowerCase();

    // Positive indicators
    const signupIndicators = [
      "signup",
      "sign-up",
      "register",
      "registration",
      "join",
      "create",
      "account",
      "member",
    ];

    // Negative indicators (forms to avoid)
    const excludeIndicators = [
      "login",
      "signin",
      "sign-in",
      "password",
      "reset",
      "forgot",
      "recover",
      "search",
      "newsletter",
      "contact",
      "comment",
      "review",
      "feedback",
      "support",
    ];

    const formText = `${formAction} ${formId} ${formClass}`.toLowerCase();

    // Exclude non-signup forms
    if (excludeIndicators.some((indicator) => formText.includes(indicator))) {
      return false;
    }

    // Check for signup indicators
    const hasSignupIndicators = signupIndicators.some((indicator) =>
      formText.includes(indicator),
    );

    // Check form structure
    const hasPasswordField =
      form.querySelector('input[type="password"]') !== null;
    const fieldCount = form.querySelectorAll(
      'input[type="text"], input[type="email"]',
    ).length;

    // Heuristics for signup form detection
    return (
      hasEmailField &&
      (hasSignupIndicators ||
        (hasPasswordField && fieldCount >= 2) || // Email + name + password
        this.hasSignupButtons(form))
    );
  }

  /**
   * Check if form has email field
   * @param {HTMLFormElement} form - Form element
   * @returns {boolean} True if has email field
   */
  hasEmailField(form) {
    const emailInputs = form.querySelectorAll('input[type="email"]');
    if (emailInputs.length > 0) return true;

    // Check for inputs with email-like names
    const emailLikeInputs = form.querySelectorAll(
      'input[name*="email"], input[id*="email"], input[name*="mail"], input[id*="mail"]',
    );
    return emailLikeInputs.length > 0;
  }

  /**
   * Check if form has signup buttons
   * @param {HTMLFormElement} form - Form element
   * @returns {boolean} True if has signup buttons
   */
  hasSignupButtons(form) {
    const buttons = form.querySelectorAll('button, input[type="submit"]');

    return Array.from(buttons).some((button) => {
      const buttonText = (
        button.textContent ||
        button.value ||
        ""
      ).toLowerCase();
      return ["signup", "sign up", "register", "join", "create account"].some(
        (text) => buttonText.includes(text),
      );
    });
  }

  /**
   * Monitor a specific form
   * @param {HTMLFormElement} form - Form to monitor
   */
  monitorForm(form) {
    if (this.detectedForms.has(form)) return;

    this.detectedForms.add(form);

    // Add visual indicator in debug mode
    if (this.config.debug) {
      form.style.outline = "2px dashed #27ae60";
      form.title = "PaveKit: Monitoring this signup form";
    }

    console.log("FormDetector: Monitoring signup form", {
      action: form.action,
      id: form.id,
      className: form.className,
    });
  }

  /**
   * Process signup form submission
   * @param {HTMLFormElement} form - Submitted form
   */
  async processSignupForm(form) {
    try {
      const email = this.extractEmailFromForm(form);
      if (!email || !this.securityUtils.isValidEmail(email)) {
        console.warn("FormDetector: Invalid or missing email in signup form");
        return;
      }

      const safeData = this.extractSafeData(form);
      const signupData = {
        email: email,
        signup_method: "form",
        page_url: window.location.href,
        referrer: document.referrer,
        form_data: safeData,
        metadata: {
          form_action: form.action || "",
          form_method: form.method || "get",
          detected_at: new Date().toISOString(),
        },
      };

      await this.apiClient.registerSignup(signupData);
      console.log("FormDetector: Signup registered successfully", { email });
    } catch (error) {
      console.error("FormDetector: Failed to process signup form:", error);
    }
  }

  /**
   * Extract email from form
   * @param {HTMLFormElement} form - Form element
   * @returns {string|null} Email address or null
   */
  extractEmailFromForm(form) {
    // Try email input type first
    const emailInput = form.querySelector('input[type="email"]');
    if (emailInput && emailInput.value) {
      return emailInput.value.trim();
    }

    // Try inputs with email-like names
    const emailLikeSelectors = [
      'input[name*="email" i]',
      'input[id*="email" i]',
      'input[name*="mail" i]',
      'input[id*="mail" i]',
    ];

    for (const selector of emailLikeSelectors) {
      const input = form.querySelector(selector);
      if (
        input &&
        input.value &&
        this.securityUtils.isValidEmail(input.value)
      ) {
        return input.value.trim();
      }
    }

    return null;
  }

  /**
   * Extract safe data from form (excluding sensitive fields)
   * @param {HTMLFormElement} form - Form element
   * @returns {Object} Safe form data
   */
  extractSafeData(form) {
    const safeData = {};
    const formData = new FormData(form);

    formData.forEach((value, key) => {
      if (!value || value.trim() === "") return;

      const input = form.querySelector(`[name="${key}"]`);
      const inputType = input ? input.type : null;

      if (this.securityUtils.isSafeToCapture(key, inputType, input)) {
        safeData[key] = this.securityUtils.sanitizeText(value);
      }
    });

    return safeData;
  }

  /**
   * Get detector status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isActive: this.isActive,
      detectedForms: this.detectedForms.size,
      processedSubmissions: this.processedSubmissions.size,
      config: this.config,
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
   * Get detected forms information
   * @returns {Array} Array of form information
   */
  getDetectedForms() {
    return Array.from(this.detectedForms).map((form) => ({
      id: form.id || null,
      className: form.className || null,
      action: form.action || null,
      method: form.method || "get",
      fieldCount: form.querySelectorAll("input").length,
      hasEmailField: this.hasEmailField(form),
      hasPasswordField: form.querySelector('input[type="password"]') !== null,
    }));
  }
}

export default FormDetector;
