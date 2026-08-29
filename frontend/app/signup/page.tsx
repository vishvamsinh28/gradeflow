import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthScreen } from "@/components/auth/auth-screen";
import { AuthProvider } from "@/components/app/auth-provider";
import { ApiConfig } from "@/components/api-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <Suspense>
      <ApiConfig />
      <AuthProvider>
        <AuthScreen mode="signup" />
      </AuthProvider>
    </Suspense>
  );
}
