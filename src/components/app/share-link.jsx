"use client";

import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlays";
import { IconCheck, IconEye, IconRefresh } from "@/components/ui/icons";
import { rotateShareLink } from "@/lib/api";
function shareUrl(token) {
  if (typeof window === "undefined") return `/results/${token}`;
  return `${window.location.origin}/results/${token}`;
}

/**
 * Hands a student or parent their own marks.
 *
 * The link carries an unguessable per-student token and shows only graded,
 * released work — one student, never the class.
 */
export function ShareLinkButton({ student }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState(student.share_token);
  const [rotating, setRotating] = useState(false);
  async function rotate() {
    setRotating(true);
    try {
      const result = await rotateShareLink(student.id);
      setToken(result.share_token);
      toast("Old link withdrawn — a new one has been issued", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not withdraw that link", "error");
    } finally {
      setRotating(false);
    }
  }
  async function copy() {
    const url = shareUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast(`Results link for ${student.name} copied`, "success");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; showing the link still lets them copy it.
      toast(url, "info");
    }
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <Button
        size="sm"
        icon={copied ? <IconCheck size={14} /> : <IconEye size={14} />}
        onClick={() => void copy()}
      >
        {copied ? "Link copied" : "Copy results link"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        loading={rotating}
        icon={<IconRefresh size={14} />}
        title="Withdraw the old link and issue a new one"
        onClick={() => void rotate()}
      >
        Withdraw
      </Button>
    </span>
  );
}
