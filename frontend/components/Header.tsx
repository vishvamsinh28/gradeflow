"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, clearAuthToken } from "@/lib/api";

export function Header() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function closeOnOutsideClick(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    function closeOnDesktopResize() {
      if (window.innerWidth > 520) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnDesktopResize);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnDesktopResize);
    };
  }, [menuOpen]);

  async function logout() {
    setMenuOpen(false);
    setSigningOut(true);
    try {
      await api<void>("/auth/logout", { method: "POST" });
    } finally {
      clearAuthToken();
    }
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[#8496b026] bg-[#0b1829e6] backdrop-blur-xl">
      <div ref={menuRef} className="relative mx-auto flex h-16 w-[min(1180px,92vw)] items-center justify-between gap-4">
        <Link href="/dashboard" className="shrink-0 font-display text-xl font-bold tracking-[-0.5px]" onClick={() => setMenuOpen(false)}>
          Grade<span className="text-[#00C9A7]">Flow</span>
        </Link>
        <div className="header-nav-desktop items-center gap-3">
          <Link href="/guide" className="app-btn app-btn-ghost">
            Guide
          </Link>
          <Link href="/review" className="app-btn app-btn-ghost">
            Review
          </Link>
          <Link href="/settings" className="app-btn app-btn-ghost">
            Settings
          </Link>
          <button
            onClick={logout}
            className="app-btn app-btn-ghost"
            disabled={signingOut}
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
        <button
          type="button"
          className="header-menu-button app-btn app-btn-ghost app-btn-sm"
          aria-expanded={menuOpen}
          aria-label="Toggle navigation menu"
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span className="header-menu-lines" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
        {menuOpen ? (
          <div className="header-menu-panel absolute right-0 top-[calc(100%+8px)] flex-col">
            <Link href="/guide" className="header-menu-item app-btn app-btn-ghost app-btn-full" onClick={() => setMenuOpen(false)}>
              Guide
            </Link>
            <Link href="/review" className="header-menu-item app-btn app-btn-ghost app-btn-full" onClick={() => setMenuOpen(false)}>
              Review
            </Link>
            <Link href="/settings" className="header-menu-item app-btn app-btn-ghost app-btn-full" onClick={() => setMenuOpen(false)}>
              Settings
            </Link>
            <button
              onClick={logout}
              className="header-menu-item app-btn app-btn-ghost app-btn-full"
              disabled={signingOut}
            >
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
