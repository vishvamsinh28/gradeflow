"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input, cx } from "@/components/ui/primitives";
import { IconAlert, IconEye, IconEyeOff, Logo } from "@/components/ui/icons";
import { NightPanel } from "./night-panel";
import { useAuth } from "@/components/app/auth-provider";
import { clearCache } from "@/lib/workspace";
import {
  AuthError,
  signIn,
  signUp,
  validateEmail,
  validateName,
  validatePassword,
} from "@/lib/auth";
export function AuthScreen({ mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const isSignUp = mode === "signup";
  // Only same-origin paths: `?next=https://evil.example` after a successful
  // login would otherwise be followed, which is a phishing gift.
  const requested = searchParams.get("next") ?? "";
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/app";
  async function submit(event) {
    event.preventDefault();
    setFormError(null);
    const found = {};
    if (isSignUp) {
      const nameError = validateName(fullName);
      if (nameError) found.fullName = nameError;
    }
    const emailError = validateEmail(email);
    if (emailError) found.email = emailError;
    const passwordError = isSignUp
      ? validatePassword(password)
      : password
        ? null
        : "Password is required";
    if (passwordError) found.password = passwordError;
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      const user = isSignUp
        ? await signUp({
            fullName,
            email,
            password,
          })
        : await signIn({
            email,
            password,
          });
      // A previous account's workspace may still be cached in this tab.
      clearCache();
      setUser(user);
      router.replace(next);
    } catch (error) {
      setFormError(
        error instanceof AuthError ? error.message : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-h-svh bg-paper p-3 sm:p-4">
      <div className="grid min-h-[calc(100svh-24px)] gap-4 lg:grid-cols-2 lg:gap-6">
        <div className="flex flex-col">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 px-1 py-1">
              <Logo size={22} />
              <span className="text-[15.5px] font-semibold tracking-[-0.03em] text-ink">
                GradeFlow
              </span>
            </Link>
          </div>

          <div className="flex flex-1 items-center justify-center px-1 py-10 sm:px-6">
            <div className="w-full max-w-[380px]">
              <h1 className="font-display text-[38px] text-ink sm:text-[44px]">
                {isSignUp ? "Create your account" : "Welcome back"}
              </h1>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
                {isSignUp
                  ? "One account holds every classroom, test and mark you grade."
                  : "Sign in to pick up where your marking left off."}
              </p>

              <form className="mt-8 grid gap-4" onSubmit={submit} noValidate>
                {isSignUp ? (
                  <Field label="Your name" hint={errors.fullName}>
                    <Input
                      autoFocus
                      autoComplete="name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Meera Nair"
                      aria-invalid={Boolean(errors.fullName)}
                      className={errors.fullName ? "border-danger" : undefined}
                    />
                  </Field>
                ) : null}

                <Field label="Email" hint={errors.email}>
                  <Input
                    autoFocus={!isSignUp}
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@school.edu"
                    aria-invalid={Boolean(errors.email)}
                    className={errors.email ? "border-danger" : undefined}
                  />
                </Field>

                <Field
                  label="Password"
                  hint={errors.password ?? (isSignUp ? "At least 8 characters." : undefined)}
                >
                  <div className="relative">
                    <Input
                      type={revealed ? "text" : "password"}
                      autoComplete={isSignUp ? "new-password" : "current-password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={revealed ? "your password" : "••••••••"}
                      aria-invalid={Boolean(errors.password)}
                      className={cx("pr-10", errors.password && "border-danger")}
                    />
                    <button
                      type="button"
                      onClick={() => setRevealed((value) => !value)}
                      aria-label={revealed ? "Hide password" : "Show password"}
                      aria-pressed={revealed}
                      title={revealed ? "Hide password" : "Show password"}
                      className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                    >
                      {revealed ? <IconEyeOff size={15} /> : <IconEye size={15} />}
                    </button>
                  </div>
                </Field>

                {formError ? (
                  <p
                    role="alert"
                    className="flex items-start gap-2 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-[13px] leading-snug text-danger"
                  >
                    <IconAlert size={14} className="mt-[2px] shrink-0" />
                    {formError}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={busy}
                  className="mt-1 w-full"
                >
                  {isSignUp ? "Create account" : "Sign in"}
                </Button>
              </form>

              <p className="mt-6 text-[13.5px] text-ink-3">
                {isSignUp ? "Already have an account? " : "New to GradeFlow? "}
                <Link
                  href={isSignUp ? "/signin" : "/signup"}
                  className="font-medium text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-accent"
                >
                  {isSignUp ? "Sign in" : "Create an account"}
                </Link>
              </p>
            </div>
          </div>
        </div>

        <NightPanel />
      </div>
    </div>
  );
}
