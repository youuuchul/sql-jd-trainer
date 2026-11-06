/** 공고 분석 추천 문제로 만든 모의 시험 세트. 브라우저 localStorage 에만 저장하고 /mock/jd 가 읽는다 */
export const JD_MOCK_SET_ID = "jd";
export const JD_MOCK_SET_KEY = "sjt:mock:jd:v1";
/** 추천 순서대로 앞에서부터 이만큼만 담는다 */
export const JD_MOCK_MAX_PROBLEMS = 6;
/** 제한 시간은 담긴 문제의 권장 시간 합과 이 값 중 작은 값 */
export const JD_MOCK_MAX_MIN = 60;

export interface JdMockSet {
  problems: string[];
  /** 추천 근거가 된 역량 라벨 */
  competencies: string[];
}

export const saveJdMockSet = (set: JdMockSet) => window.localStorage.setItem(JD_MOCK_SET_KEY, JSON.stringify(set));

export const parseJdMockSet = (raw: string | null): JdMockSet | null => {
  try {
    const v = JSON.parse(raw ?? "null") as Partial<JdMockSet> | null;
    if (!Array.isArray(v?.problems)) return null;
    return { problems: v.problems.filter((id) => typeof id === "string").slice(0, JD_MOCK_MAX_PROBLEMS), competencies: Array.isArray(v.competencies) ? v.competencies : [] };
  } catch {
    return null;
  }
};
