"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/icons";
import { BASE_QUERY, JOB_SITES, KEYWORDS } from "./sites";
import { jdRecentStore, parseRecent, pushRecent } from "./store";

export interface CurrentJd {
  title: string;
  sub: string;
}

interface Props {
  current: CurrentJd | null;
  onOpenCurrent: () => void;
  onSubmit: (text: string) => void;
}

const KIND_ICON: Record<string, IconName> = { link: "link", search: "ext" };

/** 공고 찾기 탭: 사이트별 검색 바로가기(새 창)와 본문·링크 가져오기. 서버가 남의 사이트를 읽지 않는다. */
export function JdFinder({ current, onOpenCurrent, onSubmit }: Props) {
  const recentRaw = jdRecentStore.useValue();
  const recent = parseRecent(recentRaw);
  const [keywords, setKeywords] = useState<string[]>(["SQL"]);
  const [draft, setDraft] = useState("");
  const query = [BASE_QUERY, ...keywords].join(" ");
  const sub = [BASE_QUERY, ...keywords].join(" · ");

  const toggle = (k: string) => setKeywords((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  const submit = () => {
    onSubmit(draft);
    setDraft("");
  };

  return (
    <div className="mt-5 grid grid-cols-1 gap-6 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <div className="grid min-w-0 grid-cols-1 gap-6">
        <div className="hq-card p-4 lg:p-5">
          <div className="flex items-baseline gap-3">
            <span className="text-[13px] font-semibold text-muted">검색 조건</span>
            <span className="text-[19px] font-extrabold tracking-[-0.02em]">{BASE_QUERY}</span>
          </div>
          <div className="mt-4 flex items-start gap-4">
            <span className="w-10 shrink-0 pt-2 text-[13px] font-semibold text-muted">키워드</span>
            <div role="group" aria-label="키워드" className="flex flex-wrap gap-2">
              {KEYWORDS.map((k) => {
                const on = keywords.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(k)}
                    className={`h-9 rounded-full px-4 text-[14px] font-bold shadow-[inset_0_0_0_1.5px_var(--color-line-2)] transition-colors ${on ? "bg-accent-soft text-accent-ink shadow-[inset_0_0_0_1.5px_var(--color-accent)]" : "text-fg-2 hover:bg-surface-2"}`}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-[19px] font-extrabold tracking-[-0.02em]">사이트</h2>
            <span className="text-sm font-semibold text-muted">{JOB_SITES.length}</span>
          </div>
          <ul className="mt-3 grid gap-3 lg:grid-cols-2">
            {JOB_SITES.map((s) => (
              <li key={s.id}>
                <a
                  href={s.url(query)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${s.name} 검색 열기`}
                  onClick={() => pushRecent(recentRaw, { kind: "search", title: `${s.name} 검색`, sub, url: s.url(query) })}
                  className="hq-card flex items-center gap-3.5 p-4 transition-colors hover:bg-surface-2"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-3 text-[16px] font-extrabold text-fg-2">{s.name[0]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] font-extrabold tracking-[-0.02em]">{s.name}</span>
                    <span className="block truncate text-[13px] text-muted">{sub}</span>
                  </span>
                  <Icon name="ext" size={22} className="shrink-0 text-accent" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-6">
        <div className="hq-card p-4 lg:p-5">
          <h2 className="text-[19px] font-extrabold tracking-[-0.02em]">공고 가져오기</h2>
          <textarea
            aria-label="공고 본문이나 링크"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            placeholder="공고 본문이나 링크 붙여 넣기"
            className="mt-3 block w-full resize-none rounded-[14px] bg-surface-2 p-3.5 text-[15px] leading-[1.6] text-fg outline-none placeholder:text-faint focus:shadow-[inset_0_0_0_1.5px_var(--color-accent)]"
          />
          <div className="mt-3 flex items-center gap-4">
            <Button onClick={submit} disabled={!draft.trim()}>
              분석
            </Button>
            <span className="text-[13px] text-muted">링크는 출처로만 저장됩니다</span>
          </div>
        </div>

        {(current || recent.length > 0) && (
          <section className="hq-card p-4 lg:p-5">
            <h2 className="text-[19px] font-extrabold tracking-[-0.02em]">최근</h2>
            <ul className="mt-2 divide-y divide-line">
              {current && (
                <li>
                  <button type="button" onClick={onOpenCurrent} className="flex w-full items-center gap-3 py-3 text-left">
                    <Icon name="paste" size={20} className="shrink-0 text-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold">{current.title}</span>
                      <span className="block truncate text-[13px] text-muted">{current.sub}</span>
                    </span>
                  </button>
                </li>
              )}
              {recent.map((r) => (
                <li key={r.url}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-3">
                    <Icon name={KIND_ICON[r.kind]} size={20} className="shrink-0 text-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold">{r.title}</span>
                      <span className="block truncate text-[13px] text-muted">{r.sub}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
