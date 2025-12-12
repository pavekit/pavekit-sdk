/**
 * SecurityUtils - Handles secure data capture and field filtering
 * Ensures GDPR compliance and prevents sensitive data collection
 */
class SecurityUtils {
  constructor() {
    // Sensitive field patterns to avoid (case-insensitive)
    this.SENSITIVE_PATTERNS = [
      'password', 'passwd', 'pwd', 'pass',
      'token', 'secret', 'key', 'auth',
      'credit', 'card', 'cvv', 'cvc', 'ccv',
      'ssn', 'social', 'security',
      'pin', 'code', 'otp',
      'bank', 'account', 'routing',
      'license', 'passport', 'id_number',
      'api_key', 'private', 'hidden'
    ];

    // Safe field patterns we're allowed to capture
    this.SAFE_PATTERNS = [
      'email', 'mail', 'e-mail',
      'name', 'firstname', 'lastname', 'fullname',
      'company', 'organization', 'org',
      'phone', 'tel', 'telephone', 'mobile',
      'website', 'url', 'domain',
      'title', 'position', 'job',
      'industry', 'category'
    ];

    // Safe input types
    this.SAFE_INPUT_TYPES = [
      'email', 'text', 'tel', 'url', 'search'
    ];

    // Blocked input types
    this.BLOCKED_INPUT_TYPES = [
      'password', 'hidden', 'file'
    ];
  }

  /**
   * Check if a field is safe to capture data from
   * @param {string} fieldName - The field name or ID
   * @param {string} fieldType - The input type
   * @param {HTMLElement} element - The DOM element
   * @returns {boolean} True if safe to capture
   */
  isSafeToCapture(fieldName, fieldType, element = null) {
    if (!fieldName && !fieldType) return false;

    const name = (fieldName || '').toLowerCase();
    const type = (fieldType || '').toLowerCase();

    // Block sensitive input types
    if (this.BLOCKED_INPUT_TYPES.includes(type)) {
      return false;
    }

    // Block fields with sensitive names
    if (this.containsSensitivePattern(name)) {
      return false;
    }

    // Additional DOM-based checks if element is provided
    if (element) {
      // Check placeholder text for sensitive content
      const placeholder = (element.placeholder || '').toLowerCase();
      if (this.containsSensitivePattern(placeholder)) {
        return false;
      }

      // Check aria-label for sensitive content
      const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
      if (this.containsSensitivePattern(ariaLabel)) {
        return false;
      }

      // Check if field is hidden or has display:none
      const styles = window.getComputedStyle(element);
      if (styles.display === 'none' || styles.visibility === 'hidden') {
        return false;
      }

      // Check for autocomplete attributes that indicate sensitive data
      const autocomplete = (element.getAttribute('autocomplete') || '').toLowerCase();
      if (autocomplete.includes('current-password') ||
          autocomplete.includes('new-password') ||
          autocomplete.includes('cc-number') ||
          autocomplete.includes('cc-csc')) {
        return false;
      }
    }

    // Allow safe input types
    if (this.SAFE_INPUT_TYPES.includes(type)) {
      return true;
    }

    // Allow fields with safe patterns
    if (this.containsSafePattern(name)) {
      return true;
    }

    // Default to false for unknown patterns
    return false;
  }

  /**
   * Check if text contains sensitive patterns
   * @param {string} text - Text to check
   * @returns {boolean} True if contains sensitive patterns
   */
  containsSensitivePattern(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();

    return this.SENSITIVE_PATTERNS.some(pattern =>
      lowerText.includes(pattern)
    );
  }

  /**
   * Check if text contains safe patterns
   * @param {string} text - Text to check
   * @returns {boolean} True if contains safe patterns
   */
  containsSafePattern(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();

    return this.SAFE_PATTERNS.some(pattern =>
      lowerText.includes(pattern)
    );
  }

  /**
   * Sanitize form data to remove sensitive information
   * @param {Object} formData - Raw form data
   * @param {HTMLFormElement} form - The form element
   * @returns {Object} Sanitized data
   */
  sanitizeFormData(formData, form = null) {
    const sanitized = {};

    Object.keys(formData).forEach(fieldName => {
      const value = formData[fieldName];

      // Skip empty values
      if (!value || value.trim() === '') return;

      // Find corresponding form element if form is provided
      let element = null;
      if (form) {
        element = form.querySelector(`[name="${fieldName}"], #${fieldName}`);
      }

      // Check if field is safe to capture
      const fieldType = element ? element.type : null;
      if (this.isSafeToCapture(fieldName, fieldType, element)) {
        // Additional validation for email fields
        if (this.isEmailField(fieldName, fieldType)) {
          if (this.isValidEmail(value)) {
            sanitized[fieldName] = this.sanitizeEmail(value);
          }
        } else {
          // Sanitize general text fields
          sanitized[fieldName] = this.sanitizeText(value);
        }
      }
    });

    return sanitized;
  }

  /**
   * Check if field is an email field
   * @param {string} fieldName - Field name
   * @param {string} fieldType - Field type
   * @returns {boolean} True if email field
   */
  isEmailField(fieldName, fieldType) {
    const name = (fieldName || '').toLowerCase();
    const type = (fieldType || '').toLowerCase();

    return type === 'email' ||
           name.includes('email') ||
           name.includes('mail');
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} True if valid email
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Sanitize email address
   * @param {string} email - Email to sanitize
   * @returns {string} Sanitized email
   */
  sanitizeEmail(email) {
    return email.toLowerCase().trim();
  }

  /**
   * Sanitize general text
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   */
  sanitizeText(text) {
    // Remove extra whitespace and limit length
    return text.trim().substring(0, 255);
  }

  /**
   * Generate a hash of sensitive data for privacy
   * @param {string} data - Data to hash
   * @returns {string} Hash string
   */
  hashSensitiveData(data) {
    // Simple hash function for client-side use
    let hash = 0;
    if (!data || data.length === 0) return hash.toString();

    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Check if current page URL is safe for tracking
   * @param {string} url - URL to check (defaults to current page)
   * @returns {boolean} True if safe to track
   */
  isSafeURL(url = window.location.href) {
    const lowerUrl = url.toLowerCase();

    // Block sensitive pages
    const sensitivePages = [
      'password', 'reset', 'forgot',
      'payment', 'checkout', 'billing',
      'admin', 'dashboard', 'settings',
      'profile', 'account'
    ];

    return !sensitivePages.some(page => lowerUrl.includes(page));
  }

  /**
   * Extract safe metadata from page
   * @returns {Object} Safe page metadata
   */
  extractSafePageData() {
    return {
      url: this.isSafeURL() ? window.location.href : '[filtered]',
      title: document.title || '',
      referrer: this.isSafeURL(document.referrer) ? document.referrer : '[filtered]',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    };
  }

  /**
   * Check if browser supports required features
   * @returns {boolean} True if browser is supported
   */
  isBrowserSupported() {
    return !!(
      window.fetch &&
      window.Promise &&
      window.addEventListener &&
      document.querySelector
    );
  }

  /**
   * Get security compliance info
   * @returns {Object} Compliance information
   */
  getComplianceInfo() {
    return {
      gdpr_compliant: true,
      data_minimization: true,
      no_sensitive_data: true,
      user_consent_required: true,
      opt_out_available: true,
      data_retention_limited: true
    };
  }
}

export default SecurityUtils;
