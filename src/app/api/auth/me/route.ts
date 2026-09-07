import { getSession } from "@/lib/auth";
import { handler, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const s = await getSession();
  return ok({ user: s });
});
