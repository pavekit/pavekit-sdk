# PaveKit SDK Configuration

This document describes all configuration options for the PaveKit SDK.

## Required Options

### apiKey
- Type: `string`
- Required: Yes
- Description: Your PaveKit API key.

Example:
```javascript
const sdk = new PaveKitSDK({
  apiKey: 'ok_your_api_key_here'
});
```

## Detection Options

### detect
- Type: `boolean`
- Default: `true`
- Description: Enable automatic signup detection.

### detectForms
- Type: `boolean`
- Default: `true`
- Description: Detect form submissions.

### detectOAuth
- Type: `boolean`
- Default: `true`
- Description: Detect OAuth callbacks.

## Privacy Options

### privacy
- Type: `object`
- Description: Privacy settings for data handling.

#### privacy.hashEmails
- Type: `boolean`
- Default: `true`
- Description: Hash emails before sending them to the server.

#### privacy.respectDNT
- Type: `boolean`
- Default: `false`
- Description: Honor the browser's Do Not Track setting.

#### privacy.allowedDomains
- Type: `array`
- Default: `null`
- Description: List of domains where the SDK is allowed to run.

## Other Options

### apiUrl
- Type: `string`
- Default: `'https://api.pavekit.com'`
- Description: Base URL for the PaveKit API.

### debug
- Type: `boolean`
- Default: `false`
- Description: Enable debug logging to the console.
