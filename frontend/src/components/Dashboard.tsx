import React, { useState } from "react";
import {
  ShieldCheck,
  LogOut,
  Phone,
  Calendar,
  Lock,
  CheckCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import type { User } from "../types";

interface DashboardProps {
  user: User;
  onLogout: () => Promise<void>;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-neutral-900 tracking-tight">Angelos Demo</h1>
            <p className="text-xs text-neutral-400">Authenticated Session</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-100 text-neutral-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-60"
        >
          {isLoggingOut ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <LogOut className="w-3.5 h-3.5" />
          )}
          <span>Sign out</span>
        </button>
      </div>

      {/* Main Status Card */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden mb-6">
        <div className="p-6 sm:p-8 border-b border-neutral-100">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-semibold mb-3">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            Verified via WhatsApp
          </div>

          <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Welcome, +{user.phoneNumber}
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            Your WhatsApp identity has been verified through Meta Cloud API webhook and Angelos.
          </p>
        </div>

        {/* Detailed Session Information */}
        <div className="p-6 sm:p-8 bg-neutral-50/50 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Session Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-white border border-neutral-200/70 shadow-2xs">
              <div className="flex items-center gap-2 text-neutral-400 text-xs font-medium mb-1">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Verified Phone</span>
              </div>
              <div className="text-sm font-semibold text-neutral-900 font-mono">
                +{user.phoneNumber}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-neutral-200/70 shadow-2xs">
              <div className="flex items-center gap-2 text-neutral-400 text-xs font-medium mb-1">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Auth Protocol</span>
              </div>
              <div className="text-sm font-semibold text-neutral-900">
                Angelos v1.2.1 (Redis NX)
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-neutral-200/70 shadow-2xs">
              <div className="flex items-center gap-2 text-neutral-400 text-xs font-medium mb-1">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                <span>Verified At</span>
              </div>
              <div className="text-xs font-medium text-neutral-700">
                {new Date(user.verifiedAt).toLocaleString()}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-neutral-200/70 shadow-2xs">
              <div className="flex items-center gap-2 text-neutral-400 text-xs font-medium mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" />
                <span>Session Cookie</span>
              </div>
              <div className="text-xs font-medium text-neutral-700">
                HTTP-Only, Signed
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Package Information & Links */}
      <div className="p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-neutral-900">Testing another phone number?</h4>
          <p className="text-xs text-neutral-500 mt-0.5">
            Log out to test creating sessions and scanning from other WhatsApp accounts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://www.npmjs.com/package/angelos"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-medium transition-colors"
          >
            <span>npm package</span>
            <ExternalLink className="w-3 h-3 text-neutral-400" />
          </a>
          <a
            href="https://github.com/hartej46/angelos"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-medium transition-colors"
          >
            <span>GitHub</span>
            <ExternalLink className="w-3 h-3 text-neutral-400" />
          </a>
        </div>
      </div>
    </div>
  );
};
