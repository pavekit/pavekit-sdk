# PaveKit JavaScript SDK

Privacy-compliant user onboarding detection for automated email campaigns.

The PaveKit SDK automatically detects user signups and activity on your website to trigger personalized onboarding email campaigns. Built with privacy-first principles and GDPR compliance.

## Features

- Automatic Signup Detection - Detects form submissions and OAuth completions
- Privacy-First - GDPR compliant with user consent management
- Security Focused - Never captures passwords or sensitive data
- Lightweight - Under 15KB gzipped
- Cross-Browser - Works in all modern browsers
- Mobile Friendly - Optimized for mobile devices
- Easy Integration - One script tag to get started

## Quick Start

### 1. Script Tag Integration (Recommended)

Add the SDK to your website's `<head>` section:

```html
<script src="https://cdn.pavekit.com/sdk/pavekit.min.js"
        data-key="your-api-key"
        data-detect="signups,activity">
</script>
```

That's it! The SDK will automatically:
- Detect user signups on your forms
- Track OAuth authentication completions  
- Monitor user activity (with consent)
- Send data to trigger your email campaigns

### 2. NPM Installation

```bash
npm install @pavekit/sdk
```

```javascript
import PaveKitSDK from '@pavekit/sdk';

const sdk = new PaveKitSDK();
await sdk.init({
  apiKey: 'your-api-key',
  detect: ['signups', 'activity', 'oauth']
});
```

## Configuration Options

### Script Tag Attributes

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-key` | *required* | Your PaveKit API key |
| `data-detect` | `"signups,activity"` | Detection features to enable |
| `data-base-url` | Production URL | API base URL (for development) |
| `data-debug` | `false` | Enable debug logging |
| `data-privacy` | `"gdpr-compliant"` | Privacy compliance mode |
| `data-consent-banner` | `true` | Show consent banner |

### JavaScript Configuration

```javascript
const config = {
  apiKey: 'your-api-key',              // Required: Your API key
  baseURL: 'https://api.pavekit.com',  // API endpoint
  detect: ['signups', 'oauth', 'activity'], // Features to detect
  debug: false,                         // Debug mode
  privacy: 'gdpr-compliant',           // Privacy mode
  consentBanner: true,                 // Show consent banner
  autoCleanup: true                    // Clean sensitive URL params
};

await sdk.init(config);
```

## Detection Features

### Signup Detection (signups)

Automatically detects when users complete signup forms:

- Email field detection - Captures email addresses securely
- Password filtering - Never captures passwords or sensitive data
- Smart form recognition - Distinguishes signup from login forms
- Security validation - Validates all data before capture

What gets detected:
- Registration forms with email + password
- Newsletter signups (if configured)
- Account creation forms
- Trial signup forms

What gets filtered out:
- Login forms
- Password reset forms  
- Contact forms
- Search forms

### OAuth Detection (oauth)

Detects OAuth authentication completions:

- Provider detection - Google, GitHub, Microsoft, Facebook, etc.
- Token-safe - Never accesses OAuth tokens or secrets
- Real-time detection - Catches OAuth redirects immediately
- URL cleanup - Removes sensitive parameters from URLs

Supported OAuth providers:
- Google (oauth_google)
- GitHub (oauth_github) 
- Microsoft (oauth_microsoft)
- Facebook (oauth_facebook)
- Twitter (oauth_twitter)
- Custom OAuth providers

### Activity Tracking (activity)

Privacy-compliant user engagement tracking:

- Time on page - Measures active engagement time
- Scroll depth - Tracks how far users scroll
- Click tracking - Counts safe interactions only
- Visibility detection - Respects page visibility
- Consent required - Only tracks with user permission

Activity metrics:
- Session duration
- Active time (excludes idle time)
- Scroll percentage
- Safe click count
- Page views

## Privacy and Security

### GDPR Compliance

The SDK is built for privacy compliance:

```javascript
// Check consent status
const consent = sdk.getConsentStatus();
console.log(consent.hasConsent);     // User has given consent
console.log(consent.isOptedOut);     // User has opted out
console.log(consent.doNotTrack);     // Browser DNT setting

// Request consent manually
const hasConsent = await sdk.requestConsent();

// Opt out completely
sdk.optOut();

// Delete all user data
sdk.deleteUserData();
```

### Security Features

- No sensitive data - Never captures passwords, tokens, or PII
- Field filtering - Automatically filters sensitive form fields
- Input validation - Validates and sanitizes all captured data
- Secure transmission - HTTPS-only API communication
- Data minimization - Captures only necessary information

### Data Protection

```javascript
// What we NEVER capture:
// - Passwords
// - Credit card numbers
// - OAuth tokens
// - API keys
// - Social security numbers
// - Hidden form fields

