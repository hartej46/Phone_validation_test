export interface User {
  userId: string;
  phoneNumber: string;
  verifiedAt: string;
  userAgent?: string;
  createdAt: string;
}

export interface VerificationSessionResponse {
  sessionId: string;
  phoneNumber: string;
  dataLink: string;
  deepLink: string;
  qrLink: string;
  qrSvg: string;
  expiresAt: number; // Unix timestamp in ms
}

export interface AuthStatusResponse {
  status: "pending" | "verified" | "not_found";
  phoneNumber?: string;
  message?: string;
}
