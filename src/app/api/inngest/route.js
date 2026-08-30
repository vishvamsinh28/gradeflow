import { serve } from "inngest/next";
import { inngest } from "@/lib/server/inngest/client";
import { functions } from "@/lib/server/inngest/functions";

/**
 * Inngest's endpoint. It has no session — Inngest calls it — and authenticates
 * with a signing key instead, which `serve` verifies on every request.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});

// One sheet is a single model call; comfortably inside the Hobby ceiling.
export const maxDuration = 60;
