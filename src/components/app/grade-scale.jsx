"use client";

import { useEffect, useState } from "react";
import { Button, Input, cx } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlays";
import { IconPlus, IconTrash } from "@/components/ui/icons";
import { updateClassroom } from "@/lib/workspace";
const SUGGESTED = [
  {
    label: "A",
    min: 80,
  },
  {
    label: "B",
    min: 65,
  },
  {
    label: "C",
    min: 50,
  },
  {
    label: "D",
    min: 35,
  },
  {
    label: "E",
    min: 0,
  },
];

/**
 * Schools report letters or a pass mark, not percentages. One band list per
 * classroom, because a Year 9 pass and a board-year pass are not the same.
 */
export function GradeScaleCard({ classroom }) {
  const toast = useToast();
  const [bands, setBands] = useState(classroom.grade_scale ?? []);
  const [saving, setSaving] = useState(false);
  useEffect(() => setBands(classroom.grade_scale ?? []), [classroom.grade_scale]);
  const dirty = JSON.stringify(bands) !== JSON.stringify(classroom.grade_scale ?? []);
  const descending = bands.every((band, index) => {
    const previous = bands[index - 1];
    return previous === undefined || band.min < previous.min;
  });
  async function save(next) {
    setSaving(true);
    try {
      await updateClassroom(classroom.id, {
        grade_scale: next,
      });
      toast(next.length ? "Grade scale saved" : "Grade scale removed", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save the grade scale", "error");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.075em] text-ink-3">
          Grade scale
        </h2>
        {bands.length === 0 ? (
          <button
            onClick={() => setBands(SUGGESTED)}
            className="text-[12.5px] font-medium text-ink-3 transition-colors hover:text-accent"
          >
            Use A–E
          </button>
        ) : (
          <button
            onClick={() =>
              setBands([
                ...bands,
                {
                  label: "",
                  min: 0,
                },
              ])
            }
            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-3 transition-colors hover:text-accent"
          >
            <IconPlus size={12} />
            Band
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {bands.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-[13px] text-ink-3">
              Marks show as percentages. Add bands to report letters or a pass mark instead.
            </p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {bands.map((band, index) => (
                <li key={index} className="group/band flex items-center gap-2 px-3 py-2">
                  <Input
                    value={band.label}
                    aria-label="Grade label"
                    placeholder="A"
                    maxLength={12}
                    onChange={(event) => {
                      const next = [...bands];
                      next[index] = {
                        ...band,
                        label: event.target.value,
                      };
                      setBands(next);
                    }}
                    className="h-7 w-16 text-[13px]"
                  />
                  <span className="text-[12px] text-ink-3">from</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={band.min}
                    aria-label="Minimum percentage"
                    onChange={(event) => {
                      const next = [...bands];
                      next[index] = {
                        ...band,
                        min: Number(event.target.value),
                      };
                      setBands(next);
                    }}
                    className="h-7 w-[72px] font-mono text-[13px]"
                  />
                  <span className="text-[12px] text-ink-3">%</span>
                  <button
                    aria-label={`Remove ${band.label || "band"}`}
                    onClick={() => setBands(bands.filter((_, i) => i !== index))}
                    className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-4 opacity-0 transition-all hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 group-hover/band:opacity-100"
                  >
                    <IconTrash size={12} />
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2 border-t border-line px-3 py-2">
              {!descending ? (
                <p className="text-[12px] text-warn">Order bands from the highest mark down.</p>
              ) : (
                <p className={cx("text-[12px]", dirty ? "text-ink-3" : "text-ink-4")}>
                  {dirty ? "Unsaved" : "Saved"}
                </p>
              )}
              <div className="ml-auto flex items-center gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => void save([])}>
                  Clear
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  loading={saving}
                  disabled={!dirty || !descending || bands.some((band) => !band.label.trim())}
                  onClick={() =>
                    void save(
                      bands.map((b) => ({
                        ...b,
                        label: b.label.trim(),
                      })),
                    )
                  }
                >
                  Save
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
