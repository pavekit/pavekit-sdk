/**
 * ActivityDetector - Tracks user activity and engagement with privacy compliance
 * Monitors page visibility, scroll, clicks, and time on page with user consent
 */
class ActivityDetector {
  constructor(securityUtils, apiClient, privacyManager) {
    this.securityUtils = securityUtils;
    this.apiClient = apiClient;
    this.privacyManager = privacyManager;
    this.isActive = false;
    this.config = {
      heartbeatInterval: 300000, // 5 minutes
      minActivityDuration: 30000, // 30 seconds minimum before tracking
      trackScroll: true,
      trackClicks: true,
      trackTimeOnPage: true,
      trackPageVisibility: true,
      maxInactivityTime: 900000, // 15 minutes max inactivity
      debounceDelay: 1000, // 1 second debounce for events
    };

    this.sessionData = {
      startTime: null,
      lastActivity: null,
      totalActiveTime: 0,
      pageViews: 0,
      scrollDepth: 0,
      clickCount: 0,
      userEmail: null,
      isVisible: true,
    };

    this.intervals = {};
    this.eventHandlers = {};
    this.lastHeartbeat = null;
    this.inactivityTimer = null;
  }

  /**
   * Start activity tracking
   * @param {Object} config - Activity tracking configuration
   * @param {string} userEmail - User email for tracking (optional)
   */
  start(config = {}, userEmail = null) {
    if (this.isActive) return;

    this.config = { ...this.config, ...config };
    this.sessionData.userEmail = userEmail;
    this.isActive = true;

    this.initializeSession();
    this.attachEventListeners();
    this.startHeartbeat();
    this.startInactivityTimer();

    console.log("ActivityDetector: Started tracking user activity");
  }

  /**
   * Stop activity tracking
   */
  stop() {
    if (!this.isActive) return;

    this.isActive = false;
    this.detachEventListeners();
    this.stopHeartbeat();
    this.stopInactivityTimer();
    this.sendFinalActivity();

    console.log("ActivityDetector: Stopped tracking user activity");
  }

  /**
   * Initialize tracking session
   */
  initializeSession() {
    const now = Date.now();
    this.sessionData.startTime = now;
    this.sessionData.lastActivity = now;
    this.sessionData.pageViews = 1;
    this.sessionData.isVisible = !document.hidden;

    // Load previous session data if available
    this.loadSessionData();
  }

  /**
   * Load session data from storage
   */
  loadSessionData() {
    try {
      const stored = sessionStorage.getItem("pavekit_activity_session");
      if (stored) {
        const data = JSON.parse(stored);

        // Merge with current session if within reasonable time
        const timeDiff = Date.now() - data.lastActivity;
        if (timeDiff < this.config.maxInactivityTime) {
          this.sessionData.totalActiveTime += data.totalActiveTime || 0;
          this.sessionData.pageViews += data.pageViews || 0;
          this.sessionData.clickCount += data.clickCount || 0;
          this.sessionData.scrollDepth = Math.max(
            this.sessionData.scrollDepth,
            data.scrollDepth || 0,
          );
        }
      }
    } catch (error) {
      console.warn("ActivityDetector: Failed to load session data:", error);
    }
  }

  /**
   * Save session data to storage
   */
  saveSessionData() {
    try {
      sessionStorage.setItem(
        "pavekit_activity_session",
        JSON.stringify({
          ...this.sessionData,
          savedAt: Date.now(),
        }),
      );
    } catch (error) {
      console.warn("ActivityDetector: Failed to save session data:", error);
    }
  }

  /**
   * Attach event listeners for activity tracking
   */
  attachEventListeners() {
    // Page visibility changes
    if (this.config.trackPageVisibility) {
      this.eventHandlers.visibilityChange =
        this.handleVisibilityChange.bind(this);
      document.addEventListener(
        "visibilitychange",
        this.eventHandlers.visibilityChange,
      );
    }

    // Scroll tracking
    if (this.config.trackScroll) {
      this.eventHandlers.scroll = this.debounce(
        this.handleScroll.bind(this),
        this.config.debounceDelay,
      );
      window.addEventListener("scroll", this.eventHandlers.scroll, {
        passive: true,
      });
    }

    // Click tracking (safe clicks only)
    if (this.config.trackClicks) {
      this.eventHandlers.click = this.handleClick.bind(this);
      document.addEventListener("click", this.eventHandlers.click, true);
    }

    // Mouse movement (for activity detection)
    this.eventHandlers.mouseMove = this.debounce(
      this.updateActivity.bind(this),
      this.config.debounceDelay,
    );
    document.addEventListener("mousemove", this.eventHandlers.mouseMove, {
      passive: true,
    });

    // Keyboard activity
    this.eventHandlers.keyPress = this.debounce(
      this.updateActivity.bind(this),
      this.config.debounceDelay,
    );
    document.addEventListener("keydown", this.eventHandlers.keyPress, {
      passive: true,
    });

    // Page unload
    this.eventHandlers.beforeUnload = this.handleBeforeUnload.bind(this);
    window.addEventListener("beforeunload", this.eventHandlers.beforeUnload);

    // Focus/blur events
    this.eventHandlers.focus = this.updateActivity.bind(this);
    this.eventHandlers.blur = this.handleBlur.bind(this);
    window.addEventListener("focus", this.eventHandlers.focus);
    window.addEventListener("blur", this.eventHandlers.blur);
  }

