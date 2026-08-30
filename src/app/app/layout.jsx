import { AppShell } from "@/components/app/shell";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Workspace",
};
export default function WorkspaceLayout({ children }) {
  return (
    <>
      <AppShell>{children}</AppShell>
    </>
  );
}
