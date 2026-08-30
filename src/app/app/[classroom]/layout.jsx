"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Button,
  EmptyState,
  Field,
  Input,
  Menu,
  MenuItem,
  MenuSeparator,
  cx,
} from "@/components/ui/primitives";
import { Dialog, useConfirm, useToast } from "@/components/ui/overlays";
import {
  IconCalendar,
  IconEdit,
  IconHome,
  IconLayers,
  IconMore,
  IconPlus,
  IconTable,
  IconTrash,
  IconUsers,
} from "@/components/ui/icons";
import { useWorkspaceActions } from "@/components/app/shell";
import { removeClassroom, updateClassroom, useClassroom } from "@/lib/workspace";
import { pluralize } from "@/lib/format";
const TABS = [
  {
    segment: "",
    label: "Overview",
    icon: <IconHome size={14} />,
  },
  {
    segment: "students",
    label: "Students",
    icon: <IconUsers size={14} />,
  },
  {
    segment: "tests",
    label: "Tests",
    icon: <IconCalendar size={14} />,
  },
  {
    segment: "marks",
    label: "Marks",
    icon: <IconTable size={14} />,
  },
];
export default function ClassroomLayout({ children }) {
  const params = useParams();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const { data: classroom, loading } = useClassroom(params.classroom);
  const { newTest, addStudents } = useWorkspaceActions();
  const [renaming, setRenaming] = useState(false);
  if (loading && !classroom) {
    return (
      <div className="mx-auto w-full max-w-[1360px] px-4 py-10 sm:px-6">
        <div className="skeleton h-7 w-52 rounded-md" />
        <div className="skeleton mt-6 h-64 rounded-xl" />
      </div>
    );
  }
  if (!classroom) {
    return (
      <div className="mx-auto w-full max-w-[1360px] px-4 py-16 sm:px-6">
        <EmptyState
          icon={<IconLayers size={17} />}
          title="Classroom not found"
          description="It may have been deleted, or the link is out of date."
          action={
            <Button variant="primary" onClick={() => router.push("/app")}>
              Back to classrooms
            </Button>
          }
        />
      </div>
    );
  }
  const base = `/app/${classroom.slug}`;
  const active =
    TABS.slice(1).find((tab) => pathname.startsWith(`${base}/${tab.segment}`))?.segment ?? "";
  async function remove() {
    if (!classroom) return;
    const ok = await confirm({
      title: `Delete ${classroom.name}?`,
      body: `${pluralize(classroom.students.length, "student")}, ${pluralize(classroom.tests.length, "test")} and every mark in this classroom will be removed.`,
      confirmLabel: "Delete classroom",
      danger: true,
    });
    if (!ok) return;
    try {
      await removeClassroom(classroom.id);
      router.push("/app");
      toast("Classroom deleted", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete that classroom", "error");
    }
  }
  return (
    <div>
      <div className="border-b border-line bg-surface">
        <div className="mx-auto w-full max-w-[1360px] px-4 pt-6 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-[22px] font-semibold tracking-[-0.028em] text-ink">
                {classroom.name}
              </h1>
              <p className="mt-0.5 text-[13px] text-ink-3">
                {classroom.description ??
                  `${pluralize(classroom.students.length, "student")} · ${pluralize(classroom.subjects.length, "subject")}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" onClick={addStudents}>
                Add students
              </Button>
              <Button size="sm" variant="primary" icon={<IconPlus size={14} />} onClick={newTest}>
                New test
              </Button>
              <Menu
                trigger={({ open, toggle }) => (
                  <button
                    onClick={toggle}
                    aria-expanded={open}
                    aria-label="Classroom options"
                    className={cx(
                      "flex h-7 w-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink",
                      open && "bg-surface-2 text-ink",
                    )}
                  >
                    <IconMore size={15} />
                  </button>
                )}
              >
                {(close) => (
                  <>
                    <MenuItem
                      icon={<IconEdit size={14} />}
                      onClick={() => {
                        close();
                        setRenaming(true);
                      }}
                    >
                      Rename classroom
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        close();
                        router.push(`${base}/marks`);
                      }}
                    >
                      Export marks
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem
                      danger
                      icon={<IconTrash size={14} />}
                      onClick={() => {
                        close();
                        void remove();
                      }}
                    >
                      Delete classroom
                    </MenuItem>
                  </>
                )}
              </Menu>
            </div>
          </div>

          <nav
            className="no-scrollbar -mb-px mt-5 flex gap-0.5 overflow-x-auto"
            aria-label="Classroom sections"
          >
            {TABS.map((tab) => {
              const href = tab.segment ? `${base}/${tab.segment}` : base;
              const isActive = tab.segment === active;
              return (
                <Link
                  key={tab.label}
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={cx(
                    "relative inline-flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 pb-2.5 pt-1 text-[13.5px] font-medium transition-colors",
                    isActive
                      ? "border-accent text-ink"
                      : "border-transparent text-ink-3 hover:text-ink",
                  )}
                >
                  <span className={cx("hidden sm:inline", isActive ? "text-accent" : "text-ink-4")}>
                    {tab.icon}
                  </span>
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-6 sm:py-8">{children}</div>

      <RenameClassroomDialog
        open={renaming}
        onClose={() => setRenaming(false)}
        id={classroom.id}
        name={classroom.name}
        description={classroom.description ?? ""}
      />
    </div>
  );
}
function RenameClassroomDialog({ open, onClose, id, name, description }) {
  const toast = useToast();
  const [draftName, setDraftName] = useState(name);
  const [draftDescription, setDraftDescription] = useState(description);
  useEffect(() => {
    if (!open) return;
    setDraftName(name);
    setDraftDescription(description);
  }, [open, name, description]);
  async function save() {
    if (!draftName.trim()) return;
    try {
      await updateClassroom(id, {
        name: draftName,
        description: draftDescription,
      });
      onClose();
      toast("Classroom updated", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save those changes", "error");
    }
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Rename classroom"
      description="The link to this classroom stays the same."
      footer={
        <>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => void save()}
            disabled={!draftName.trim()}
          >
            Save
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Field label="Classroom name">
          <Input
            data-autofocus
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
          />
        </Field>
        <Field label="Description" optional>
          <Input
            value={draftDescription}
            onChange={(event) => setDraftDescription(event.target.value)}
          />
        </Field>
      </form>
    </Dialog>
  );
}
