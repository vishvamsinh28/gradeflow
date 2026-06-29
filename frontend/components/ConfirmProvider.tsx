"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";

type ConfirmTone = "danger" | "primary";
type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};
type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};
type PendingConfirm = Required<ConfirmOptions>;

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);

  const close = (confirmed: boolean) => {
    resolver.current?.(confirmed);
    resolver.current = null;
    setPending(null);
  };

  useEffect(() => {
    if (!pending) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [pending]);

  const value = useMemo<ConfirmContextValue>(() => ({
    confirm(options) {
      if (resolver.current) {
        resolver.current(false);
      }
      setPending({
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? "Confirm",
        cancelLabel: options.cancelLabel ?? "Cancel",
        tone: options.tone ?? "danger",
      });
      return new Promise<boolean>((resolve) => {
        resolver.current = resolve;
      });
    },
  }), []);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending && (
        <div
          aria-labelledby="confirm-title"
          aria-modal="true"
          className="confirm-overlay"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) close(false);
          }}
          role="dialog"
        >
          <section className="confirm-dialog">
            <div className={`confirm-mark confirm-mark-${pending.tone}`} />
            <div>
              <div className="confirm-eyebrow">{pending.tone === "danger" ? "Destructive action" : "Confirm action"}</div>
              <h2 className="confirm-title" id="confirm-title">{pending.title}</h2>
              <p className="confirm-message">{pending.message}</p>
            </div>
            <div className="confirm-actions">
              <button className="app-btn app-btn-ghost" onClick={() => close(false)} type="button">
                {pending.cancelLabel}
              </button>
              <button className={`app-btn ${pending.tone === "danger" ? "app-btn-danger" : "app-btn-primary"}`} onClick={() => close(true)} type="button">
                {pending.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used inside ConfirmProvider");
  }
  return context.confirm;
}
