import crypto from "crypto";
import { RedisClientType } from "redis";
import { config } from "./config.js";

export interface UserSession {
  userId: string;
  phoneNumber: string;
  verifiedAt: string;
  userAgent?: string;
  createdAt: string;
}

const SESSION_PREFIX = "app_session:";

export class SessionService {
  constructor(private redis: RedisClientType) {}

  generateSessionId(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  async createSession(session: UserSession): Promise<string> {
    const sessionId = this.generateSessionId();
    const key = `${SESSION_PREFIX}${sessionId}`;
    await this.redis.set(key, JSON.stringify(session), {
      EX: config.sessionTtlSeconds,
    });
    return sessionId;
  }

  async getSession(sessionId: string): Promise<UserSession | null> {
    const key = `${SESSION_PREFIX}${sessionId}`;
    const data = await this.redis.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as UserSession;
    } catch {
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const key = `${SESSION_PREFIX}${sessionId}`;
    const res = await this.redis.del(key);
    return res > 0;
  }
}
