import { revalidateTag } from "next/cache";
import { CONTENT_TAG } from "@/lib/content/loader";

/** 콘텐츠 게시 후 캐시를 바로 버린다. scripts/publish-content.ts --revalidate 가 CRON_SECRET 으로 부른다 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  revalidateTag(CONTENT_TAG, { expire: 0 });
  return Response.json({ ok: true });
}
