import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import type { StorageAdapter } from "angelos";
import { RedisClientType } from "redis";
import { config } from "./config.js";
import { createVerifier } from "./verifier.js";
import { SessionService, UserSession } from "./session.js";
import { PendingLoginService } from "./pendingLogin.js";

// Extend Request type to hold the unparsed raw buffer
export interface AuthenticatedRequest extends Request {
  rawBody?: Buffer;
  user?: UserSession;
  sessionId?: string;
}

export function createApp(redis: RedisClientType, storageAdapter: StorageAdapter) {
  const app = express();
  const verifier = createVerifier(storageAdapter);
  const sessionService = new SessionService(redis);
  const pendingLoginService = new PendingLoginService(redis);

  // Trust first proxy if running behind tunnel / proxy
  app.set("trust proxy", 1);

  // CORS configuration
  app.use(
    cors({
      origin: config.clientUrl,
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-hub-signature-256"],
    })
  );

  // Cookie parser with session secret
  app.use(cookieParser(config.sessionSecret));

  // JSON Body parser preserving raw body buffer for HMAC verification
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as AuthenticatedRequest).rawBody = buf;
      },
    })
  );

  // Rate limiters
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // Limit each IP to 30 login requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login attempts. Please try again later." },
  });

  const webhookLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 120, // Meta webhooks can send batch bursts
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Authentication middleware
  const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const sessionId = req.signedCookies[config.sessionCookieName] || req.cookies[config.sessionCookieName];
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized: No session found" });
    }

    const session = await sessionService.getSession(sessionId);
    if (!session) {
      res.clearCookie(config.sessionCookieName);
      return res.status(401).json({ error: "Unauthorized: Invalid or expired session" });
    }

    req.user = session;
    req.sessionId = sessionId;
    next();
  };

  /**
   * Health / Info endpoint
   */
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      configuredBusinessNumber: config.whatsappBusinessNumber ? `+${config.whatsappBusinessNumber}` : "NOT_CONFIGURED",
    });
  });

  /**
   * POST /auth/login – Create a verification session.
   * Expects: { phoneNumber: string }
   */
  app.post("/auth/login", authLimiter, async (req: Request, res: Response) => {
    const { phoneNumber } = req.body;

    if (!phoneNumber || typeof phoneNumber !== "string") {
      return res.status(400).json({ error: "Missing or invalid phoneNumber" });
    }

    // Basic phone validation (E.164-ish digits check)
    const digitsOnly = phoneNumber.replace(/\D/g, "");
    if (digitsOnly.length < 8 || digitsOnly.length > 15) {
      return res.status(400).json({ error: "Invalid phone number length" });
    }

    try {
      // Use Angelos createSession
      const sessionResult = await verifier.createSession({
        phoneNumber,
        ttl: config.verificationTtlSeconds,
      });

      // Track pending login to allow browser polling status
      await pendingLoginService.setPending(sessionResult.id, digitsOnly);

      // Return session parameters to the frontend
      // Notice: we do not leak the internal token
      return res.status(201).json({
        sessionId: sessionResult.id,
        phoneNumber: digitsOnly,
        dataLink: sessionResult.dataLink,
        deepLink: sessionResult.deepLink,
        qrLink: sessionResult.qrLink,
        qrSvg: sessionResult.qrSvg,
        expiresAt: sessionResult.expiresAt,
      });
    } catch (error: any) {
      console.error("[Login Session Error]:", error);
      if (
        error?.message?.includes("already active") ||
        error?.message?.includes("already exists") ||
        error?.name === "SessionAlreadyExistsError"
      ) {
        return res.status(409).json({
          error: "An active verification session already exists for this phone number. Please wait or check your WhatsApp.",
        });
      }
      return res.status(500).json({ error: "Failed to create verification session" });
    }
  });

  /**
   * GET /webhooks/whatsapp – Handle Meta webhook verification challenge.
   */
  app.get("/webhooks/whatsapp", (req: Request, res: Response) => {
    const query = {
      "hub.mode": String(req.query["hub.mode"] ?? ""),
      "hub.verify_token": String(req.query["hub.verify_token"] ?? ""),
      "hub.challenge": String(req.query["hub.challenge"] ?? ""),
    };

    const result = verifier.handleWebhookVerification(query);

    if (result.success && result.challenge) {
      return res.status(200).send(result.challenge);
    } else {
      return res.status(403).send("Verification failed");
    }
  });

  /**
   * POST /webhooks/whatsapp – Receive incoming Meta webhook events and verifySession.
   */
  app.post("/webhooks/whatsapp", webhookLimiter, async (req: AuthenticatedRequest, res: Response) => {
    console.log("👉 [Incoming Meta Webhook POST request received]");
    const rawBody = req.rawBody;
    const signature = req.header("x-hub-signature-256") || "";

    if (!rawBody) {
      console.warn("⚠️ Webhook missing rawBody");
      return res.status(400).json({ error: "Missing raw request body" });
    }

    // 1. Verify session using Angelos
    try {
      const result = await verifier.verifySession({
        rawBody,
        signature,
        jsonData: req.body,
      });

      console.log("🔍 Angelos verifySession result:", result);

      if (!result.success) {
        console.warn("[Webhook Verification Failed]:", result.message);
        return res.status(400).json({ success: false, message: result.message });
      }

      // 2. Successful verification from WhatsApp
      const parsed = result.parsedData;
      if (!parsed) {
        return res.status(200).send("EVENT_RECEIVED");
      }

      const senderPhone = parsed.sendersPhoneNumber;

      // Extract sessionId from message text: "VERIFY <sessionId> <token>"
      const textParts = parsed.text.trim().split(/\s+/);
      const sessionIdFromMessage = textParts[1];

      // Create an authenticated application session for this user
      const userSession: UserSession = {
        userId: `user_${senderPhone}`,
        phoneNumber: senderPhone,
        verifiedAt: new Date().toISOString(),
        userAgent: req.headers["user-agent"] || "WhatsApp Cloud API",
        createdAt: new Date().toISOString(),
      };

      const userSessionId = await sessionService.createSession(userSession);

      // If we have sessionId from message, link it in pendingLoginService
      if (sessionIdFromMessage) {
        await pendingLoginService.markVerified(sessionIdFromMessage, userSessionId);
      }

      return res.status(200).send("EVENT_RECEIVED");
    } catch (error: any) {
      console.error("[Webhook Processing Error]:", error);
      return res.status(500).json({ error: "Internal webhook processing error" });
    }
  });

  /**
   * GET /auth/status – Polled by frontend using ?sessionId=xxx to check verification status.
   * When verified, sets the HTTP-only application session cookie.
   */
  app.get("/auth/status", async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      return res.status(400).json({ error: "Missing sessionId parameter" });
    }

    const pending = await pendingLoginService.getPending(sessionId);
    if (!pending) {
      return res.status(404).json({ status: "not_found", message: "Session expired or not found" });
    }

    if (pending.status === "verified" && pending.userSessionId) {
      // Set secure HTTP-only cookie
      res.cookie(config.sessionCookieName, pending.userSessionId, {
        httpOnly: true,
        signed: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: config.sessionTtlSeconds * 1000,
      });

      return res.json({
        status: "verified",
        phoneNumber: pending.phoneNumber,
      });
    }

    return res.json({
      status: "pending",
      phoneNumber: pending.phoneNumber,
    });
  });

  /**
   * GET /auth/me – Return the currently authenticated user.
   */
  app.get("/auth/me", requireAuth, (req: AuthenticatedRequest, res: Response) => {
    return res.json({
      user: req.user,
    });
  });

  /**
   * POST /auth/logout – Log out the authenticated user.
   */
  app.post("/auth/logout", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (req.sessionId) {
      await sessionService.deleteSession(req.sessionId);
    }
    res.clearCookie(config.sessionCookieName);
    return res.json({ success: true, message: "Logged out successfully" });
  });

  return app;
}
