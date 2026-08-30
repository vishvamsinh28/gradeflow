import { requireUser } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";
export const GET = route(async (request) => json(await requireUser(request)));
