import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "5005", 10),
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  whatsappBusinessNumber: process.env.WHATSAPP_BUSINESS_NUMBER || process.env.WHATSAPP_PHONE_NUMBER || "",
  metaWebhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN || "",
  metaAppSecret: process.env.META_APP_SECRET || "",
  metaWhatsappPhoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID || "",
  metaWhatsappTemplateName: process.env.META_WHATSAPP_TEMPLATE_NAME || "",
  metaWhatsappTemplateLanguage: process.env.META_WHATSAPP_TEMPLATE_LANGUAGE || "en_US",
  metaGraphApiVersion: process.env.META_GRAPH_API_VERSION || "v22.0",
  sessionSecret: process.env.SESSION_SECRET || "default_dev_secret_key_12345",
  sessionCookieName: "angelos_demo_sid",
  sessionTtlSeconds: 86400, // 24 hours
  verificationTtlSeconds: 180, // 3 minutes
};