  /**
   * Detach event listeners
   */
  detachEventListeners() {
    if (this.eventHandlers.visibilityChange) {
      document.removeEventListener(
        "visibilitychange",
        this.eventHandlers.visibilityChange,
      );
    }
    if (this.eventHandlers.scroll) {
      window.removeEventListener("scroll", this.eventHandlers.scroll);
    }
    if (this.eventHandlers.click) {
      document.removeEventListener("click", this.eventHandlers.click, true);
    }
    if (this.eventHandlers.mouseMove) {
      document.removeEventListener("mousemove", this.eventHandlers.mouseMove);
    }
    if (this.eventHandlers.keyPress) {
      document.removeEventListener("keydown", this.eventHandlers.keyPress);
    }
    if (this.eventHandlers.beforeUnload) {
      window.removeEventListener(
        "beforeunload",
        this.eventHandlers.beforeUnload,
      );
    }
    if (this.eventHandlers.focus) {
      window.removeEventListener("focus", this.eventHandlers.focus);
    }
    if (this.eventHandlers.blur) {
      window.removeEventListener("blur", this.eventHandlers.blur);
    }

    this.eventHandlers = {};
  }

  /**
   * Handle page visibility changes
   */
  handleVisibilityChange() {
    const isVisible = !document.hidden;

    if (isVisible && !this.sessionData.isVisible) {
      // Page became visible
      this.sessionData.isVisible = true;
      this.updateActivity();
      this.startHeartbeat();
    } else if (!isVisible && this.sessionData.isVisible) {
      // Page became hidden
      this.sessionData.isVisible = false;
      this.stopHeartbeat();
      this.sendActivityUpdate();
    }
  }

  /**
   * Handle scroll events
   */
  handleScroll() {
    if (!this.config.trackScroll || !this.sessionData.isVisible) return;

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const documentHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
    );
    const windowHeight = window.innerHeight;

    const scrollPercentage = Math.round(
      ((scrollTop + windowHeight) / documentHeight) * 100,
    );
    this.sessionData.scrollDepth = Math.max(
      this.sessionData.scrollDepth,
      scrollPercentage,
    );

