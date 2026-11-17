import WhatsAppOtpVerifier, { type StorageAdapter } from "angelos";
import { config } from "./config.js";

export function createVerifier(storage: StorageAdapter): WhatsAppOtpVerifier {
  return new WhatsAppOtpVerifier({
    businessPhoneNumber: config.whatsappBusinessNumber,
    webhookVerifyToken: config.metaWebhookVerifyToken,
    appSecret: config.metaAppSecret,
    storage,
    defaultTtlSeconds: config.verificationTtlSeconds,
  });
}
