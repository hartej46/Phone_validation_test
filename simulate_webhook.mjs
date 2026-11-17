import crypto from "crypto";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5005";
const META_APP_SECRET = process.env.META_APP_SECRET || "demo_meta_app_secret_456";
const WHATSAPP_BUSINESS_NUMBER = process.env.WHATSAPP_BUSINESS_NUMBER || "15550001234";

async function simulate() {
  const testPhone = process.argv[2] || "+15551234567";
  const cleanPhone = testPhone.replace(/\D/g, "");

  console.log(`\n======================================================`);
  console.log(`🚀 Simulating Meta Webhook for phone: ${testPhone} (${cleanPhone})`);
  console.log(`======================================================\n`);

  // 1. Check if backend is alive
  const healthRes = await fetch(`${BACKEND_URL}/health`);
  const health = await healthRes.json();
  console.log("Backend status:", health);

  // 2. Fetch pending session from Redis or create one
  console.log("\n1. Requesting login session from backend...");
  const loginRes = await fetch(`${BACKEND_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: testPhone }),
  });

  const session = await loginRes.json();
  if (!loginRes.ok) {
    console.error("Failed to create session:", session);
    process.exit(1);
  }

  console.log("Session created successfully:");
  console.log(`- Session ID: ${session.sessionId}`);
  console.log(`- Deep Link: ${session.deepLink}`);
  console.log(`- QR Link available: ${Boolean(session.qrLink)}`);

  // Extract token from deepLink text parameter
  const deepLinkUrl = new URL(session.deepLink);
  const textParam = deepLinkUrl.searchParams.get("text") || "";
  const parts = textParam.trim().split(/\s+/);
  const token = parts[2];
  console.log(`- Extracted Token from session response: ${token}`);

  // 3. Construct genuine Meta Webhook payload
  console.log("\n2. Simulating incoming WhatsApp message payload from Meta...");
  const metaPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_SIMULATION_ID",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: WHATSAPP_BUSINESS_NUMBER,
                phone_number_id: "SIM_PHONE_ID",
              },
              contacts: [
                {
                  profile: { name: "Simulated User" },
                  wa_id: cleanPhone,
                },
              ],
              messages: [
                {
                  from: cleanPhone,
                  id: `wamid.sim_${Date.now()}`,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  type: "text",
                  text: {
                    body: `VERIFY ${session.sessionId} ${token}`,
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
  const rawBody = Buffer.from(jsonStr, "utf8");
  const signature = "sha256=" + crypto.createHmac("sha256", META_APP_SECRET).update(rawBody).digest("hex");

  console.log("Sending signed POST to /webhooks/whatsapp...");
  console.log(`Signature: ${signature}`);

  const webhookRes = await fetch(`${BACKEND_URL}/webhooks/whatsapp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hub-signature-256": signature,
    },
    body: jsonStr,
  });

  const webhookText = await webhookRes.text();
  console.log(`Webhook HTTP status: ${webhookRes.status} -> ${webhookText}`);

  // 4. Poll status
  console.log("\n3. Polling /auth/status endpoint...");
  const statusRes = await fetch(`${BACKEND_URL}/auth/status?sessionId=${session.sessionId}`);
  const statusData = await statusRes.json();
  console.log("Status response:", statusData);

  if (statusData.status === "verified") {
    console.log("\n✅ SUCCESS: Angelos successfully verified the WhatsApp authentication session!");
  } else {
    console.log("\n❌ FAILED: Session was not verified.");
  }
}

simulate().catch(console.error);
