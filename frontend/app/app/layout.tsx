import type { Metadata } from "next";
import { AppShell } from "@/components/app/shell";
import { ApiConfig } from "@/components/api-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workspace",
};

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ApiConfig />
      <AppShell>{children}</AppShell>
    </>
  );
}
