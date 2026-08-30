import { Suspense } from "react";
import { AuthScreen } from "@/components/auth/auth-screen";
import { AuthProvider } from "@/components/app/auth-provider";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Create account",
};
export default function SignUpPage() {
  return (
    <Suspense>
      <AuthProvider>
        <AuthScreen mode="signup" />
      </AuthProvider>
    </Suspense>
  );
}
