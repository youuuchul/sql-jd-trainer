import type { Dialect, Review, ReviewDecoy, ReviewDefect } from "@/lib/content/types";
import type { ReviewMark } from "@/lib/progress";

export type MarkVerdict = "hit" | "wrong-type" | "false";
export type DefectStatus = "found" | "wrong-type" | "missed";

export interface ReviewGrade {
  pass: boolean;
  total: number;
  found: number;
  wrongType: number;
  falseMarks: number;
  /** 표시한 줄 번호별 판정 */
  verdicts: Record<number, MarkVerdict>;
  defects: { defect: ReviewDefect; status: DefectStatus }[];
}

const applies = (ref: { dialects?: Dialect[] }, dialect: Dialect) => !ref.dialects || ref.dialects.includes(dialect);

export const reviewDefects = (review: Review, dialect: Dialect): ReviewDefect[] => review.defects.filter((d) => applies(d, dialect));
export const reviewDecoys = (review: Review, dialect: Dialect): ReviewDecoy[] => review.decoys.filter((d) => applies(d, dialect));

/** 결함 줄에 같은 유형으로 표시하면 찾음. 모든 결함을 찾고 모든 표시가 맞아야 통과 */
export const gradeReview = (review: Review, dialect: Dialect, marks: ReviewMark[]): ReviewGrade => {
  const defects = reviewDefects(review, dialect);
  const lineOwner = new Map<number, ReviewDefect>();
  for (const d of defects) for (const l of d.lines[dialect] ?? []) lineOwner.set(l, d);

  const verdicts: Record<number, MarkVerdict> = {};
  for (const m of marks) {
    const owner = lineOwner.get(m.line);
    verdicts[m.line] = !owner ? "false" : owner.category === m.category ? "hit" : "wrong-type";
  }
  const statuses = defects.map((defect) => {
    const own = marks.filter((m) => lineOwner.get(m.line) === defect);
    const status: DefectStatus = own.some((m) => m.category === defect.category) ? "found" : own.length ? "wrong-type" : "missed";
    return { defect, status };
  });
  const values = Object.values(verdicts);
  const found = statuses.filter((s) => s.status === "found").length;
  const wrongType = values.filter((v) => v === "wrong-type").length;
  const falseMarks = values.filter((v) => v === "false").length;
  return { pass: found === defects.length && wrongType === 0 && falseMarks === 0, total: defects.length, found, wrongType, falseMarks, verdicts, defects: statuses };
};
