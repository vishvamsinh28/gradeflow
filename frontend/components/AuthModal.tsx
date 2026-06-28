"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type AuthMode = "login" | "register";

type AuthModalProps = {
  open: boolean;
  initialMode: AuthMode;
  onClose: () => void;
};

export function AuthModal({ open, initialMode, onClose }: AuthModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setError("");
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [initialMode, onClose, open]);

  if (!open) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(mode === "register" ? { full_name: fullName, email, password } : { email, password }),
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] grid place-items-center bg-[#06101dcc] px-4 py-8 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "login" ? "Sign in" : "Create account"}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <form
        className="relative w-full max-w-[460px] rounded-2xl border border-[#8496b02b] bg-[#132338] p-6 shadow-[0_28px_80px_rgba(0,0,0,.4)] sm:p-8"
        onSubmit={submit}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-lg border border-[#8496b026] text-[#8496B0] transition hover:border-[#8496b066] hover:text-[#F8FAFC]"
        >
          ×
        </button>

        <a href="#" className="font-display text-xl font-bold tracking-[-0.5px]">
          Grade<span className="text-[#00C9A7]">Flow</span>
        </a>
        <p className="mt-2 text-sm text-[#8496B0]">Your grading workspace is one step away.</p>

        <div className="mt-7 flex gap-1 rounded-xl border border-[#8496b01f] bg-[#0B1829] p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === "login" ? "bg-[#1E344F] text-[#F8FAFC] shadow" : "text-[#8496B0] hover:text-[#F8FAFC]"}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError("");
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === "register" ? "bg-[#1E344F] text-[#F8FAFC] shadow" : "text-[#8496B0] hover:text-[#F8FAFC]"}`}
          >
            Create account
          </button>
        </div>

        <h2 className="mt-7 font-display text-3xl font-bold tracking-[-1px]">
          {mode === "login" ? "Welcome back" : "Create your teacher account"}
        </h2>
        <p className="mt-2 text-sm text-[#8496B0]">
          {mode === "login" ? "Sign in to continue grading." : "Start with your first class and assignment."}
        </p>

        {mode === "register" && (
          <label className="mt-6 block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Full name</span>
            <input
              className="app-input w-full rounded-xl border border-[#8496b02e] bg-[#0B1829] px-4 py-3 text-[#F8FAFC]"
              required
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </label>
        )}

        <label className={`${mode === "register" ? "mt-4" : "mt-6"} block`}>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Email</span>
          <input
            className="app-input w-full rounded-xl border border-[#8496b02e] bg-[#0B1829] px-4 py-3 text-[#F8FAFC]"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8496B0]">Password</span>
          <input
            className="app-input w-full rounded-xl border border-[#8496b02e] bg-[#0B1829] px-4 py-3 text-[#F8FAFC]"
            type="password"
            minLength={8}
            required
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error && <div className="mt-4 rounded-xl border border-[#f8717159] bg-[#f8717112] px-4 py-3 text-sm text-[#FCA5A5]">{error}</div>}

        <button
          className="mt-6 w-full rounded-xl bg-[#00C9A7] px-5 py-3 font-display font-bold text-[#0B1829] transition hover:-translate-y-0.5 hover:bg-[#00A88C] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy}
        >
          {busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}
