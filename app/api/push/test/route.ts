import { z } from "zod";
import { getSubscription, sendPush } from "@/lib/push/server";

const BodySchema = z.object({ endpoint: z.url() });

/** 저장된 구독에만 보낸다. 알림 설정 화면의 테스트 버튼용 */
export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "endpoint 가 필요합니다." }, { status: 400 });
  const stored = await getSubscription(parsed.data.endpoint);
  if (!stored) return Response.json({ error: "등록된 구독이 없습니다." }, { status: 404 });
  const sent = await sendPush(stored, { title: "오늘의 카드", body: `알림이 연결됐습니다. 하루 ${stored.goal}장`, url: "/daily" });
  return Response.json({ ok: sent });
}
