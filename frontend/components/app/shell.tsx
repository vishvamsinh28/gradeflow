"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Button, Kbd, Menu, MenuItem, MenuSeparator, cx } from "@/components/ui/primitives";
import { ConfirmProvider, ToastProvider, useConfirm, useToast } from "@/components/ui/overlays";
import {
  IconChevronDown,
  IconLogout,
  IconPlus,
  IconSearch,
  IconTrash,
  Logo,
} from "@/components/ui/icons";
import { CommandPalette } from "./command-palette";
import { AddStudentsSheet } from "./add-students-sheet";
import { CreateClassroomDialog, CreateTestDialog } from "./create-dialogs";
import { clearCache, removeClassroom, useClassrooms } from "@/lib/workspace";
import { AuthProvider, useAuth } from "./auth-provider";
import type { Classroom } from "@/lib/types";

/* ---------- Actions available from anywhere in the app ---------- */

type WorkspaceActions = {
  newClassroom: () => void;
  newTest: () => void;
  addStudents: () => void;
  openPalette: () => void;
};

const ActionsContext = createContext<WorkspaceActions>({
  newClassroom: () => {},
  newTest: () => {},
  addStudents: () => {},
  openPalette: () => {},
});

export function useWorkspaceActions() {
  return useContext(ActionsContext);
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <ShellBody>{children}</ShellBody>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

function ShellBody({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, status } = useAuth();
  const firstName = user?.fullName.trim().split(/\s+/)[0] ?? "there";
  const { data: classrooms, loading } = useClassrooms();
  const pathname = usePathname();

  // The workspace is per-account, so there is nothing to show without one.
  useEffect(() => {
    if (status === "anonymous") router.replace("/signin");
  }, [status, router]);

  const slug = useMemo(() => {
    const parts = (pathname ?? "").split("/").filter(Boolean);
    return parts[0] === "app" ? parts[1] : undefined;
  }, [pathname]);

  const classroom = classrooms?.find((item) => item.slug === slug);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [classroomOpen, setClassroomOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [studentsOpen, setStudentsOpen] = useState(false);

  const actions = useMemo<WorkspaceActions>(
    () => ({
      newClassroom: () => setClassroomOpen(true),
      newTest: () => setTestOpen(true),
      addStudents: () => setStudentsOpen(true),
      openPalette: () => setPaletteOpen(true),
    }),
    [],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((value) => !value);
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      // Single-key shortcuts must not fire underneath an open dialog or sheet.
      if (document.querySelector('[role="dialog"]')) return;

      // Single-key shortcuts, the way a keyboard-first tool should work.
      if (event.key === "c") {
        event.preventDefault();
        setClassroomOpen(true);
      } else if (event.key === "t" && classroom) {
        event.preventDefault();
        setTestOpen(true);
      } else if (event.key === "/") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [classroom]);

  return (
    <ActionsContext.Provider value={actions}>
      <div className="flex min-h-svh flex-col">
        <TopBar classroom={classroom} onSearch={() => setPaletteOpen(true)} />
        <main className="flex-1">
          {status === "authenticated" && !(loading && !classrooms) ? children : <ShellSkeleton />}
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        classroom={classroom}
        onNewClassroom={actions.newClassroom}
        onNewTest={actions.newTest}
        onAddStudents={actions.addStudents}
      />
      <CreateClassroomDialog open={classroomOpen} onClose={() => setClassroomOpen(false)} />
      <CreateTestDialog open={testOpen} onClose={() => setTestOpen(false)} classroom={classroom} />
      <AddStudentsSheet open={studentsOpen} onClose={() => setStudentsOpen(false)} classroom={classroom} />
    </ActionsContext.Provider>
  );
}

/* ---------- Top bar ---------- */

function TopBar({ classroom, onSearch }: { classroom?: Classroom; onSearch: () => void }) {
  const { data: classrooms, reload } = useClassrooms();
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const { user, signOut } = useAuth();
  const { newClassroom } = useWorkspaceActions();

  async function clearAll() {
    const ok = await confirm({
      title: "Delete every classroom?",
      body: "Every classroom, student, test, mark and answer sheet in your account is removed from the server. This cannot be undone.",
      confirmLabel: "Delete everything",
      danger: true,
    });
    if (!ok) return;
    try {
      for (const item of classrooms ?? []) await removeClassroom(item.id);
      await reload();
      router.push("/app");
      toast("Workspace cleared", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not clear the workspace", "error");
    }
  }


  return (
    <header className="sticky top-0 z-[100] border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-[var(--topbar-h)] w-full max-w-[1360px] items-center gap-1 px-4 sm:px-6">
        <Link
          href="/app"
          className="flex shrink-0 items-center gap-[7px] rounded-md px-1 py-1 transition-opacity hover:opacity-75"
        >
          <Logo size={20} />
          <span className="hidden text-[14.5px] font-semibold tracking-[-0.025em] sm:inline">
            GradeFlow
          </span>
        </Link>

        {classroom ? (
          <>
            <span className="px-1 text-ink-4" aria-hidden="true">
              /
            </span>
            <Menu
              align="start"
              trigger={({ open, toggle }) => (
                <button
                  onClick={toggle}
                  aria-expanded={open}
                  className={cx(
                    "flex h-7 min-w-0 items-center gap-1 rounded-md px-1.5 text-[13.5px] font-medium transition-colors hover:bg-surface-2",
                    open && "bg-surface-2",
                  )}
                >
                  <span className="truncate">{classroom.name}</span>
                  <IconChevronDown size={13} className="shrink-0 text-ink-3" />
                </button>
              )}
            >
              {(close) => (
                <>
                  {(classrooms ?? []).map((item) => (
                    <MenuItem
                      key={item.id}
                      onClick={() => {
                        close();
                        router.push(`/app/${item.slug}`);
                      }}
                    >
                      <span className="flex-1 truncate">{item.name}</span>
                      <span className="text-[11.5px] text-ink-4">{item.students.length}</span>
                    </MenuItem>
                  ))}
                  <MenuSeparator />
                  <MenuItem
                    icon={<IconPlus size={14} />}
                    onClick={() => {
                      close();
                      newClassroom();
                    }}
                  >
                    New classroom
                  </MenuItem>
                </>
              )}
            </Menu>
          </>
        ) : null}

        <div className="flex-1" />

        <button
          onClick={onSearch}
          className="flex h-7 items-center gap-2 rounded-md border border-line bg-surface px-2 text-[13px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink-2"
        >
          <IconSearch size={14} />
          <span className="hidden sm:inline">Search</span>
          <span className="hidden items-center gap-0.5 sm:flex">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        <Menu
          trigger={({ open, toggle }) => (
            <button
              onClick={toggle}
              aria-expanded={open}
              aria-label="Workspace menu"
              className={cx(
                "flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[13px] font-medium transition-colors hover:bg-surface-2",
                open && "bg-surface-2",
              )}
            >
              <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-ink text-[10.5px] font-semibold text-paper">
                {(user?.fullName ?? "T").slice(0, 1).toUpperCase()}
              </span>
              <IconChevronDown size={13} className="text-ink-3" />
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="px-2 py-1.5">
                <p className="truncate text-[13px] font-medium text-ink">
                  {user?.fullName ?? "Teacher"}
                </p>
                <p className="truncate text-[11.5px] text-ink-3">{user?.email}</p>
              </div>
              <MenuSeparator />
              <MenuItem
                icon={<IconTrash size={14} />}
                danger
                onClick={() => {
                  close();
                  void clearAll();
                }}
              >
                Clear workspace
              </MenuItem>
              <MenuItem
                icon={<IconLogout size={14} />}
                onClick={() => {
                  close();
                  clearCache();
                  void signOut();
                }}
              >
                Sign out
              </MenuItem>
            </>
          )}
        </Menu>
      </div>
    </header>
  );
}

/* ---------- Loading ---------- */

function ShellSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 py-10 sm:px-6">
      <div className="skeleton h-7 w-52 rounded-md" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="skeleton h-[168px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/* ---------- Page furniture shared by app screens ---------- */

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-[-0.028em] text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-[13.5px] text-ink-3">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function NewClassroomButton({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const { newClassroom } = useWorkspaceActions();
  return (
    <Button size={size} variant="primary" icon={<IconPlus size={15} />} onClick={newClassroom}>
      New classroom
    </Button>
  );
}
