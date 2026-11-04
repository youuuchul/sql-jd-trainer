"use client";
import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";

type Status = "unsupported" | "needs-install" | "denied" | "off" | "on";

const toKey = (base64: string): Uint8Array<ArrayBuffer> => {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const detect = async (hasKey: boolean): Promise<{ status: Status; sub: PushSubscription | null }> => {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported || !hasKey) return { status: isIos() && !isStandalone() ? "needs-install" : "unsupported", sub: null };
  if (Notification.permission === "denied") return { status: "denied", sub: null };
  const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  return { status: sub ? "on" : "off", sub };
};

const save = (sub: PushSubscription, goal: number) =>
  fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON(), goal }) }).then((r) => {
    if (!r.ok) throw new Error(`구독 저장 실패 ${r.status}`);
  });

export function PushToggle({ goal }: { goal: number }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [sub, setSub] = useState<PushSubscription | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    let cancelled = false;
    detect(Boolean(publicKey)).then((r) => {
      if (cancelled) return;
      setSub(r.sub);
      setStatus(r.status);
    });
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  useEffect(() => {
    if (sub) save(sub, goal).catch(() => undefined);
  }, [sub, goal]);

  const enable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey!) });
      await save(s, goal);
      setSub(s);
      setStatus("on");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!sub) return;
    setBusy(true);
    try {
      await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
      setSub(null);
      setStatus("off");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    if (!sub) return;
    setBusy(true);
    const r = await fetch("/api/push/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
    setMessage(r.ok ? "테스트 알림을 보냈습니다" : "테스트 알림 실패");
    setBusy(false);
  };

  if (!status) return null;
  return (
    <div>
      <div className="flex items-center gap-3">
        {status === "on" ? <Bell size={16} className="text-accent" aria-hidden="true" /> : <BellOff size={16} className="text-muted" aria-hidden="true" />}
        <span className="flex-1 text-sm">매일 오전 9시 무렵 알림</span>
        {status === "on" && (
          <button type="button" onClick={test} disabled={busy} className="h-8 rounded-lg px-2.5 text-xs text-muted hover:bg-fg/10 hover:text-fg">
            테스트
          </button>
        )}
        {(status === "on" || status === "off") && (
          <button
            type="button"
            role="switch"
            aria-checked={status === "on"}
            aria-label="알림"
            onClick={status === "on" ? disable : enable}
            disabled={busy}
            className={`relative h-6 w-11 rounded-full transition-colors ${status === "on" ? "bg-accent" : "bg-fg/20"} disabled:opacity-50`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-[left] ${status === "on" ? "left-[22px]" : "left-0.5"}`} />
          </button>
        )}
      </div>
      {status === "needs-install" && <p className="mt-2 text-xs text-muted">홈 화면에 추가한 앱에서 켤 수 있습니다</p>}
      {status === "denied" && <p className="mt-2 text-xs text-muted">브라우저 설정에서 알림이 차단되어 있습니다</p>}
      {status === "unsupported" && <p className="mt-2 text-xs text-muted">이 브라우저는 알림을 지원하지 않습니다</p>}
      {message && <p className="mt-2 text-xs text-muted">{message}</p>}
    </div>
  );
}
