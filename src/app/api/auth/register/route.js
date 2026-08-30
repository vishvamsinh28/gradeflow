import { db } from "@/lib/server/db";
import { createToken, hashPassword, setSessionCookie } from "@/lib/server/auth";
import { ApiError, body, json, route } from "@/lib/server/http";
import { registerSchema } from "@/lib/server/schemas";
import { clientKey, rateLimit } from "@/lib/server/rate-limit";
export const POST = route(async (request) => {
  // Signup is cheap to script and expensive to clean up.
  await rateLimit(clientKey(request, "register"), {
    limit: 5,
    windowSeconds: 3600,
  });
  const input = await body(request, registerSchema);
  const email = input.email.toLowerCase();
  if (
    await db.users.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    })
  ) {
    throw new ApiError(409, "An account with this email already exists");
  }
  const user = await db.users.create({
    data: {
      email,
      full_name: input.full_name.trim(),
      password_hash: await hashPassword(input.password),
    },
    select: {
      id: true,
      email: true,
      full_name: true,
      created_at: true,
    },
  });
  const token = await createToken(user.id, user.email);
  await setSessionCookie(token);
  return json(
    {
      user,
      access_token: token,
    },
    201,
  );
});
