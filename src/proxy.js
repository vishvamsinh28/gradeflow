import { NextResponse } from "next/server";

/**
 * Origin check for state-changing API requests.
 *
 * The session cookie is SameSite=Lax, which already blocks cross-site POSTs
 * from a form or an image tag. This is the second lock: a mutation must state
 * an Origin, and it must be this site's.
 *
 * Inngest's endpoint is exempt — it is called by Inngest, not a browser, and
 * authenticates with a signing key instead.
 */
const MUTATIONS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const QUEUE_PREFIX = "/api/inngest";
export function proxy(request) {
  if (!MUTATIONS.has(request.method)) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith(QUEUE_PREFIX)) return NextResponse.next();
  const origin = request.headers.get("origin");
  if (!origin) {
    return NextResponse.json(
      {
        detail: "Request origin is not allowed",
      },
      {
        status: 403,
      },
    );
  }
  try {
    if (new URL(origin).host !== request.headers.get("host")) {
      return NextResponse.json(
        {
          detail: "Request origin is not allowed",
        },
        {
          status: 403,
        },
      );
    }
  } catch {
    return NextResponse.json(
      {
        detail: "Request origin is not allowed",
      },
      {
        status: 403,
      },
    );
  }
  return NextResponse.next();
}
export const config = {
  matcher: "/api/:path*",
};
