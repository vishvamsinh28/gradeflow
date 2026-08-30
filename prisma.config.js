import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma's CLI config. The app itself connects through the driver adapter in
 * src/lib/server/db.js — this is only how `prisma db push` and friends reach
 * Postgres — through the session pooler, which handles schema changes fine
 * and, unlike the direct db.* host, is reachable over IPv4.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DIRECT_URL"),
  },
});
