import Link from "next/link";
import { Badge } from "@/components/ui-lab/components/badge/Badge";
import { listSets, setProblems } from "@/lib/content/loader";

export default function HomePage() {
  const sets = listSets();
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-12">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">데이터 분석가 라이브 쿼리 연습</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-fg/80">
          실무 마트 구조에서 지표를 정의하고 쿼리로 구현합니다. PostgreSQL, BigQuery, MySQL 중 하나를 골라 브라우저에서 바로 실행하고, 결과 집합 비교로 즉시 채점됩니다.
        </p>
      </div>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {sets.map((s) => {
          const problems = setProblems(s);
          return (
            <li key={s.id} className="flex flex-col rounded-card border border-line bg-surface p-5">
              <div className="flex items-center gap-2">
                <Badge size="sm" tone={s.mode === "mock" ? "accent" : "neutral"}>
                  {s.mode === "mock" ? "모의 시험" : "연습"}
                </Badge>
                <span className="text-xs text-muted">{problems.length}문제</span>
              </div>
              <h2 className="mt-3 text-lg font-semibold tracking-tight">{s.title}</h2>
              <p className="mt-1.5 flex-1 text-[13.5px] leading-relaxed text-fg/75">{s.description}</p>
              <div className="mt-5 flex gap-2">
                <Link href={`/sets/${s.id}`} className="inline-flex h-9 items-center rounded-lg bg-fg/10 px-3 text-sm font-medium hover:bg-fg/15">
                  문제 보기
                </Link>
                {s.mode === "mock" && (
                  <Link href={`/mock/${s.id}`} className="inline-flex h-9 items-center rounded-lg bg-accent px-3 text-sm font-semibold text-white hover:bg-accent/85">
                    시험 시작
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
