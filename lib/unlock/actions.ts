"use server";
import { cookies } from "next/headers";
import { checkPassword, UNLOCK_COOKIE, unlockToken } from "./server";

export interface UnlockState {
  error: string | null;
}

export async function unlockAction(_prev: UnlockState, formData: FormData): Promise<UnlockState> {
  const input = String(formData.get("password") ?? "").trim();
  if (!checkPassword(input)) {
    await new Promise((r) => setTimeout(r, 600));
    return { error: "비밀번호가 맞지 않습니다" };
  }
  (await cookies()).set(UNLOCK_COOKIE, unlockToken(process.env.UNLOCK_PASSWORD!), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return { error: null };
}
