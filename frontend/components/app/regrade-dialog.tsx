"use client";

import { useEffect, useState } from "react";
import { Button, Field, Segmented, Textarea } from "@/components/ui/primitives";
import { Dialog, useToast } from "@/components/ui/overlays";
import { IconSparkle } from "@/components/ui/icons";
import { regradeTest } from "@/lib/workspace";
import { pluralize } from "@/lib/format";

const EXAMPLES = [
  "Stop deducting marks for missing units.",
  "Give method marks when the approach is right but the arithmetic slips.",
  "Be stricter about showing working.",
];

/**
 * Correcting the whole test at once.
 *
 * When the model was systematically wrong, overriding thirty marks by hand is
 * worse than marking the papers yourself. One sentence, re-run.
 */
export function RegradeDialog({
  open,
  onClose,
  testId,
  gradedCount,
  flaggedCount,
}: {
  open: boolean;
  onClose: () => void;
  testId: string;
  gradedCount: number;
  flaggedCount: number;
}) {
  const toast = useToast();
  const [correction, setCorrection] = useState("");
  const [scope, setScope] = useState<"all" | "flagged">("all");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setCorrection("");
      setScope("all");
    }
  }, [open]);

  async function submit() {
    if (!correction.trim() || busy) return;
    setBusy(true);
    try {
      const result = await regradeTest(testId, correction.trim(), scope === "flagged");
      onClose();
      toast(`Re-marking ${pluralize(result.count, "paper")}`, "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not start re-marking", "error");
    } finally {
      setBusy(false);
    }
  }

  const target = scope === "flagged" ? flaggedCount : gradedCount;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Re-mark this test"
      description="Tell GradeFlow what it got wrong. It marks every paper again."
      width={520}
      footer={
        <>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            loading={busy}
            disabled={!correction.trim() || target === 0}
            onClick={() => void submit()}
          >
            Re-mark {target > 0 ? pluralize(target, "paper") : ""}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {flaggedCount > 0 ? (
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { value: "all", label: `Every paper (${gradedCount})` },
              { value: "flagged", label: `Flagged only (${flaggedCount})` },
            ]}
          />
        ) : null}

        <Field
          label="What should it do differently?"
          hint="This is added to the test's guidance, so it also applies to sheets uploaded later."
        >
          <Textarea
            data-autofocus
            rows={3}
            value={correction}
            onChange={(event) => setCorrection(event.target.value)}
            placeholder="Stop deducting marks for missing units."
          />
        </Field>

        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setCorrection(example)}
              className="rounded-md border border-dashed border-line px-2 py-1 text-left text-[12px] text-ink-3 transition-colors hover:border-accent-line hover:bg-accent-soft hover:text-accent"
            >
              {example}
            </button>
          ))}
        </div>

        <p className="flex items-start gap-2 rounded-md border border-warn-line bg-warn-soft px-3 py-2.5 text-[12.5px] leading-snug text-warn">
          <IconSparkle size={14} className="mt-[1px] shrink-0" />
          Any marks you edited by hand on this test will be replaced.
        </p>
      </div>
    </Dialog>
  );
}
