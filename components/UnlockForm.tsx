"use client";
import { Lock } from "lucide-react";
import { useActionState } from "react";
import { unlockAction, type UnlockState } from "@/lib/unlock/actions";

export function UnlockForm({ title }: { title: string }) {
  const [state, action, pending] = useActionState<UnlockState, FormData>(unlockAction, { error: null });
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-5 py-16">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-fg/10 text-muted">
        <Lock size={18} aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-center text-lg font-semibold tracking-tight">{title}</h1>
      <form action={action} className="mt-6 flex w-full gap-2">
        <label htmlFor="unlock-password" className="sr-only">
          비밀번호
        </label>
        <input
          id="unlock-password"
          name="password"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          autoFocus
          required
          placeholder="비밀번호"
          className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-accent"
        />
        <button type="submit" disabled={pending} className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent/85 disabled:opacity-60">
          열기
        </button>
      </form>
      <p role="alert" className="mt-3 h-5 text-sm text-fail">
        {state.error}
      </p>
    </div>
  );
}
