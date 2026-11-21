# WhatsApp Authentication Demo with Angelos

[![Live Demo](https://img.shields.io/badge/Live%20Demo-phone--validation--test.vercel.app-25D366?style=for-the-badge&logo=vercel&logoColor=white)](https://phone-validation-test.vercel.app/)

> 🌐 **Live Demo:** [https://phone-validation-test.vercel.app](https://phone-validation-test.vercel.app/)  
> 🚀 **Backend API:** [https://phone-validation-test.onrender.com](https://phone-validation-test.onrender.com)

A production-style demonstration of passwordless, SMS-free authentication using the published npm package [`angelos`](https://www.npmjs.com/package/angelos).

Users sign in using their phone number and verify their identity by sending a short, cryptographically verified message through WhatsApp.

---

## Architecture & Verification Flow

```
+--------------------+        +---------------------+        +--------------------+
|  Browser Frontend  |        |   Express Backend   |        |  In-Memory Storage  |
| (React+TS+Tailwind)|        |  (Angelos Verifier) |        |     (TTL + NX)      |
+--------------------+        +---------------------+        +--------------------+
         |                               |                              |
         | 1. POST /auth/login {phone}   |                              |
         |------------------------------>|                              |
         |                               | 2. createSession({phone})    |
         |                               |    setIfAbsent(NX, EX=180)   |
         |                               |----------------------------->|
         | 3. Returns QR + Links + Expiry|                              |
         |<------------------------------|                              |
         |                               |                              |
         | 4. Displays QR / Deep Link    |                              |
         |    User sends WhatsApp msg    |                              |
         |                               |                              |
         |                               |                              |
+--------------------+        +---------------------+                   |
| WhatsApp Cloud API |        |   Express Backend   |                   |
+--------------------+        +---------------------+                   |
         |                               |                              |
         | 5. POST /webhooks/whatsapp    |                              |
         |    (X-Hub-Signature-256)      |                              |
         |------------------------------>|                              |
         |                               | 6. verifySession(rawBody)    |
         |                               |    - validates HMAC sha256   |
         |                               |    - constant-time compare   |
         |                               |    - atomic session delete   |
         |                               |----------------------------->|
         | 7. 200 EVENT_RECEIVED         |                              |
         |<------------------------------|                              |
         |                               |                              |
+--------------------+                   |                              |
|  Browser Frontend  |                   |                              |
+--------------------+                   |                              |
         |                               |                              |
         | 8. GET /auth/status?sessionId |                              |
         |------------------------------>|                              |
         | 9. HTTP-Only Cookie set       |                              |
         |<------------------------------|                              |
         |                               |                              |
         | 10. Redirect to /dashboard    |                              |
         |     GET /auth/me              |                              |
         |------------------------------>|                              |
```

---

## Features

- **Genuine Angelos Integration:** Uses the actual `angelos` npm package for session creation, QR generation, constant-time verification, and session replay protection.
- **In-House Memory Storage Adapter:** Zero-dependency `StorageAdapter` implementing atomic `setIfAbsent`, TTL expiration, and session replay prevention without requiring an external database.
- **Signature Verification:** Preserves pristine HTTP raw buffer before JSON parsing to validate Meta's `X-Hub-Signature-256` HMAC sha256 header.
- **Session Replay & Timing Attack Protection:** Sessions are deleted atomically upon verification. Comparisons use constant-time operations.
- **Modern Minimal UI:** Clean, responsive design inspired by minimal modern web guidelines using Tailwind CSS, country code selection, QR view, countdown timer, and protected dashboard.
- **12 Comprehensive Automated Tests:** Covers all integration scenarios specified in the test plan with realistic Meta webhook payloads.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **Backend:** Node.js, Express, TypeScript, Vitest, Supertest
- **Authentication Core:** `angelos` npm package
- **Persistence:** Redis (`redis` v4 client)

---

## Getting Started

### Prerequisites

- Node.js 18+
- Redis server running locally (`redis-server` on port 6379) or remote Redis URL

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/hartej46/angelos.git
cd angelos-auth-demo

# Install all dependencies (backend + frontend)
npm run install:all
```

### 2. Environment Configuration

Copy `.env.example` in `backend/`:

```bash
cp backend/.env.example backend/.env
```

Configure the values:

```env
PORT=5000
CLIENT_URL=http://localhost:5173

# Your WhatsApp Business number registered in Meta (digits only without +)
WHATSAPP_BUSINESS_NUMBER=15551234567

# Webhook Verify Token configured in Meta App Dashboard
META_WEBHOOK_VERIFY_TOKEN=your_custom_verify_token

# Meta App Secret (App settings > Basic > App Secret)
META_APP_SECRET=your_meta_app_secret

# Cookie session signing secret
SESSION_SECRET=your_random_session_secret
```

### 3. Running the Application

In separate terminal tabs:

```bash
# Start backend (http://localhost:5000)
npm run dev:backend

# Start frontend (http://localhost:5173)
npm run dev:frontend
```

---

## Meta WhatsApp Business Webhook Setup

To test with real WhatsApp accounts and messages:

1. **Create a Meta App:**
   - Go to [Meta for Developers](https://developers.facebook.com/).
   - Create an app of type **Business**.
   - Add the **WhatsApp** product.

2. **Configure WhatsApp Cloud API:**
   - Note down your test/production **WhatsApp Business Phone Number**. Set this as `WHATSAPP_BUSINESS_NUMBER`.
   - Go to **App settings > Basic** and copy your **App Secret**. Set this as `META_APP_SECRET`.

3. **Expose Localhost using an HTTPS Tunnel:**
   Meta requires a publicly accessible HTTPS callback URL. Use [ngrok](https://ngrok.com/) or Cloudflare Tunnels:

   ```bash
   ngrok http 5000
   ```

   Copy the forwarding HTTPS URL, e.g., `https://abc-123.ngrok-free.app`.

4. **Register the Webhook in Meta:**
   - In Meta Dashboard, go to **WhatsApp > Configuration**.
   - Under **Webhook**, click **Edit**.
   - **Callback URL:** `https://abc-123.ngrok-free.app/webhooks/whatsapp`
   - **Verify Token:** Enter the value from `META_WEBHOOK_VERIFY_TOKEN`.
   - Click **Verify and Save**. Meta will send a GET request which Angelos verifies via `handleWebhookVerification()`.
   - Under **Webhook fields**, click **Manage** and subscribe to **`messages`**.

5. **Test End-to-End:**
   - Open `http://localhost:5173`.
   - Enter your personal WhatsApp phone number.
   - Scan the QR code with WhatsApp or tap **Open WhatsApp Directly**.
   - Send the pre-filled `VERIFY <session-id> <token>` message.
   - Meta forwards the message to your webhook, Angelos verifies the session, and your browser redirects to `/dashboard`.

---

## Automated Testing

Run the Vitest test suite executing all 12 validation scenarios:

```bash
npm run test
```

### Test Scenarios Covered

1. Valid phone number creates a verification session.
2. QR code (`qrLink` and `qrSvg`) and WhatsApp deep links are generated correctly.
3. Valid WhatsApp message verifies the session and establishes application session.
4. Incorrect verification token is rejected.
5. Incorrect sender phone number is rejected.
6. Invalid webhook HMAC signature is rejected.
7. Expired sessions cannot be verified.
8. Reusing a successfully verified session is rejected (replay attack prevention).
9. Multiple login attempts for the same active phone number are rejected (409 Conflict).
10. Redis storage failures are handled gracefully (500).
11. Unauthenticated users cannot access `/auth/me` (401).
12. Logout invalidates application session cookie.

---

## Simulated Webhook Test Script

If you don't have a Meta Business Account configured yet, you can test the entire flow locally using the included simulation script:

```bash
# Start backend in one terminal
npm run dev:backend

# Run the simulation in another terminal
node simulate_webhook.mjs "+15551234567"
```

This generates a valid session via `createSession()`, reads the stored token from Redis, creates a real Meta webhook event, signs it with `META_APP_SECRET` using `sha256` HMAC, calls `POST /webhooks/whatsapp`, and validates the verified response.

---

## License

MIT
