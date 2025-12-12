# PaveKit SDK API Examples

This document contains examples of using the PaveKit SDK.

## Basic Usage

```javascript
// Initialize the SDK with your API key
const sdk = new PaveKitSDK({
  apiKey: 'ok_your_api_key_here',
  detect: true
});

// Start detection
sdk.init();
```

## Manual Tracking

```javascript
// Track a custom signup event
sdk.track('signup', {
  email: 'user@example.com',
  method: 'custom',
  metadata: {
    plan: 'pro',
    referrer: 'affiliate'
  }
});
```

## Privacy Settings

```javascript
// Configure privacy options
const sdk = new PaveKitSDK({
  apiKey: 'ok_your_api_key_here',
  privacy: {
    hashEmails: true,
    respectDNT: false,
    allowedDomains: ['yourdomain.com']
  }
});
```

## Event Detection

```javascript
// Enable automatic detection
const sdk = new PaveKitSDK({
  apiKey: 'ok_your_api_key_here',
  detect: true,
  detectForms: true,  // Detect form submissions
  detectOAuth: true   // Detect OAuth callbacks
});
```
