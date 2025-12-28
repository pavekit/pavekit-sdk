# PaveKit Backend SDK v1.3

**Backend-only SDK for server-side user activity tracking.**

Track user signups and conversions from your Node.js backend, API routes, or serverless functions. This SDK is designed exclusively for server-side use with a simple state-based approach.

## Installation

```bash
npm install @pavekit/sdk
```

## Quick Start

```javascript
const PaveKit = require('@pavekit/sdk');

// Initialize
const pavekit = new PaveKit();
pavekit.init({
  apiKey: process.env.PAVEKIT_API_KEY,
  baseURL: process.env.PAVEKIT_API_URL || 'https://api.pavekit.com'
});

// Track user signup
await pavekit.track({
  email: 'user@example.com',
  name: 'John Doe',
  user_state: 'created',
  metadata: {
    signup_source: 'api',
    plan: 'premium'
  }
});
```

## API Reference

### `init(config)`

Initialize the SDK with your API key.

```javascript
pavekit.init({
  apiKey: 'your-api-key',      // Required
  baseURL: 'api-endpoint',      // Optional, defaults to localhost:8000
  timeout: 10000                // Optional, request timeout in ms
});
```

### `track(data)`

Track user activity. This is the main method for all tracking operations.

**Parameters:**
- `email` (string, required) - User's email address
- `name` (string, optional) - User's full name
- `metadata` (object, optional) - Custom data to store with the user
- `user_state` (string, optional) - User state: `'created'` or `'converted'` (defaults to `'created'`)

**Returns:** Promise with `{ success, message, user_id, created }`

**User States:**
- `'created'` - User has signed up (default state)
- `'converted'` - User has completed a conversion action (stops email campaigns)

**Examples:**

```javascript
// Track new user signup (default state: created)
await pavekit.track({
  email: 'user@example.com',
  name: 'John Doe',
  metadata: {
    signup_method: 'api',
    utm_source: 'google',
    plan_interest: 'premium'
  }
});

// Explicitly set state to created
await pavekit.track({
  email: 'user@example.com',
  name: 'John Doe',
  user_state: 'created',
  metadata: {
    signup_source: 'oauth',
    signup_method: 'google'
  }
});

// Update user with additional data
await pavekit.track({
  email: 'user@example.com',
  metadata: {
    company: 'Acme Inc',
    role: 'Engineering Manager',
    team_size: '10-50'
  }
});

// Mark user as converted (stops email campaigns)
await pavekit.track({
  email: 'user@example.com',
  user_state: 'converted',
  metadata: {
    plan: 'enterprise',
    value: 999,
    currency: 'USD'
  }
});
```

### `validate()`

Validate your API key.

```javascript
const result = await pavekit.validate();
// { success: true, valid: true, workspace_id: 123 }
```

### `getStatus()`

Get current SDK status.

```javascript
const status = pavekit.getStatus();
// { initialized: true, baseURL: '...', userId: '...', connected: true }
```

## Framework Integration

### Express.js

```javascript
const express = require('express');
const PaveKit = require('@pavekit/sdk');

const app = express();
app.use(express.json());

const pavekit = new PaveKit();
pavekit.init({
  apiKey: process.env.PAVEKIT_API_KEY,
  baseURL: process.env.PAVEKIT_API_URL
});

app.post('/api/signup', async (req, res) => {
  const { email, name } = req.body;

  try {
    await pavekit.track({
      email,
      name,
      user_state: 'created',
      metadata: {
        signup_source: 'api',
        ip: req.ip
      }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/purchase', async (req, res) => {
  const { email, plan, amount } = req.body;

  try {
    await pavekit.track({
      email,
      user_state: 'converted',
      metadata: {
        plan,
        amount,
        currency: 'USD'
      }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Next.js API Routes

```javascript
// pages/api/signup.js
import PaveKit from '@pavekit/sdk';

