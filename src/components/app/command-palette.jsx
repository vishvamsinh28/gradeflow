"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { cx, Kbd } from "@/components/ui/primitives";
import {
  IconCalendar,
  IconLayers,
  IconPlus,
  IconSearch,
  IconTable,
  IconUsers,
} from "@/components/ui/icons";
import { formatDateShort } from "@/lib/format";
import { useClassrooms } from "@/lib/workspace";
export function CommandPalette({
  open,
  onClose,
  classroom,
  onNewClassroom,
  onNewTest,
  onAddStudents,
}) {
  const router = useRouter();
  const { data: classrooms } = useClassrooms();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);
  const commands = useMemo(() => {
    const list = [];
    const go = (path) => () => {
      onClose();
      router.push(path);
    };
    list.push({
      id: "new-classroom",
      label: "Create classroom",
      group: "Actions",
      icon: <IconPlus size={15} />,
      run: () => {
        onClose();
        onNewClassroom();
      },
    });
    if (classroom) {
      list.push(
        {
          id: "new-test",
          label: "Create test",
          hint: classroom.name,
          group: "Actions",
          icon: <IconPlus size={15} />,
          run: () => {
            onClose();
            onNewTest();
          },
        },
        {
          id: "add-students",
          label: "Add students",
          hint: classroom.name,
          group: "Actions",
          icon: <IconPlus size={15} />,
          run: () => {
            onClose();
            onAddStudents();
          },
        },
        {
          id: "goto-marks",
          label: "Open marks table",
          hint: classroom.name,
          group: "Actions",
          icon: <IconTable size={15} />,
          run: go(`/app/${classroom.slug}/marks`),
        },
      );
    }
    (classrooms ?? []).forEach((item) => {
      list.push({
        id: `class-${item.id}`,
        label: item.name,
        hint: `${item.students.length} students`,
        group: "Classrooms",
        icon: <IconLayers size={15} />,
        run: go(`/app/${item.slug}`),
      });
    });
    (classrooms ?? []).forEach((item) => {
      item.tests.forEach((test) => {
        list.push({
          id: `test-${test.id}`,
          label: test.title ?? "Untitled test",
          hint: `${item.name} · ${formatDateShort(test.test_date)}`,
          group: "Tests",
          icon: <IconCalendar size={15} />,
          run: go(`/app/${item.slug}/tests/${test.id}`),
        });
      });
    });
    if (classroom) {
      classroom.students.forEach((student) => {
        list.push({
          id: `student-${student.id}`,
          label: student.name,
          hint: `${student.code} · ${classroom.name}`,
          group: "Students",
          icon: <IconUsers size={15} />,
          run: go(`/app/${classroom.slug}/students?q=${encodeURIComponent(student.name)}`),
        });
      });
    }
    return list;
  }, [classrooms, classroom, router, onClose, onNewClassroom, onNewTest, onAddStudents]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.slice(0, 24);
    return commands
      .filter((command) => `${command.label} ${command.hint ?? ""}`.toLowerCase().includes(q))
      .slice(0, 24);
  }, [commands, query]);
  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({
      block: "nearest",
    });
  }, [active]);
  if (!open || !mounted) return null;
  const grouped = [];
  results.forEach((command, index) => {
    const bucket = grouped.find((entry) => entry.group === command.group);
    if (bucket)
      bucket.items.push({
        command,
        index,
      });
    else
      grouped.push({
        group: command.group,
        items: [
          {
            command,
            index,
          },
        ],
      });
  });
  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-start justify-center p-4 pt-[12vh]">
      <div className="anim-fade absolute inset-0 bg-scrim backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="anim-pop relative z-10 w-full max-w-[560px] overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <IconSearch size={16} className="shrink-0 text-ink-3" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((value) => Math.min(value + 1, results.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((value) => Math.max(value - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                results[active]?.run();
              } else if (event.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Search classrooms, tests, students…"
            className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-4"
          />
          <Kbd>esc</Kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-ink-3">No matches</p>
          ) : (
            grouped.map((entry) => (
              <div key={entry.group} className="mb-1 last:mb-0">
                <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-4">
                  {entry.group}
                </p>
                {entry.items.map(({ command, index }) => (
                  <button
                    key={command.id}
                    data-index={index}
                    onMouseMove={() => setActive(index)}
                    onClick={command.run}
                    className={cx(
                      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                      index === active ? "bg-surface-2" : "",
                    )}
                  >
                    <span className={index === active ? "text-accent" : "text-ink-3"}>
                      {command.icon}
                    </span>
                    <span className="flex-1 truncate text-[13.5px] font-medium text-ink">
                      {command.label}
                    </span>
                    {command.hint ? (
                      <span className="shrink-0 truncate text-[12px] text-ink-3">
                        {command.hint}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