    this.updateActivity();
  }

  /**
   * Handle click events (secure clicks only)
   * @param {Event} event - Click event
   */
  handleClick(event) {
    if (!this.config.trackClicks || !this.sessionData.isVisible) return;

    const target = event.target;

    // Only track safe elements (avoid sensitive areas)
    if (this.isSafeClickTarget(target)) {
      this.sessionData.clickCount++;
      this.updateActivity();
    }
  }

  /**
   * Check if click target is safe to track
   * @param {HTMLElement} target - Click target element
   * @returns {boolean} True if safe to track
   */
  isSafeClickTarget(target) {
    if (!target || !target.tagName) return false;

    const tagName = target.tagName.toLowerCase();
    const className = (target.className || "").toLowerCase();
    const id = (target.id || "").toLowerCase();

    // Avoid sensitive elements
    const sensitivePatterns = ["password", "hidden", "token", "key", "secret"];
    const elementText = `${className} ${id}`.toLowerCase();

    if (sensitivePatterns.some((pattern) => elementText.includes(pattern))) {
      return false;
    }

    // Safe elements to track
    const safeElements = [
      "a",
      "button",
      "span",
      "div",
      "p",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
    ];
    return safeElements.includes(tagName);
  }

  /**
   * Handle page blur (window loses focus)
   */
  handleBlur() {
    this.stopHeartbeat();
    this.sendActivityUpdate();
  }

  /**
   * Handle before page unload
   */
  handleBeforeUnload() {
    this.sendFinalActivity();
    this.saveSessionData();
  }

  /**
   * Update activity timestamp
   */
  updateActivity() {
    const now = Date.now();

    if (this.sessionData.lastActivity) {
      const timeDiff = now - this.sessionData.lastActivity;

      // Only count time if user was active (not idle too long)
      if (timeDiff < this.config.maxInactivityTime) {
        this.sessionData.totalActiveTime += timeDiff;
      }
    }

    this.sessionData.lastActivity = now;
    this.restartInactivityTimer();
  }

  /**
   * Start heartbeat for regular activity updates
   */
  startHeartbeat() {
    if (this.intervals.heartbeat) return;

    this.intervals.heartbeat = setInterval(() => {
      if (this.sessionData.isVisible && this.privacyManager.hasConsent()) {
        this.sendActivityUpdate();
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.intervals.heartbeat) {
      clearInterval(this.intervals.heartbeat);
      this.intervals.heartbeat = null;
    }
  }

  /**
   * Start inactivity timer
   */
  startInactivityTimer() {
    this.restartInactivityTimer();
  }

  /**
   * Restart inactivity timer
   */
  restartInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }

    this.inactivityTimer = setTimeout(() => {
      this.handleInactivity();
    }, this.config.maxInactivityTime);
  }

  /**
   * Stop inactivity timer
   */
  stopInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  /**
   * Handle user inactivity
   */
  handleInactivity() {
    console.log("ActivityDetector: User inactive, pausing tracking");
    this.stopHeartbeat();
    this.sendActivityUpdate();
  }

  /**
   * Send activity update to backend
   */
  async sendActivityUpdate() {
    if (!this.privacyManager.hasConsent() || !this.sessionData.userEmail) {
      return;
    }

    // Only send if minimum activity duration is met
    if (this.sessionData.totalActiveTime < this.config.minActivityDuration) {
      return;
    }

    try {
      const activityData = {
        email: this.sessionData.userEmail,
        page_url: this.securityUtils.isSafeURL()
          ? window.location.href
          : "[filtered]",
        activity_data: {
          time_on_page: Math.round(this.sessionData.totalActiveTime / 1000), // seconds
          scroll_depth: this.sessionData.scrollDepth,
          click_count: this.sessionData.clickCount,
          page_views: this.sessionData.pageViews,
          is_visible: this.sessionData.isVisible,
          session_duration: Date.now() - this.sessionData.startTime,
        },
      };

      await this.apiClient.trackActivity(activityData);
      this.lastHeartbeat = Date.now();

      // Save session data after successful update
      this.saveSessionData();
    } catch (error) {
      console.warn("ActivityDetector: Failed to send activity update:", error);
    }
  }

  /**
   * Send final activity data before stopping
   */
  async sendFinalActivity() {
    this.updateActivity(); // Update one last time
    await this.sendActivityUpdate();
  }

  /**
   * Set user email for tracking
   * @param {string} email - User email
   */
  setUserEmail(email) {
    if (this.securityUtils.isValidEmail(email)) {
      this.sessionData.userEmail = email;
    }
  }

  /**
   * Get current activity statistics
   * @returns {Object} Activity statistics
   */
  getActivityStats() {
    this.updateActivity(); // Update current session

    return {
      sessionDuration: Date.now() - this.sessionData.startTime,
      activeTime: this.sessionData.totalActiveTime,
      scrollDepth: this.sessionData.scrollDepth,
      clickCount: this.sessionData.clickCount,
      pageViews: this.sessionData.pageViews,
      isActive: this.isActive,
      isVisible: this.sessionData.isVisible,
      lastActivity: this.sessionData.lastActivity,
      lastHeartbeat: this.lastHeartbeat,
    };
  }

  /**
   * Get detector status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isActive: this.isActive,
      hasUserEmail: !!this.sessionData.userEmail,
      isVisible: this.sessionData.isVisible,
      heartbeatActive: !!this.intervals.heartbeat,
      lastHeartbeat: this.lastHeartbeat,
      config: this.config,
      activityStats: this.getActivityStats(),
    };
  }

  /**
   * Update detector configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };

    if (this.isActive) {
      // Restart heartbeat with new interval if changed
      if (newConfig.heartbeatInterval && this.intervals.heartbeat) {
        this.stopHeartbeat();
        this.startHeartbeat();
      }
    }
  }

  /**
   * Debounce function to limit event frequency
   * @param {Function} func - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Debounced function
   */
  debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * Reset activity tracking session
   */
  resetSession() {
    this.sessionData = {
      startTime: Date.now(),
      lastActivity: Date.now(),
      totalActiveTime: 0,
      pageViews: 1,
      scrollDepth: 0,
      clickCount: 0,
      userEmail: this.sessionData.userEmail, // Keep email
      isVisible: !document.hidden,
    };

    this.saveSessionData();
  }

  /**
   * Pause activity tracking
   */
  pause() {
    if (!this.isActive) return;

    this.stopHeartbeat();
    this.sendActivityUpdate();
    console.log("ActivityDetector: Paused");
  }

  /**
   * Resume activity tracking
   */
  resume() {
    if (!this.isActive) return;

    this.updateActivity();
    this.startHeartbeat();
    console.log("ActivityDetector: Resumed");
  }
}

export default ActivityDetector;
