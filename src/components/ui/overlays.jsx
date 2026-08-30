"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Button, IconButton, cx } from "./primitives";
import { IconAlert, IconCheckCircle, IconX } from "./icons";

/* ---------- Shared overlay behaviour ---------- */

function useOverlay(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const { overflow, paddingRight } = document.body.style;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    const frame = requestAnimationFrame(() => {
      // An explicit [data-autofocus] always wins; a single combined selector
      // would just return whichever focusable element comes first in the DOM.
      const target =
        ref.current?.querySelector("[data-autofocus]") ??
        ref.current?.querySelector("input:not([type=hidden]), textarea, select, button");
      target?.focus();
    });
    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !ref.current) return;
      const focusable = Array.from(
        ref.current.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      previous?.focus?.();
    };
  }, [open, onClose]);
  return ref;
}
function Portal({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

/* ---------- Dialog ---------- */

export function Dialog({ open, onClose, title, description, children, footer, width = 480 }) {
  const ref = useOverlay(open, onClose);
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
        <div className="anim-fade fixed inset-0 bg-scrim backdrop-blur-[2px]" onClick={onClose} />
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          style={{
            maxWidth: width,
          }}
          className="anim-pop relative z-10 my-auto w-full rounded-xl border border-line bg-surface shadow-lg"
        >
          <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
            <div>
              <h2 className="text-[15.5px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
              {description ? (
                <p className="mt-1 text-[13px] leading-snug text-ink-3">{description}</p>
              ) : null}
            </div>
            <IconButton label="Close" size="sm" onClick={onClose} className="-mr-1 -mt-0.5">
              <IconX size={15} />
            </IconButton>
          </div>
          <div className="px-5 pb-5">{children}</div>
          {footer ? (
            <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2/60 px-5 py-3">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </Portal>
  );
}

/* ---------- Sheet ---------- */

export function Sheet({ open, onClose, title, description, children, footer, width = 620 }) {
  const ref = useOverlay(open, onClose);
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[200] flex justify-end">
        <div
          className="anim-fade absolute inset-0 bg-scrim backdrop-blur-[2px]"
          onClick={onClose}
        />
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          style={{
            maxWidth: width,
          }}
          className="anim-fade-up relative z-10 flex h-full w-full flex-col border-l border-line bg-surface shadow-lg sm:m-2 sm:h-[calc(100%-16px)] sm:rounded-xl sm:border"
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
            <div>
              <h2 className="text-[15.5px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
              {description ? (
                <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{description}</p>
              ) : null}
            </div>
            <IconButton label="Close" size="sm" onClick={onClose} className="-mr-1">
              <IconX size={15} />
            </IconButton>
          </div>
          <div className="flex-1 overflow-y-auto">{children}</div>
          {footer ? (
            <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2/60 px-5 py-3">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </Portal>
  );
}

/* ---------- Toasts ---------- */

const ToastContext = createContext(() => {});
export function useToast() {
  return useContext(ToastContext);
}
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);
  const push = useCallback((message, tone = "info") => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((current) => [
      ...current,
      {
        id,
        message,
        tone,
      },
    ]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <Portal>
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[300] flex w-[min(400px,calc(100vw-32px))] -translate-x-1/2 flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role="status"
              className="anim-fade-up pointer-events-auto flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[13px] font-medium text-ink shadow-lg"
            >
              <span
                className={cx(
                  "shrink-0",
                  toast.tone === "error"
                    ? "text-danger"
                    : toast.tone === "success"
                      ? "text-accent"
                      : "text-ink-3",
                )}
              >
                {toast.tone === "error" ? <IconAlert size={15} /> : <IconCheckCircle size={15} />}
              </span>
              <span className="flex-1 leading-snug">{toast.message}</span>
              <button
                onClick={() =>
                  setToasts((current) => current.filter((item) => item.id !== toast.id))
                }
                aria-label="Dismiss"
                className="shrink-0 text-ink-4 transition-colors hover:text-ink"
              >
                <IconX size={14} />
              </button>
            </div>
          ))}
        </div>
      </Portal>
    </ToastContext.Provider>
  );
}

/* ---------- Confirm ---------- */

const ConfirmContext = createContext(async () => false);
export function useConfirm() {
  return useContext(ConfirmContext);
}
export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const confirm = useCallback(
    (input) =>
      new Promise((resolve) =>
        setRequest({
          ...input,
          resolve,
        }),
      ),
    [],
  );
  const settle = useCallback(
    (value) => {
      request?.resolve(value);
      setRequest(null);
    },
    [request],
  );
  const value = useMemo(() => confirm, [confirm]);
  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Dialog
        open={request !== null}
        onClose={() => settle(false)}
        title={request?.title ?? ""}
        width={420}
        footer={
          <>
            <Button size="sm" onClick={() => settle(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant={request?.danger ? "danger" : "primary"}
              onClick={() => settle(true)}
              data-autofocus
            >
              {request?.confirmLabel ?? "Confirm"}
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-ink-2">{request?.body}</p>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
