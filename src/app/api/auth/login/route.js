import { db } from "@/lib/server/db";
import { createToken, setSessionCookie, verifyPassword } from "@/lib/server/auth";
import { ApiError, body, json, route } from "@/lib/server/http";
import { loginSchema } from "@/lib/server/schemas";
import { clientKey, rateLimit } from "@/lib/server/rate-limit";
export const POST = route(async (request) => {
  // Password guessing is the one attack this endpoint invites.
  await rateLimit(clientKey(request, "login"), {
    limit: 10,
    windowSeconds: 300,
  });
  const input = await body(request, loginSchema);
  // And per-account, so a botnet cannot spread the same guessing across IPs.
  await rateLimit(`login:${input.email.toLowerCase()}`, {
    limit: 10,
    windowSeconds: 300,
  });
  const user = await db.users.findUnique({
    where: {
      email: input.email.toLowerCase(),
    },
  });

  // One message for both cases, so this cannot be used to enumerate accounts.
  if (!user || !(await verifyPassword(input.password, user.password_hash))) {
    throw new ApiError(401, "Incorrect email or password");
  }
  const token = await createToken(user.id, user.email);
  await setSessionCookie(token);
  return json({
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      created_at: user.created_at,
    },
    access_token: token,
  });
});
