import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "5005", 10),
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  whatsappBusinessNumber: process.env.WHATSAPP_BUSINESS_NUMBER || process.env.WHATSAPP_PHONE_NUMBER || "",
  metaWebhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN || "",
  metaAppSecret: process.env.META_APP_SECRET || "",
  sessionSecret: process.env.SESSION_SECRET || "default_dev_secret_key_12345",
  sessionCookieName: "angelos_demo_sid",
  sessionTtlSeconds: 86400, // 24 hours
  verificationTtlSeconds: 180, // 3 minutes
};
