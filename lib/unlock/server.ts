import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const UNLOCK_COOKIE = "sjt_unlock";

/** 비밀번호에서 만든 쿠키 값. 비밀번호가 바뀌면 기존 쿠키는 무효가 된다. */
export const unlockToken = (password: string): string => createHmac("sha256", password).update("sjt-unlock-v1").digest("hex");

const safeEqual = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** UNLOCK_PASSWORD 가 없으면 잠긴 스키마는 열 수 없다. */
export const checkPassword = (input: string): boolean => {
  const password = process.env.UNLOCK_PASSWORD;
  return Boolean(password) && safeEqual(input, password!);
};

export const isUnlocked = async (): Promise<boolean> => {
  const password = process.env.UNLOCK_PASSWORD;
  if (!password) return false;
  const value = (await cookies()).get(UNLOCK_COOKIE)?.value;
  return Boolean(value) && safeEqual(value!, unlockToken(password));
};
