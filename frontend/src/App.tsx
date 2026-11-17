import React, { useEffect, useState, useCallback, useRef } from "react";
import { LoginPage } from "./components/LoginPage";
import { VerificationScreen } from "./components/VerificationScreen";
import { Dashboard } from "./components/Dashboard";
import { getMe, loginWithPhone, pollAuthStatus, logout } from "./api";
import type { User, VerificationSessionResponse } from "./types";
import { Loader2 } from "lucide-react";

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeSession, setActiveSession] = useState<VerificationSessionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check existing session cookie on initial mount
  useEffect(() => {
    let isMounted = true;
    getMe()
      .then((existingUser) => {
        if (isMounted) {
          setUser(existingUser);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) {
          setIsInitializing(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Polling logic when a verification session is active
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  useEffect(() => {
    if (!activeSession) {
      stopPolling();
      return;
    }

    setIsPolling(true);
    const sessionId = activeSession.sessionId;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const status = await pollAuthStatus(sessionId);
        if (status.status === "verified") {
          stopPolling();
          setActiveSession(null);
          // Fetch authenticated user info
          const me = await getMe();
          setUser(me);
        } else if (status.status === "not_found") {
          stopPolling();
          setActiveSession(null);
          setError("Verification session timed out or was not found.");
        }
      } catch (err: any) {
        console.error("Polling error:", err);
      }
    }, 2000);

    return () => {
      stopPolling();
    };
  }, [activeSession, stopPolling]);

  const handlePhoneSubmit = async (fullPhoneNumber: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const session = await loginWithPhone(fullPhoneNumber);
      setActiveSession(session);
    } catch (err: any) {
      setError(err.message || "Failed to create verification session");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelVerification = () => {
    stopPolling();
    setActiveSession(null);
    setError(null);
  };

  const handleSessionExpired = () => {
    stopPolling();
    setError("Verification session expired. Please try again.");
    setActiveSession(null);
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setActiveSession(null);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
          <p className="text-xs font-medium text-neutral-400">Loading Angelos authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Main Container */}
      <div className="flex-1 flex items-center justify-center py-8">
        {user ? (
          <Dashboard user={user} onLogout={handleLogout} />
        ) : activeSession ? (
          <VerificationScreen
            session={activeSession}
            onVerified={() => {}}
            onCancel={handleCancelVerification}
            onExpired={handleSessionExpired}
            isPolling={isPolling}
          />
        ) : (
          <LoginPage
            onSessionCreated={setActiveSession}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            error={error}
            setError={setError}
            onSubmit={handlePhoneSubmit}
          />
        )}
      </div>

      {/* Footer */}
      <footer className="text-center py-4">
        <p className="text-xs text-neutral-400">
          Powered by{" "}
          <a
            href="https://www.npmjs.com/package/angelos"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-600 font-medium hover:underline"
          >
            angelos
          </a>{" "}
          • Frictionless WhatsApp phone verification
        </p>
      </footer>
    </div>
  );
};

export default App;
