import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthScreen } from "@/components/auth/auth-screen";
import { AuthProvider } from "@/components/app/auth-provider";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <Suspense>
      <AuthProvider>
        <AuthScreen mode="signin" />
      </AuthProvider>
    </Suspense>
  );
}
