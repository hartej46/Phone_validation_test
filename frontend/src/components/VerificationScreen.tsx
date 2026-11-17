import React, { useEffect, useState } from "react";
import {
  ExternalLink,
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import type { VerificationSessionResponse } from "../types";

interface VerificationScreenProps {
  session: VerificationSessionResponse;
  onVerified: () => void;
  onCancel: () => void;
  onExpired: () => void;
  isPolling: boolean;
}

export const VerificationScreen: React.FC<VerificationScreenProps> = ({
  session,
  onCancel,
  onExpired,
  isPolling,
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    return Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
  });
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        onExpired();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [session.expiresAt, onExpired]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(session.dataLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const isExpired = timeLeft <= 0;

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Top back button */}
      <button
        onClick={onCancel}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Change phone number</span>
      </button>

      <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-6 sm:p-8">
        {/* Verification Status Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs font-semibold mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Waiting for WhatsApp message
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Scan with WhatsApp
          </h2>
          <p className="text-sm text-neutral-500 mt-1.5">
            Verifying: <span className="font-semibold text-neutral-800 font-mono">+{session.phoneNumber}</span>
          </p>
        </div>

        {/* QR Code Container */}
        <div className="relative flex flex-col items-center justify-center p-6 bg-neutral-50/80 rounded-2xl border border-neutral-100 mb-6">
          {session.qrLink ? (
            <div className="relative group">
              <img
                src={session.qrLink}
                alt="WhatsApp Verification QR Code"
                className={`w-56 h-56 rounded-xl border border-neutral-200/60 bg-white p-3 shadow-xs transition-opacity duration-300 ${
                  isExpired ? "opacity-20 grayscale" : "opacity-100"
                }`}
              />
              {isExpired && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-800">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mb-1" />
                  <span className="text-xs font-bold uppercase tracking-wider">Session Expired</span>
                </div>
              )}
            </div>
          ) : (
            <div
              className="w-56 h-56 flex items-center justify-center border border-neutral-200 rounded-xl bg-white p-3"
              dangerouslySetInnerHTML={{ __html: session.qrSvg }}
            />
          )}

          {/* Countdown timer */}
          <div className="mt-4 flex items-center gap-2 text-xs font-medium">
            <Clock className={`w-3.5 h-3.5 ${timeLeft < 30 ? "text-red-500 animate-bounce" : "text-neutral-400"}`} />
            <span className={timeLeft < 30 ? "text-red-600 font-bold" : "text-neutral-500"}>
              {isExpired ? "Session expired" : `Expires in ${formatTime(timeLeft)}`}
            </span>
          </div>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="space-y-3 mb-6 bg-neutral-50 rounded-xl p-4 border border-neutral-200/50">
          <div className="flex items-start gap-3 text-xs text-neutral-700">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-neutral-200 text-neutral-800 font-bold flex items-center justify-center text-[10px]">
              1
            </span>
            <p className="leading-snug">
              Open WhatsApp on your phone and scan the QR code above or tap the button below.
            </p>
          </div>
          <div className="flex items-start gap-3 text-xs text-neutral-700">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-neutral-200 text-neutral-800 font-bold flex items-center justify-center text-[10px]">
              2
            </span>
            <p className="leading-snug">
              Hit <strong className="text-neutral-900">Send</strong> on the pre-filled verification message.
            </p>
          </div>
          <div className="flex items-start gap-3 text-xs text-neutral-700">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-neutral-200 text-neutral-800 font-bold flex items-center justify-center text-[10px]">
              3
            </span>
            <p className="leading-snug">
              Our webhook verifies your sender ID and logs you in automatically.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          {/* Direct WhatsApp Deep Link */}
          <a
            href={session.deepLink || session.dataLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-medium text-sm transition-all shadow-sm hover:shadow cursor-pointer"
          >
            <span>Open WhatsApp Directly</span>
            <ExternalLink className="w-4 h-4" />
          </a>

          {/* Fallback Copy Web Link */}
          <button
            onClick={handleCopyLink}
            type="button"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-medium text-xs transition-colors cursor-pointer"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">Web Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-neutral-500" />
                <span>Copy WhatsApp Web Link</span>
              </>
            )}
          </button>
        </div>

        {/* Live Verification Status Indicator */}
        <div className="mt-6 pt-5 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            {isPolling ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                <span>Listening for Meta webhook event...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-neutral-400" />
                <span>Ready</span>
              </>
            )}
          </div>
          <span className="font-mono text-[11px] text-neutral-400">
            ID: {session.sessionId.slice(0, 8)}...
          </span>
        </div>
      </div>
    </div>
  );
};
