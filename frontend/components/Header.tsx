"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export function Header() {
  const router = useRouter();

  async function logout() {
    await api<void>("/auth/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[#8496b026] bg-[#0b1829e6] backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-[min(1180px,92vw)] items-center justify-between gap-4">
        <Link href="/dashboard" className="font-display text-xl font-bold tracking-[-0.5px]">
          Grade<span className="text-[#00C9A7]">Flow</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/review" className="app-btn app-btn-ghost">
            Review
          </Link>
          <Link href="/settings" className="app-btn app-btn-ghost">
            Settings
          </Link>
          <button
            onClick={logout}
            className="app-btn app-btn-ghost"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