const pavekit = new PaveKit();
pavekit.init({
  apiKey: process.env.PAVEKIT_API_KEY,
  baseURL: process.env.PAVEKIT_API_URL
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, name } = req.body;

  try {
    const result = await pavekit.track({
      email,
      name,
      user_state: 'created',
      metadata: {
        signup_source: 'web',
        page: '/signup'
      }
    });

    res.status(200).json({ success: true, user_id: result.user_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

### Next.js App Router (Server Actions)

```typescript
// app/actions.ts
'use server'

import PaveKit from '@pavekit/sdk';

const pavekit = new PaveKit();
pavekit.init({
  apiKey: process.env.PAVEKIT_API_KEY!,
  baseURL: process.env.PAVEKIT_API_URL!
});

export async function trackSignup(email: string, name: string) {
  try {
    await pavekit.track({
      email,
      name,
      user_state: 'created',
      metadata: {
        signup_source: 'app'
      }
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function trackConversion(email: string, plan: string, amount: number) {
  try {
    await pavekit.track({
      email,
      user_state: 'converted',
      metadata: {
        plan,
        amount,
        currency: 'USD'
      }
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
```

### Nuxt 3 Server Routes

```javascript
// server/api/track.post.ts
import PaveKit from '@pavekit/sdk';

const pavekit = new PaveKit();
pavekit.init({
  apiKey: process.env.PAVEKIT_API_KEY,
  baseURL: process.env.PAVEKIT_API_URL
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  try {
    const result = await pavekit.track({
      email: body.email,
      name: body.name,
      user_state: body.user_state || 'created',
      metadata: body.metadata || {}
    });

    return { success: true, user_id: result.user_id };
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: error.message
    });
  }
});
```

### Cloudflare Workers

```javascript
import PaveKit from '@pavekit/sdk';

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const pavekit = new PaveKit();
    pavekit.init({
      apiKey: env.PAVEKIT_API_KEY,
      baseURL: env.PAVEKIT_API_URL
    });

    const { email, name, user_state, metadata } = await request.json();

    try {
      const result = await pavekit.track({
        email,
        name,
        user_state: user_state || 'created',
        metadata
      });

      return Response.json({ success: true, user_id: result.user_id });
    } catch (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }
};
```

### AWS Lambda

```javascript
const PaveKit = require('@pavekit/sdk');

const pavekit = new PaveKit();
pavekit.init({
  apiKey: process.env.PAVEKIT_API_KEY,
  baseURL: process.env.PAVEKIT_API_URL
});

exports.handler = async (event) => {
  const { email, name, user_state, metadata } = JSON.parse(event.body);

  try {
    const result = await pavekit.track({
      email,
      name,
      user_state: user_state || 'created',
      metadata
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, user_id: result.user_id })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

## User States Explained

The SDK uses a simple state-based system for tracking users:

### `created` (Default State)
- User has signed up or been created
- Email campaigns will be sent to users in this state
- This is the default state if not specified

### `converted`
- User has completed a conversion action (purchase, subscription, etc.)
- Email campaigns will automatically stop for converted users
- Once converted, the user won't receive nurture emails

**State Transitions:**
```
created → converted (one-way, cannot be reversed)
```

## Metadata Examples

The `metadata` field accepts any JSON-serializable object. Use it to store custom attributes:

```javascript
await pavekit.track({
  email: 'user@example.com',
  name: 'John Doe',
  user_state: 'created',
  metadata: {
    // User attributes
    company: 'Acme Inc',
    role: 'Engineering Manager',
    team_size: '10-50',
    industry: 'SaaS',

    // Behavioral data
    features_used: ['analytics', 'exports', 'api'],
    last_login: new Date().toISOString(),

    // Marketing attribution
    utm_source: 'google',
    utm_campaign: 'summer-2024',
    utm_medium: 'cpc',

    // Custom business logic
    trial_end_date: '2024-12-31',
    onboarding_completed: false,

    // Nested objects
    preferences: {
      email_notifications: true,
      theme: 'dark'
    }
  }
});
```

## Error Handling

The SDK throws errors for failed requests. Always use try-catch:

```javascript
try {
  await pavekit.track({
    email: 'user@example.com',
    name: 'John Doe'
  });
} catch (error) {
  console.error('PaveKit tracking failed:', error.message);
  // Handle error (log, retry, etc.)
}
```

Common errors:
- `API key not configured` - Call `init()` first
- `Email is required` - Missing required email parameter
- `user_state must be 'created' or 'converted'` - Invalid state value
- `Invalid API key` - Check your API key
- `HTTP 500` - Server error, check backend logs

## Environment Variables

Recommended setup:

```bash
# .env
PAVEKIT_API_KEY=pk_live_xxxxxxxxxxxxx
PAVEKIT_API_URL=https://api.pavekit.com

# or for local development
PAVEKIT_API_URL=http://localhost:8000
```

## Best Practices

### 1. Initialize Once

Initialize the SDK once at application startup:

```javascript
// utils/pavekit.js
const PaveKit = require('@pavekit/sdk');

const pavekit = new PaveKit();
pavekit.init({
  apiKey: process.env.PAVEKIT_API_KEY,
  baseURL: process.env.PAVEKIT_API_URL
});

module.exports = pavekit;
```

Then import and use:

```javascript
const pavekit = require('./utils/pavekit');

await pavekit.track({
  email: 'user@example.com',
  user_state: 'created'
});
```

### 2. Use Metadata Effectively

Store all custom data in metadata:

```javascript
await pavekit.track({
  email: 'user@example.com',
  name: 'John Doe',
  user_state: 'created',
  metadata: {
    // Everything specific to your business
    signup_source: 'landing-page-a',
    plan: 'premium',
    company_size: '50-100',
    industry: 'fintech'
  }
});
```

### 3. Track Conversions

Mark users as converted to stop email campaigns:

```javascript
// After successful purchase/subscription
await pavekit.track({
  email: 'user@example.com',
  user_state: 'converted',
  metadata: {
    plan: 'enterprise',
    mrr: 999,
    payment_method: 'stripe'
  }
});
```

### 4. Fire and Forget (Optional)

For non-critical tracking, you can use fire-and-forget:

```javascript
// Don't await if you don't need to block
pavekit.track({
  email: 'user@example.com',
  user_state: 'created',
  metadata: { page: '/dashboard' }
}).catch(err => console.error('Tracking failed:', err));

// Or use Promise.allSettled for multiple tracks
await Promise.allSettled([
  pavekit.track({ email: 'user1@example.com', user_state: 'created' }),
  pavekit.track({ email: 'user2@example.com', user_state: 'created' })
]);
```

## API Endpoint

The SDK communicates with:
- `POST /api/v1/activity` - Unified tracking endpoint
- `GET /api/v1/validate` - API key validation

## TypeScript Support

TypeScript definitions included:

```typescript
import PaveKit from '@pavekit/sdk';

interface TrackData {
  email: string;
  name?: string;
  metadata?: Record<string, any>;
  user_state?: 'created' | 'converted';
}

const pavekit = new PaveKit();
pavekit.init({
  apiKey: process.env.PAVEKIT_API_KEY!,
  baseURL: process.env.PAVEKIT_API_URL
});

await pavekit.track({
  email: 'user@example.com',
  name: 'John Doe',
  user_state: 'created',
  metadata: {
    plan: 'premium'
  }
} as TrackData);
```

## Testing

Test your integration:

```javascript
// Validate API key first
const validation = await pavekit.validate();
console.log('API key valid:', validation.valid);

// Test tracking
const result = await pavekit.track({
  email: 'test@example.com',
  name: 'Test User',
  user_state: 'created',
  metadata: {
    test: true
  }
});
console.log('User tracked:', result.user_id);
```

## Migration from v1.x

If you're upgrading from v1.x, here are the changes:

**Removed:**
- `template_name` / `template_friendly_name` parameters
- `trackSignupWithTemplate()` method
- `getTemplateByFriendlyName()` method
- `generateFriendlyName()` method
- `conversion_status` boolean parameter

**Added:**
- `user_state` parameter with values: `'created'` or `'converted'`

**Migration examples:**

```javascript
// v1.x (old)
await pavekit.track({
  email: 'user@example.com',
  conversion_status: true
});

// v1.3 (new)
await pavekit.track({
  email: 'user@example.com',
  user_state: 'converted'
});
```

## Support

- **Documentation**: https://docs.pavekit.com
- **API Reference**: https://docs.pavekit.com/api/v1
- **Issues**: https://github.com/pavekit/pavekit-sdk/issues

## License

MIT
