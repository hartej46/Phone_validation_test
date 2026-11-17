import type { VerificationSessionResponse, AuthStatusResponse, User } from "./types";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5005";

export async function loginWithPhone(phoneNumber: string): Promise<VerificationSessionResponse> {
  const res = await fetch(`${BACKEND_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ phoneNumber }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to create login session");
  }

  return data;
}

export async function pollAuthStatus(sessionId: string): Promise<AuthStatusResponse> {
  const res = await fetch(`${BACKEND_URL}/auth/status?sessionId=${encodeURIComponent(sessionId)}`, {
    method: "GET",
    credentials: "include",
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || "Failed to get auth status");
  }

  return data;
}

export async function getMe(): Promise<User | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/auth/me`, {
      method: "GET",
      credentials: "include",
    });

    if (res.status === 401) {
      return null;
    }

    const data = await res.json();
    return data.user || null;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await fetch(`${BACKEND_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}
