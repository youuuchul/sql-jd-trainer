import type { Problem } from "@/lib/content/types";
import type { QueryResult } from "@/lib/engine/types";
import { resultHash, type CompareResult } from "./compare";

export interface Diagnosis {
  label: string;
  explanation: string;
  source: "pattern" | "rule";
}

/** 사전 계산한 오답 패턴 해시를 먼저 보고, 없으면 행 수 관계로 규칙 진단을 낸다. */
export const diagnose = (problem: Problem, result: QueryResult, cmp: CompareResult): Diagnosis[] => {
  const out: Diagnosis[] = [];
  const hash = resultHash(result);
  for (const p of problem.wrongPatterns) {
    if (p.resultHash && p.resultHash === hash) out.push({ label: p.label, explanation: p.explanation, source: "pattern" });
  }
  if (out.length) return out;

  const { expectedRows, actualRows } = cmp;
  if (cmp.mismatches.some((m) => m.kind === "column-count")) {
    out.push({ label: "출력 컬럼 확인", explanation: "요구한 컬럼 수와 다릅니다. 문제의 출력 형식을 다시 확인하세요.", source: "rule" });
    return out;
  }
  if (cmp.mismatches.some((m) => m.kind === "order")) {
    out.push({ label: "정렬 조건", explanation: "값은 맞지만 ORDER BY가 요구 조건과 다릅니다. 정렬 기준과 방향, 동점 처리를 확인하세요.", source: "rule" });
    return out;
  }
  if (expectedRows > 0 && actualRows > expectedRows) {
    const ratio = actualRows / expectedRows;
    if (Number.isInteger(ratio) && ratio >= 2) {
      out.push({ label: "조인 팬아웃 의심", explanation: `결과 행이 기대의 정확히 ${ratio}배입니다. 1:N 관계를 조인한 뒤 집계하거나 DISTINCT 없이 세고 있는지 확인하세요.`, source: "rule" });
    } else {
      out.push({ label: "행이 많음", explanation: "기대보다 행이 많습니다. 필터 조건 누락, 그룹 기준 과다, 중복 행을 의심하세요.", source: "rule" });
    }
  } else if (expectedRows > 0 && actualRows < expectedRows) {
    out.push({ label: "행이 적음", explanation: "기대보다 행이 적습니다. INNER JOIN으로 빠진 행, WHERE에 들어간 LEFT JOIN 조건, NOT IN과 NULL, 날짜 경계(BETWEEN 끝 시각)를 확인하세요.", source: "rule" });
  } else if (cmp.missing.length || cmp.extra.length) {
    out.push({ label: "값 불일치", explanation: "행 수는 맞지만 값이 다릅니다. 집계 분모, 정수 나눗셈, 반올림 자릿수, 취소·환불 반영 여부를 확인하세요.", source: "rule" });
  }
  return out;
};
