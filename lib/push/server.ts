import "server-only";
import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import webpush, { type PushSubscription } from "web-push";
import { z } from "zod";

export const SubscriptionSchema = z.object({
  endpoint: z.url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export interface StoredSubscription {
  subscription: PushSubscription;
  goal: number;
  updatedAt: number;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

const KEY = "sjt:push:subs";
const redis = Redis.fromEnv();
const field = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 32);

let vapidReady = false;
const ensureVapid = () => {
  if (vapidReady) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error("VAPID 키가 설정되지 않았습니다.");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "https://sql-jd-trainer.vercel.app", publicKey, privateKey);
  vapidReady = true;
};

export const saveSubscription = async (subscription: PushSubscription, goal: number): Promise<void> => {
  const value: StoredSubscription = { subscription, goal, updatedAt: Date.now() };
  await redis.hset(KEY, { [field(subscription.endpoint)]: value });
};

export const removeSubscription = async (endpoint: string): Promise<void> => {
  await redis.hdel(KEY, field(endpoint));
};

export const getSubscription = async (endpoint: string): Promise<StoredSubscription | null> =>
  (await redis.hget<StoredSubscription>(KEY, field(endpoint))) ?? null;

export const listSubscriptions = async (): Promise<StoredSubscription[]> => Object.values((await redis.hgetall<Record<string, StoredSubscription>>(KEY)) ?? {});

/** 만료(404/410)된 구독은 지우고 false 를 돌려준다 */
export const sendPush = async (stored: StoredSubscription, payload: PushPayload): Promise<boolean> => {
  ensureVapid();
  try {
    await webpush.sendNotification(stored.subscription, JSON.stringify(payload), { TTL: 60 * 60 * 12 });
    return true;
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await removeSubscription(stored.subscription.endpoint);
      return false;
    }
    throw err;
  }
};
