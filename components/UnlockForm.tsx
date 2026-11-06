"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { unlockAction, type UnlockState } from "@/lib/unlock/actions";

export function UnlockForm({ title }: { title: string }) {
  const [state, action, pending] = useActionState<UnlockState, FormData>(unlockAction, { error: null });
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-5 py-16">
      <span className="hq-card flat inline-flex h-16 w-16 items-center justify-center text-muted">
        <Icon name="lock" size={28} />
      </span>
      <h1 className="mt-5 text-center text-[22px] font-extrabold tracking-[-0.02em]">{title}</h1>
      <form action={action} className="mt-7 flex w-full gap-2.5">
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
          className="h-[52px] min-w-0 flex-1 rounded-[14px] bg-surface px-4 text-[16px] text-fg shadow-[inset_0_0_0_1.5px_var(--color-line)] outline-none placeholder:text-faint focus:shadow-[inset_0_0_0_2px_var(--color-accent)]"
        />
        <Button type="submit" disabled={pending}>
          열기
        </Button>
      </form>
      <p role="alert" className="mt-3 h-5 text-sm font-semibold text-fail-ink">
        {state.error}
      </p>
    </div>
  );
}
