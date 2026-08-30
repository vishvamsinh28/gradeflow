import { Suspense } from "react";
import { AuthScreen } from "@/components/auth/auth-screen";
import { AuthProvider } from "@/components/app/auth-provider";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Sign in",
};
export default function SignInPage() {
  return (
    <Suspense>
      <AuthProvider>
        <AuthScreen mode="signin" />
      </AuthProvider>
    </Suspense>
  );
}
