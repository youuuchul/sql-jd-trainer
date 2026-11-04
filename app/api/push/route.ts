import { z } from "zod";
import { removeSubscription, saveSubscription, SubscriptionSchema } from "@/lib/push/server";

const PostSchema = z.object({ subscription: SubscriptionSchema, goal: z.number().int().min(1).max(100) });
const DeleteSchema = z.object({ endpoint: z.url() });

export async function POST(request: Request) {
  const parsed = PostSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "구독 정보가 올바르지 않습니다." }, { status: 400 });
  await saveSubscription(parsed.data.subscription, parsed.data.goal);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const parsed = DeleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "endpoint 가 필요합니다." }, { status: 400 });
  await removeSubscription(parsed.data.endpoint);
  return Response.json({ ok: true });
}
