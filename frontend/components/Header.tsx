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
          <span className="hidden rounded-full border border-[#00c9a733] bg-[#00c9a714] px-3 py-1 text-xs font-semibold text-[#00C9A7] sm:inline-flex">
            Gemini + LangGraph
          </span>
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
