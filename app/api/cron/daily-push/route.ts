import { listDecks } from "@/lib/content/loader";
import { listSubscriptions, sendPush } from "@/lib/push/server";

/** Vercel Cron 이 하루 한 번 호출한다. CRON_SECRET 이 Authorization 헤더로 온다. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const cards = listDecks().flatMap((d) => d.cards);
  const subs = await listSubscriptions();
  let sent = 0;
  let removed = 0;
  const errors: string[] = [];
  for (const stored of subs) {
    const teaser = cards[Math.floor(Math.random() * cards.length)];
    try {
      const ok = await sendPush(stored, { title: `오늘의 카드 ${stored.goal}장`, body: teaser ? teaser.prompt : "오늘 풀 카드가 준비됐습니다", url: "/daily" });
      if (ok) sent++;
      else removed++;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  console.log(`daily-push sent=${sent} removed=${removed} errors=${errors.length}`);
  return Response.json({ total: subs.length, sent, removed, errors });
}
