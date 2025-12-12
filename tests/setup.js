/**
 * Jest test setup file for Onboardly SDK
 * Configures the testing environment and provides global mocks
 */

// Mock DOM environment
require("jest-environment-jsdom");

// Global test utilities and mocks
global.fetch = jest.fn();
global.FormData = jest.fn();
global.URLSearchParams = jest.fn(() => ({
  get: jest.fn(),
  has: jest.fn(),
  toString: jest.fn(() => ""),
}));
global.AbortController = jest.fn(() => ({
  signal: {},
  abort: jest.fn(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock window methods
Object.defineProperty(window, "location", {
  value: {
    href: "http://localhost:3000",
    origin: "http://localhost:3000",
    pathname: "/",
    search: "",
    hash: "",
    assign: jest.fn(),
    replace: jest.fn(),
  },
  writable: true,
});

Object.defineProperty(document, "referrer", {
  value: "",
  writable: true,
});

Object.defineProperty(document, "hidden", {
  value: false,
  writable: true,
});

Object.defineProperty(navigator, "userAgent", {
  value: "Mozilla/5.0 (Test Environment)",
  writable: true,
});

Object.defineProperty(navigator, "doNotTrack", {
  value: null,
  writable: true,
});

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now()),
  getEntriesByType: jest.fn(() => [
    {
      loadEventStart: Date.now() - 1000,
    },
  ]),
};

// Mock MutationObserver
global.MutationObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  takeRecords: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock getComputedStyle
global.getComputedStyle = jest.fn(() => ({
  display: "block",
  visibility: "visible",
}));

// Mock CustomEvent
global.CustomEvent = jest.fn((type, options) => ({
  type,
  detail: options?.detail || {},
  bubbles: options?.bubbles || false,
  cancelable: options?.cancelable || false,
}));

// Mock setTimeout and setInterval for testing
jest.useFakeTimers();

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();

  // Reset localStorage
  localStorageMock.getItem.mockReturnValue(null);
  localStorageMock.setItem.mockImplementation(() => {});
  localStorageMock.removeItem.mockImplementation(() => {});
  localStorageMock.clear.mockImplementation(() => {});

  // Reset sessionStorage
  sessionStorageMock.getItem.mockReturnValue(null);
  sessionStorageMock.setItem.mockImplementation(() => {});
  sessionStorageMock.removeItem.mockImplementation(() => {});
  sessionStorageMock.clear.mockImplementation(() => {});

  // Reset fetch mock
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
    text: async () => "Success",
  });

  // Reset document properties
  Object.defineProperty(document, "referrer", {
    value: "",
    writable: true,
  });

  Object.defineProperty(document, "hidden", {
    value: false,
    writable: true,
  });

  // Reset window location
  Object.defineProperty(window, "location", {
    value: {
      href: "http://localhost:3000",
      origin: "http://localhost:3000",
      pathname: "/",
      search: "",
      hash: "",
    },
    writable: true,
  });

  // Reset navigator properties
  Object.defineProperty(navigator, "doNotTrack", {
    value: null,
    writable: true,
  });
});

// Clean up after each test
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.useFakeTimers();
});

// Global test helpers
global.testHelpers = {
  // Create a mock form element
  createMockForm: (options = {}) => {
    const form = document.createElement("form");
    form.action = options.action || "/signup";
    form.method = options.method || "post";
    form.id = options.id || "test-form";

    if (options.email !== false) {
      const emailInput = document.createElement("input");
      emailInput.type = "email";
      emailInput.name = "email";
      emailInput.value = options.email || "test@example.com";
      form.appendChild(emailInput);
    }

    if (options.password !== false) {
      const passwordInput = document.createElement("input");
      passwordInput.type = "password";
      passwordInput.name = "password";
      passwordInput.value = "testpassword123";
      form.appendChild(passwordInput);
    }

    if (options.name) {
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.name = "name";
      nameInput.value = options.name;
      form.appendChild(nameInput);
    }

    return form;
  },

  // Simulate form submission
  simulateFormSubmit: (form) => {
    const event = new Event("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    return event;
  },

  // Simulate OAuth callback URL
  simulateOAuthCallback: (provider = "google", code = "test_code") => {
    const url = `http://localhost:3000?code=${code}&state=test_state`;
    Object.defineProperty(window, "location", {
      value: {
        href: url,
        origin: "http://localhost:3000",
        pathname: "/",
        search: `?code=${code}&state=test_state`,
        hash: "",
      },
      writable: true,
    });

    Object.defineProperty(document, "referrer", {
      value: `https://accounts.${provider}.com/oauth/authorize`,
      writable: true,
    });
  },

  // Wait for async operations
  waitFor: (condition, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        if (condition()) {
          resolve();
        } else if (Date.now() - start >= timeout) {
          reject(new Error("Timeout waiting for condition"));
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  },

  // Mock API responses
  mockAPIResponse: (endpoint, response) => {
    global.fetch.mockImplementation((url) => {
      if (url.includes(endpoint)) {
        return Promise.resolve({
          ok: true,
          json: async () => response,
          text: async () => JSON.stringify(response),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
        text: async () => "Success",
      });
    });
  },

  // Mock API error
  mockAPIError: (endpoint, error) => {
    global.fetch.mockImplementation((url) => {
      if (url.includes(endpoint)) {
        return Promise.reject(new Error(error));
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    });
  },
};

// Console spy for testing logs
global.consoleSpy = {
  log: jest.spyOn(console, "log").mockImplementation(() => {}),
  warn: jest.spyOn(console, "warn").mockImplementation(() => {}),
  error: jest.spyOn(console, "error").mockImplementation(() => {}),
};
