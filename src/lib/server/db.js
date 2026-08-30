import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { env } from "./env";

/**
 * One client per process, created on first query rather than on import.
 *
 * Lazy so that importing anything downstream of this module — a route that only
 * shapes data, a test — does not open a pool or demand credentials. Next's dev
 * server re-evaluates modules on every edit, so the global keeps hot reloads
 * from stacking up pools until Postgres refuses.
 */
const globalForPrisma = globalThis;
function create() {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: env().DATABASE_URL,
    }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}
function client() {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = create();
  return globalForPrisma.prisma;
}
export const db = new Proxy(
  {},
  {
    get: (_target, property) => Reflect.get(client(), property),
  },
);
