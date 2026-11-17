import React, { useState } from "react";
import { MessageSquare, ArrowRight, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";

interface LoginPageProps {
  onSessionCreated: (session: any) => void;
  isLoading: boolean;
  setIsLoading: (val: boolean) => void;
  error: string | null;
  setError: (err: string | null) => void;
  onSubmit: (fullPhoneNumber: string) => Promise<void>;
}

const COUNTRY_CODES = [
  { code: "+1", country: "US / CA", flag: "🇺🇸", min: 10, max: 10 },
  { code: "+44", country: "UK", flag: "🇬🇧", min: 10, max: 10 },
  { code: "+91", country: "India", flag: "🇮🇳", min: 10, max: 10 },
  { code: "+49", country: "Germany", flag: "🇩🇪", min: 10, max: 11 },
  { code: "+33", country: "France", flag: "🇫🇷", min: 9, max: 9 },
  { code: "+61", country: "Australia", flag: "🇦🇺", min: 9, max: 9 },
  { code: "+81", country: "Japan", flag: "🇯🇵", min: 10, max: 10 },
  { code: "+55", country: "Brazil", flag: "🇧🇷", min: 10, max: 11 },
  { code: "+971", country: "UAE", flag: "🇦🇪", min: 9, max: 9 },
  { code: "+65", country: "Singapore", flag: "🇸🇬", min: 8, max: 8 },
];

export const LoginPage: React.FC<LoginPageProps> = ({
  isLoading,
  error,
  setError,
  onSubmit,
}) => {
  const [countryCode, setCountryCode] = useState("+1");
  const [phoneNumber, setPhoneNumber] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanNumber = phoneNumber.replace(/\D/g, "");
    if (!cleanNumber) {
      setError("Please enter a valid phone number.");
      return;
    }

    if (cleanNumber.length < 7 || cleanNumber.length > 15) {
      setError("Please check your phone number length.");
      return;
    }

    const fullPhoneNumber = `${countryCode}${cleanNumber}`;
    await onSubmit(fullPhoneNumber);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Brand Header */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 mb-4 shadow-xs">
          <MessageSquare className="w-6 h-6 fill-current" />
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">Angelos</h1>
          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
            WhatsApp Auth
          </span>
        </div>
        <p className="text-xs text-neutral-400 mt-1">Official npm package demonstration</p>
      </div>

      {/* Main Login Card */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-6 sm:p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">Welcome back</h2>
          <p className="text-sm text-neutral-500 mt-1.5">
            Sign in securely with WhatsApp. No passwords, no SMS delay.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
            <div className="leading-snug">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-2">
              Phone Number
            </label>
            <div className="flex gap-2">
              {/* Country Code Select */}
              <div className="relative">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  disabled={isLoading}
                  className="appearance-none bg-neutral-50 border border-neutral-300 hover:border-neutral-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-3 py-3 pr-8 text-sm font-medium text-neutral-800 transition-colors cursor-pointer outline-none disabled:opacity-60"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-500">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>

              {/* Number Input */}
              <input
                type="tel"
                placeholder="555 123 4567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={isLoading}
                autoFocus
                className="flex-1 bg-neutral-50 border border-neutral-300 hover:border-neutral-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors outline-none disabled:opacity-60 font-mono"
              />
            </div>
            <p className="text-xs text-neutral-400 mt-2">
              Must match the WhatsApp account you will send the verification message from.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading || !phoneNumber.trim()}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 text-white font-medium text-sm transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating verification session...</span>
              </>
            ) : (
              <>
                <span>Continue with WhatsApp</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-neutral-100 flex items-center justify-center gap-2 text-xs text-neutral-400">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Encrypted, constant-time token comparison</span>
        </div>
      </div>
    </div>
  );
};
