import { destroySession } from "@/lib/auth";
import { handler, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async () => {
  await destroySession();
  return ok();
});