// What we DO capture (with consent):
// - Email addresses
// - Names (first/last)
// - Company information
// - Safe form data only
```

## API Reference

### SDK Methods

#### init(config)

Initialize the SDK with configuration:

```javascript
await sdk.init({
  apiKey: 'your-api-key',
  detect: ['signups', 'activity'],
  debug: true
});
```

#### trackSignup(data)

Manually track a signup event:

```javascript
await sdk.trackSignup({
  email: 'user@example.com',
  method: 'manual',
  metadata: {
    source: 'landing-page'
  }
});
```

#### updateUser(data)

Update user information such as name. This allows you to personalize onboarding emails with the user's actual name instead of extracting it from their email address.

```javascript
await sdk.updateUser({
  email: 'user@example.com',
  name: 'John Smith'
});
```

Parameters:
- `email` (required) - User's email address to identify the user
- `name` (optional) - User's display name for email personalization

The name will be used in email templates via the `{{user_name}}` variable.

#### trackConversion(data)

Track conversion events to stop email campaigns:

```javascript
await sdk.trackConversion({
  email: 'user@example.com',
  type: 'purchase',
  value: 99.99,
  currency: 'USD'
});
```

#### setUserEmail(email)

Set user email for activity tracking:

```javascript
sdk.setUserEmail('user@example.com');
```

#### getStatus()

Get current SDK status:

```javascript
const status = sdk.getStatus();
console.log(status);
// {
//   version: '1.0.0',
//   initialized: true,
//   detecting: true,
//   hasConsent: true,
//   detectors: { ... }
// }
```

### Privacy Methods

#### getConsentStatus()

Check privacy consent status:

```javascript
const consent = sdk.getConsentStatus();
console.log(consent);
// {
//   hasConsent: true,
//   isOptedOut: false,
//   consentTimestamp: '2023-...',
//   doNotTrack: false
// }
```

#### optOut() / optIn()

Manage user privacy preferences:

```javascript
// Opt out of all tracking
sdk.optOut();

// Opt back in (requests consent)
const hasConsent = await sdk.optIn();
```

## Template Variables

When users are tracked by the SDK, their information can be used in email templates. The following variables are available:

| Variable | Description | Source |
|----------|-------------|--------|
| `{{user_email}}` | User's email address | Detected from signup form or OAuth |
| `{{user_name}}` | User's display name | Set via `updateUser()` or extracted from email |
| `{{signup_date}}` | Date when user signed up | Automatic |
| `{{company_name}}` | Your company name | Set in PaveKit Profile settings |
| `{{discount_code}}` | Discount code from template | Template configuration |
| `{{discount_value}}` | Discount percentage | Template configuration |
| `{{product_name}}` | Your product name | Set in PaveKit Profile settings |
| `{{support_email}}` | Your support email | Your account email |

### Updating User Name

To personalize emails with the user's actual name (instead of extracting from email), call `updateUser()` after signup:

```javascript
// After detecting a signup or getting user info from your backend
await sdk.updateUser({
  email: 'john.smith@example.com',
  name: 'John Smith'
});
```

This is especially useful when:
- You have the user's name from an OAuth provider
- The user provides their name in a profile form
- You want more personalized onboarding emails

## Advanced Usage

### Custom Event Listeners

Listen for SDK events:

```javascript
// SDK initialized
window.addEventListener('pavekit-initialized', (e) => {
  console.log('SDK ready:', e.detail.version);
});

// Detection started
window.addEventListener('pavekit-detectionStarted', (e) => {
  console.log('Detecting:', e.detail.detectors);
});

// Consent changed
window.addEventListener('pavekit-consent', (e) => {
  console.log('Consent:', e.detail.type);
});
```

### Manual Detection Control

Control detection manually:

```javascript
// Start detection
sdk.startDetection();

// Stop detection
sdk.stopDetection();

// Update configuration
sdk.updateConfig({
  detect: ['signups'], // Only detect signups
  debug: true
});
```

### Custom Privacy Settings

Customize privacy behavior:

```javascript
await sdk.init({
  apiKey: 'your-api-key',
  consentBanner: true,
  privacy: 'gdpr-compliant'
});

// Custom consent request
const hasConsent = await sdk.privacyManager.requestConsent({
  message: 'We use cookies to improve your experience.',
  privacyUrl: '/privacy-policy',
  timeout: 30000
});
```

### Debug Mode

Enable debugging for development:

```javascript
// Via config
await sdk.init({
  apiKey: 'your-api-key',
  debug: true
});

// Get debug information
const debugInfo = sdk.getDebugInfo();
console.log(debugInfo);
```

## Integration Examples

### React Integration

```jsx
import { useEffect } from 'react';
import PaveKitSDK from '@pavekit/sdk';

function App() {
  useEffect(() => {
    const initPaveKit = async () => {
      const sdk = new PaveKitSDK();
      await sdk.init({
        apiKey: process.env.REACT_APP_PAVEKIT_KEY,
        detect: ['signups', 'activity']
      });
      
      // Make SDK available globally
      window.pavekit = sdk;
    };
    
    initPaveKit();
  }, []);

  return <div>Your app content</div>;
}
```

### Vue Integration

```vue
<script>
import PaveKitSDK from '@pavekit/sdk';

