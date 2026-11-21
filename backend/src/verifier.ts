import { createRequire } from "module";
import type WhatsAppOtpVerifierType from "angelos";
import type { StorageAdapter } from "angelos";
import { config } from "./config.js";

const require = createRequire(import.meta.url);
const ImportedVerifier = require("angelos");
const WhatsAppOtpVerifier = (ImportedVerifier.default || ImportedVerifier) as typeof WhatsAppOtpVerifierType;

export function createVerifier(storage: StorageAdapter): WhatsAppOtpVerifierType {
  return new WhatsAppOtpVerifier({
    businessPhoneNumber: config.whatsappBusinessNumber,
    webhookVerifyToken: config.metaWebhookVerifyToken,
    appSecret: config.metaAppSecret,
    storage,
    defaultTtlSeconds: config.verificationTtlSeconds,
  });
}
