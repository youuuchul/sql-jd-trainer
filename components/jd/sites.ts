/** 사이트별 공개 검색 주소. 2026-11-07 각 주소를 실제로 열어 검색어가 결과 제목에 반영되는 것을 확인했다. */
export interface JobSite {
  id: string;
  name: string;
  url: (query: string) => string;
}

const q = encodeURIComponent;

export const JOB_SITES: JobSite[] = [
  { id: "wanted", name: "원티드", url: (s) => `https://www.wanted.co.kr/search?query=${q(s)}&tab=position` },
  { id: "saramin", name: "사람인", url: (s) => `https://www.saramin.co.kr/zf_user/search?searchword=${q(s)}` },
  { id: "jobkorea", name: "잡코리아", url: (s) => `https://www.jobkorea.co.kr/Search/?stext=${q(s)}` },
  { id: "jumpit", name: "점핏", url: (s) => `https://jumpit.saramin.co.kr/search?keyword=${q(s)}` },
];

export const BASE_QUERY = "데이터 분석가";
export const KEYWORDS = ["SQL", "Python", "BigQuery", "Tableau"] as const;