export default {
  async mounted() {
    const sdk = new PaveKitSDK();
    await sdk.init({
      apiKey: process.env.VUE_APP_PAVEKIT_KEY,
      detect: ['signups', 'oauth', 'activity']
    });
    
    this.$pavekit = sdk;
  }
}
</script>
```

### Next.js Integration

```javascript
// pages/_app.js
import { useEffect } from 'react';

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // Load SDK after hydration
    if (typeof window !== 'undefined') {
      import('@pavekit/sdk').then(async ({ default: PaveKitSDK }) => {
        const sdk = new PaveKitSDK();
        await sdk.init({
          apiKey: process.env.NEXT_PUBLIC_PAVEKIT_KEY,
          detect: ['signups', 'activity']
        });
      });
    }
  }, []);

  return <Component {...pageProps} />;
}
```

### Capturing User Name from OAuth

When using OAuth providers like Google, you often receive the user's name. Pass it to PaveKit:

```javascript
// After OAuth callback
async function handleOAuthSuccess(oauthUser) {
  // Track the signup
  await window.pavekit.trackSignup({
    email: oauthUser.email,
    method: 'oauth_google'
  });
  
  // Update with the user's actual name from OAuth
  if (oauthUser.name) {
    await window.pavekit.updateUser({
      email: oauthUser.email,
      name: oauthUser.name
    });
  }
}
```

### E-commerce Integration

Track purchases to stop onboarding campaigns:

```javascript
// After successful purchase
await sdk.trackConversion({
  email: customerEmail,
  type: 'purchase',
  value: orderTotal,
  currency: 'USD',
  metadata: {
    orderId: order.id,
    products: order.items.map(item => item.name)
  }
});
```

## Troubleshooting

### Common Issues

SDK not initializing:
```javascript
// Check API key is set
const script = document.querySelector('script[src*="pavekit"]');
console.log(script.dataset.key); // Should show your API key

// Check console for errors
sdk.getDebugInfo(); // Shows detailed status
```

Forms not being detected:
```javascript
// Check detector status
const status = sdk.getStatus();
console.log(status.detectors.form); // Should show isActive: true

// Check form structure
const forms = sdk.detectors.form.getDetectedForms();
console.log(forms); // Shows detected forms
```

Privacy consent issues:
```javascript
// Check consent status
const consent = sdk.getConsentStatus();
console.log(consent);

// Force consent for testing (development only)
sdk.privacyManager.grantConsent('explicit');
```

### Debug Mode

Enable debug mode for detailed logging:

```html
<script src="https://cdn.pavekit.com/sdk/pavekit.min.js"
        data-key="your-api-key"
        data-debug="true">
</script>
```

### Browser Support

Supported browsers:
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

Required features:
- fetch() API
- Promise support
- addEventListener()
- querySelector()

## Testing

### Test Page

Create a test page to verify SDK functionality:

```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.pavekit.com/sdk/pavekit.min.js"
            data-key="your-test-api-key"
            data-debug="true">
    </script>
</head>
<body>
    <h1>SDK Test Page</h1>
    
    <!-- Test signup form -->
    <form id="signup-form" action="/signup" method="post">
        <input type="text" name="name" placeholder="Name">
        <input type="email" name="email" placeholder="Email" required>
        <input type="password" name="password" placeholder="Password" required>
        <button type="submit">Sign Up</button>
    </form>
    
    <script>
        // Check SDK status
        setTimeout(() => {
            if (window.PaveKit) {
                console.log('SDK Status:', window.PaveKit.getStatus());
            }
        }, 1000);
        
        // Test updating user name after form submission
        document.getElementById('signup-form').addEventListener('submit', async (e) => {
            const formData = new FormData(e.target);
            const name = formData.get('name');
            const email = formData.get('email');
            
            if (name && email && window.PaveKit) {
                await window.PaveKit.updateUser({ email, name });
            }
        });
    </script>
</body>
</html>
```

### Manual Testing

Test SDK functions in browser console:

```javascript
// Check if SDK loaded
console.log(window.PaveKit);

// Get status
window.PaveKit.getStatus();

// Test manual tracking
await window.PaveKit.trackSignup({
  email: 'test@example.com',
  method: 'manual'
});

// Test updating user info
await window.PaveKit.updateUser({
  email: 'test@example.com',
  name: 'Test User'
});

// Check activity stats
window.PaveKit.detectors.activity.getActivityStats();
```

## SDK Endpoints

The SDK communicates with the following backend endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/onboarding/sdk/signup` | POST | Register a new user signup |
| `/api/onboarding/sdk/activity` | POST | Track user activity heartbeat |
| `/api/onboarding/sdk/conversion` | POST | Track conversion events |
| `/api/onboarding/sdk/user-info` | POST | Update user information (name) |
| `/api/onboarding/sdk/validate` | GET | Validate API key |

## Links

- Documentation: https://docs.pavekit.com
- Dashboard: https://app.pavekit.com
- Support: https://pavekit.com/support

## License

MIT License - see LICENSE file for details.

---

PaveKit - Automated User Onboarding