import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import crypto from "crypto";
import { createClient, RedisClientType } from "redis";
import { createApp } from "../src/app.js";
import { createRedisStorageAdapter } from "../src/redis.js";
import { config } from "../src/config.js";

describe("Angelos WhatsApp Authentication Integration Tests", () => {
  let redis: RedisClientType;
  let app: ReturnType<typeof createApp>;

  const testAppSecret = "test_meta_app_secret_123456789";
  const testVerifyToken = "test_verify_token_xyz";
  const testBusinessNumber = "15551234567";

  beforeAll(async () => {
    // Configure test environment variables
    config.whatsappBusinessNumber = testBusinessNumber;
    config.metaWebhookVerifyToken = testVerifyToken;
    config.metaAppSecret = testAppSecret;

    redis = createClient({ url: config.redisUrl });
    await redis.connect();

    const storage = createRedisStorageAdapter(redis);
    app = createApp(redis, storage);
  });

  afterAll(async () => {
    await redis.quit();
  });

  beforeEach(async () => {
    // Clean up test keys
    const keys = await redis.keys("wa_verify:*");
    if (keys.length > 0) {
      await redis.del(keys);
    }
    const pendingKeys = await redis.keys("pending_login:*");
    if (pendingKeys.length > 0) {
      await redis.del(pendingKeys);
    }
    const sessionKeys = await redis.keys("app_session:*");
    if (sessionKeys.length > 0) {
      await redis.del(sessionKeys);
    }
  });

  function createSignedMetaPayload(payload: any, secret: string = testAppSecret) {
    const jsonStr = JSON.stringify(payload);
    const rawBody = Buffer.from(jsonStr, "utf8");
    const signature = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    return { jsonStr, rawBody, signature, jsonData: payload };
  }

  // 1. Valid phone number creates a session
  it("Scenario 1 & 2: Valid phone number creates a session with QR code and WhatsApp links", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ phoneNumber: "+1 (555) 234-5678" });

    expect(res.status).toBe(201);
    expect(res.body.sessionId).toBeDefined();
    expect(res.body.phoneNumber).toBe("15552345678");
    expect(res.body.dataLink).toContain("https://wa.me/15551234567?text=VERIFY");
    expect(res.body.deepLink).toContain("whatsapp://send?phone=15551234567&text=VERIFY");
    expect(res.body.qrLink).toMatch(/^data:image\/png;base64,/);
    expect(res.body.qrSvg).toContain("<svg");
    expect(res.body.expiresAt).toBeGreaterThan(Date.now());
  });

  // 2. Meta webhook verification handshake
  it("handles Meta webhook GET handshake correctly", async () => {
    const challenge = "1158201444";
    const res = await request(app)
      .get("/webhooks/whatsapp")
      .query({
        "hub.mode": "subscribe",
        "hub.verify_token": testVerifyToken,
        "hub.challenge": challenge,
      });

    expect(res.status).toBe(200);
    expect(res.text).toBe(challenge);

    // Invalid verify token
    const invalidRes = await request(app)
      .get("/webhooks/whatsapp")
      .query({
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong_token",
        "hub.challenge": challenge,
      });

    expect(invalidRes.status).toBe(403);
  });

  // 3. Valid WhatsApp message successfully verifies the session
  it("Scenario 3: Valid WhatsApp message successfully verifies the session", async () => {
    const phone = "15553334444";
    const loginRes = await request(app)
      .post("/auth/login")
      .send({ phoneNumber: phone });

    const sessionId = loginRes.body.sessionId;

    // Read stored token from Redis to build realistic WhatsApp reply
    const rawStored = await redis.get(`wa_verify:${phone}`);
    expect(rawStored).toBeTruthy();
    const { token } = JSON.parse(rawStored!);

    const metaPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_ID_TEST",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: testBusinessNumber,
                  phone_number_id: "PHONE_ID_TEST",
                },
                contacts: [{ profile: { name: "Test User" }, wa_id: phone }],
                messages: [
                  {
                    from: phone,
                    id: "wamid.test_msg_1",
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: "text",
                    text: {
                      body: `VERIFY ${sessionId} ${token}`,
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const { jsonStr, signature } = createSignedMetaPayload(metaPayload);

    const webhookRes = await request(app)
      .post("/webhooks/whatsapp")
      .set("x-hub-signature-256", signature)
      .set("Content-Type", "application/json")
      .send(jsonStr);

    expect(webhookRes.status).toBe(200);

    // Now verify that status polling reflects verified state
    const statusRes = await request(app)
      .get("/auth/status")
      .query({ sessionId });

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.status).toBe("verified");
    expect(statusRes.body.phoneNumber).toBe(phone);

    // Cookie should be set
    const cookies = statusRes.headers["set-cookie"];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toContain(config.sessionCookieName);
  });

  // 4. Incorrect verification token is rejected
  it("Scenario 4: Incorrect verification token is rejected", async () => {
    const phone = "15554445555";
    const loginRes = await request(app)
      .post("/auth/login")
      .send({ phoneNumber: phone });

    const sessionId = loginRes.body.sessionId;
    const wrongToken = "999999";

    const metaPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_ID_TEST",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: testBusinessNumber,
                  phone_number_id: "PHONE_ID_TEST",
                },
                contacts: [{ profile: { name: "Test User" }, wa_id: phone }],
                messages: [
                  {
                    from: phone,
                    id: "wamid.test_msg_wrong_token",
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: "text",
                    text: {
                      body: `VERIFY ${sessionId} ${wrongToken}`,
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const { jsonStr, signature } = createSignedMetaPayload(metaPayload);

    const webhookRes = await request(app)
      .post("/webhooks/whatsapp")
      .set("x-hub-signature-256", signature)
      .set("Content-Type", "application/json")
      .send(jsonStr);

    expect(webhookRes.status).toBe(400);
    expect(webhookRes.body.success).toBe(false);
  });

  // 5. Incorrect sender phone number is rejected
  it("Scenario 5: Incorrect sender phone number is rejected", async () => {
    const expectedPhone = "15555556666";
    const imposterPhone = "15559990000";

    const loginRes = await request(app)
      .post("/auth/login")
      .send({ phoneNumber: expectedPhone });

    const sessionId = loginRes.body.sessionId;
    const rawStored = await redis.get(`wa_verify:${expectedPhone}`);
    const { token } = JSON.parse(rawStored!);

    const metaPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_ID_TEST",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: testBusinessNumber,
                  phone_number_id: "PHONE_ID_TEST",
                },
                contacts: [{ profile: { name: "Imposter" }, wa_id: imposterPhone }],
                messages: [
                  {
                    from: imposterPhone, // DIFFERENT SENDER!
                    id: "wamid.test_msg_imposter",
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: "text",
                    text: {
                      body: `VERIFY ${sessionId} ${token}`,
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const { jsonStr, signature } = createSignedMetaPayload(metaPayload);

    const webhookRes = await request(app)
      .post("/webhooks/whatsapp")
      .set("x-hub-signature-256", signature)
      .set("Content-Type", "application/json")
      .send(jsonStr);

    expect(webhookRes.status).toBe(400);
    expect(webhookRes.body.success).toBe(false);
  });

  // 6. Invalid webhook signature is rejected
  it("Scenario 6: Invalid webhook signature is rejected", async () => {
    const phone = "15556667777";
    const loginRes = await request(app)
      .post("/auth/login")
      .send({ phoneNumber: phone });

    const sessionId = loginRes.body.sessionId;
    const rawStored = await redis.get(`wa_verify:${phone}`);
    const { token } = JSON.parse(rawStored!);

    const metaPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_ID_TEST",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: testBusinessNumber,
                  phone_number_id: "PHONE_ID_TEST",
                },
                contacts: [{ profile: { name: "Test" }, wa_id: phone }],
                messages: [
                  {
                    from: phone,
                    id: "wamid.test_sig",
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: "text",
                    text: {
                      body: `VERIFY ${sessionId} ${token}`,
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const jsonStr = JSON.stringify(metaPayload);
    const badSignature = "sha256=0000000000000000000000000000000000000000000000000000000000000000";

    const webhookRes = await request(app)
      .post("/webhooks/whatsapp")
      .set("x-hub-signature-256", badSignature)
      .set("Content-Type", "application/json")
      .send(jsonStr);

    expect(webhookRes.status).toBe(400);
    expect(webhookRes.body.success).toBe(false);
    expect(webhookRes.body.message).toMatch(/signature/i);
  });

  // 7. Expired sessions cannot be verified
  it("Scenario 7: Expired sessions cannot be verified", async () => {
    const phone = "15557778888";
    const loginRes = await request(app)
      .post("/auth/login")
      .send({ phoneNumber: phone });

    const sessionId = loginRes.body.sessionId;

    // Simulate expired session in redis (set expiresAt to past and expire key)
    const rawStored = await redis.get(`wa_verify:${phone}`);
    const stored = JSON.parse(rawStored!);
    stored.expiresAt = Date.now() - 10000;
    await redis.set(`wa_verify:${phone}`, JSON.stringify(stored));

    const metaPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_ID_TEST",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: testBusinessNumber,
                  phone_number_id: "PHONE_ID_TEST",
                },
                contacts: [{ profile: { name: "Test" }, wa_id: phone }],
                messages: [
                  {
                    from: phone,
                    id: "wamid.test_expired",
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: "text",
                    text: {
                      body: `VERIFY ${sessionId} ${stored.token}`,
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const { jsonStr, signature } = createSignedMetaPayload(metaPayload);

    const webhookRes = await request(app)
      .post("/webhooks/whatsapp")
      .set("x-hub-signature-256", signature)
      .set("Content-Type", "application/json")
      .send(jsonStr);

    expect(webhookRes.status).toBe(400);
    expect(webhookRes.body.success).toBe(false);
  });

  // 8. Reusing a successfully verified session is rejected
  it("Scenario 8: Reusing a successfully verified session is rejected", async () => {
    const phone = "15558889999";
    const loginRes = await request(app)
      .post("/auth/login")
      .send({ phoneNumber: phone });

    const sessionId = loginRes.body.sessionId;
    const rawStored = await redis.get(`wa_verify:${phone}`);
    const { token } = JSON.parse(rawStored!);

    const metaPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_ID_TEST",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: testBusinessNumber,
                  phone_number_id: "PHONE_ID_TEST",
                },
                contacts: [{ profile: { name: "Test" }, wa_id: phone }],
                messages: [
                  {
                    from: phone,
                    id: "wamid.test_replay",
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: "text",
                    text: {
                      body: `VERIFY ${sessionId} ${token}`,
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const { jsonStr, signature } = createSignedMetaPayload(metaPayload);

    // First attempt -> Success
    const firstRes = await request(app)
      .post("/webhooks/whatsapp")
      .set("x-hub-signature-256", signature)
      .set("Content-Type", "application/json")
      .send(jsonStr);

    expect(firstRes.status).toBe(200);

    // Second attempt -> Session was already deleted by Angelos on success!
    const secondRes = await request(app)
      .post("/webhooks/whatsapp")
      .set("x-hub-signature-256", signature)
      .set("Content-Type", "application/json")
      .send(jsonStr);

    expect(secondRes.status).toBe(400);
    expect(secondRes.body.success).toBe(false);
  });

  // 9. Multiple login attempts for the same phone number are handled correctly
  it("Scenario 9: Multiple login attempts for the same phone number are rejected while active", async () => {
    const phone = "15551112222";
    const res1 = await request(app)
      .post("/auth/login")
      .send({ phoneNumber: phone });
    expect(res1.status).toBe(201);

    // Attempting again while active returns 409 Conflict
    const res2 = await request(app)
      .post("/auth/login")
      .send({ phoneNumber: phone });
    expect(res2.status).toBe(409);
    expect(res2.body.error).toContain("already exists");
  });

  // 10. Redis storage failures are handled correctly
  it("Scenario 10: Storage failures are handled correctly", async () => {
    // Failing storage adapter
    const failingStorage = {
      async get() { throw new Error("Redis read error"); },
      async setIfAbsent() { throw new Error("Redis connection refused"); },
      async delete() { throw new Error("Redis del error"); },
    };

    const appWithFailingStorage = createApp(redis, failingStorage as any);

    const res = await request(appWithFailingStorage)
      .post("/auth/login")
      .send({ phoneNumber: "15559998888" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to create verification session");
  });

  // 11. Unauthenticated users cannot access the dashboard
  it("Scenario 11: Unauthenticated users cannot access /auth/me", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  // 12. Logout invalidates the application session
  it("Scenario 12: Logout invalidates the application session", async () => {
    const phone = "15551239876";
    const loginRes = await request(app)
      .post("/auth/login")
      .send({ phoneNumber: phone });

    const sessionId = loginRes.body.sessionId;
    const rawStored = await redis.get(`wa_verify:${phone}`);
    const { token } = JSON.parse(rawStored!);

    const metaPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_ID_TEST",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: testBusinessNumber,
                  phone_number_id: "PHONE_ID_TEST",
                },
                contacts: [{ profile: { name: "Alice" }, wa_id: phone }],
                messages: [
                  {
                    from: phone,
                    id: "wamid.test_logout",
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: "text",
                    text: {
                      body: `VERIFY ${sessionId} ${token}`,
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const { jsonStr, signature } = createSignedMetaPayload(metaPayload);

    await request(app)
      .post("/webhooks/whatsapp")
      .set("x-hub-signature-256", signature)
      .set("Content-Type", "application/json")
      .send(jsonStr);

    // Poll status to get session cookie
    const statusRes = await request(app)
      .get("/auth/status")
      .query({ sessionId });

    const cookieHeader = statusRes.headers["set-cookie"][0];
    expect(cookieHeader).toBeDefined();

    // Call /auth/me with cookie -> should succeed
    const meRes = await request(app)
      .get("/auth/me")
      .set("Cookie", [cookieHeader]);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.phoneNumber).toBe(phone);

    // Call /auth/logout
    const logoutRes = await request(app)
      .post("/auth/logout")
      .set("Cookie", [cookieHeader]);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    // Call /auth/me again with old cookie -> should be 401
    const meAfterLogout = await request(app)
      .get("/auth/me")
      .set("Cookie", [cookieHeader]);

    expect(meAfterLogout.status).toBe(401);
  });
});
