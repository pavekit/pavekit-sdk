/**
 * Backend SDK Tests
 * Tests for the backend-only PaveKit SDK v1.3
 */

const PaveKitAPI = require('../src/core/api.js');

// Mock fetch globally
global.fetch = jest.fn();

describe('PaveKit Backend SDK v1.3', () => {
  let client;

  beforeEach(() => {
    client = new PaveKitAPI();
    fetch.mockClear();
  });

  afterEach(() => {
    client.reset();
  });

  describe('Initialization', () => {
    test('should initialize with API key', () => {
      client.init({
        apiKey: 'test-key',
        baseURL: 'http://localhost:8000'
      });

      const status = client.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.baseURL).toBe('http://localhost:8000');
    });

    test('should throw error without API key', () => {
      expect(() => {
        client.init({});
      }).toThrow('API key is required');
    });

    test('should use default baseURL if not provided', () => {
      client.init({ apiKey: 'test-key' });
      const status = client.getStatus();
      expect(status.baseURL).toBe('http://localhost:8000');
    });
  });

  describe('track() method', () => {
    beforeEach(() => {
      client.init({
        apiKey: 'test-key',
        baseURL: 'http://localhost:8000'
      });
    });

    test('should throw error if not initialized', async () => {
      const uninitializedClient = new PaveKitAPI();
      await expect(
        uninitializedClient.track({ email: 'test@example.com' })
      ).rejects.toThrow('API key not configured');
    });

    test('should throw error if email is missing', async () => {
      await expect(
        client.track({ name: 'Test User' })
      ).rejects.toThrow('Email is required');
    });

    test('should track user with email only (default state: created)', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'User created successfully',
          user_id: '123-456',
          created: true
        })
      });

      const result = await client.track({
        email: 'test@example.com'
      });

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/activity',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-API-Key': 'test-key'
          })
        })
      );

      // Verify body content (parse to avoid order issues)
      const callBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(callBody).toEqual({
        email: 'test@example.com',
        user_state: 'created'
      });

      expect(result.success).toBe(true);
      expect(result.user_id).toBe('123-456');
      expect(client.userId).toBe('123-456');
    });

    test('should track user with name and metadata', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user_id: '123-456',
          created: true
        })
      });

      await client.track({
        email: 'test@example.com',
        name: 'Test User',
        user_state: 'created',
        metadata: {
          plan: 'premium',
          source: 'api'
        }
      });

      // Verify body content (parse to avoid order issues)
      const callBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(callBody).toEqual({
        email: 'test@example.com',
        name: 'Test User',
        user_state: 'created',
        metadata: {
          plan: 'premium',
          source: 'api'
        }
      });
    });

    test('should mark user as converted', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user_id: '123-456',
          created: false
        })
      });

      await client.track({
        email: 'test@example.com',
        user_state: 'converted',
        metadata: {
          plan: 'enterprise',
          value: 999
        }
      });

      // Verify body content (parse to avoid order issues)
      const callBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(callBody).toEqual({
        email: 'test@example.com',
        user_state: 'converted',
        metadata: {
          plan: 'enterprise',
          value: 999
        }
      });
    });

    test('should reject invalid user_state', async () => {
      await expect(
        client.track({
          email: 'test@example.com',
          user_state: 'invalid'
        })
      ).rejects.toThrow("user_state must be 'created' or 'converted'");
    });

    test('should handle API errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key'
      });

      await expect(
        client.track({ email: 'test@example.com' })
      ).rejects.toThrow('HTTP 401: Invalid API key');
    });

    test('should retry on failure', async () => {
      fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, user_id: '123' })
        });

      const result = await client.track({
        email: 'test@example.com'
      });

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
    });

    test('should store and reuse user_id', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          user_id: '123-456',
          created: false
        })
      });

      // First call
      await client.track({
        email: 'test@example.com',
        name: 'User 1'
      });

      expect(client.userId).toBe('123-456');

      // Second call should include user_id
      await client.track({
        email: 'test@example.com',
        name: 'User 1 Updated'
      });

      const secondCallBody = JSON.parse(fetch.mock.calls[1][1].body);
      expect(secondCallBody.user_id).toBe('123-456');
    });
  });

  describe('validate() method', () => {
    beforeEach(() => {
      client.init({
        apiKey: 'test-key',
        baseURL: 'http://localhost:8000'
      });
    });

    test('should validate API key', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          valid: true,
          workspace_id: 123
        })
      });

      const result = await client.validate();

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/validate',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-API-Key': 'test-key'
          })
        })
      );

      expect(result.valid).toBe(true);
      expect(result.workspace_id).toBe(123);
    });

    test('should handle invalid API key', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key'
      });

      await expect(client.validate()).rejects.toThrow('HTTP 401');
    });
  });

  describe('getStatus() method', () => {
    test('should return status', () => {
      client.init({
        apiKey: 'test-key',
        baseURL: 'http://test.com'
      });

      client.userId = '123-456';

      const status = client.getStatus();

      expect(status).toEqual({
        initialized: true,
        baseURL: 'http://test.com',
        userId: '123-456',
        connected: true
      });
    });

    test('should show uninitialized status', () => {
      const status = client.getStatus();
      expect(status.initialized).toBe(false);
    });
  });

  describe('reset() method', () => {
    test('should reset client to initial state', () => {
      client.init({ apiKey: 'test-key' });
      client.userId = '123-456';

      client.reset();

      const status = client.getStatus();
      expect(status.initialized).toBe(false);
      expect(status.userId).toBeNull();
      expect(status.baseURL).toBe('http://localhost:8000');
    });
  });
});
