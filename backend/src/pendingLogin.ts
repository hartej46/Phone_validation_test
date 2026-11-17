import { RedisClientType } from "redis";

export interface PendingLoginData {
  verificationSessionId: string;
  phoneNumber: string;
  createdAt: number;
  status: "pending" | "verified" | "failed";
  userSessionId?: string;
}

const PENDING_PREFIX = "pending_login:";
const PENDING_TTL = 300; // 5 minutes

export class PendingLoginService {
  constructor(private redis: RedisClientType) {}

  async setPending(verificationSessionId: string, phoneNumber: string): Promise<void> {
    const data: PendingLoginData = {
      verificationSessionId,
      phoneNumber,
      createdAt: Date.now(),
      status: "pending",
    };
    await this.redis.set(
      `${PENDING_PREFIX}${verificationSessionId}`,
      JSON.stringify(data),
      { EX: PENDING_TTL }
    );
  }

  async getPending(verificationSessionId: string): Promise<PendingLoginData | null> {
    const raw = await this.redis.get(`${PENDING_PREFIX}${verificationSessionId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PendingLoginData;
    } catch {
      return null;
    }
  }

  async markVerified(verificationSessionId: string, userSessionId: string): Promise<void> {
    const pending = await this.getPending(verificationSessionId);
    if (!pending) return;

    pending.status = "verified";
    pending.userSessionId = userSessionId;

    await this.redis.set(
      `${PENDING_PREFIX}${verificationSessionId}`,
      JSON.stringify(pending),
      { EX: PENDING_TTL }
    );
  }
}
