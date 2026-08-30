import { clearSessionCookie } from "@/lib/server/auth";
import { noContent, route } from "@/lib/server/http";
export const POST = route(async () => {
  await clearSessionCookie();
  return noContent();
});
