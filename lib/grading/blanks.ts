/** 정답 쿼리를 빈칸 기준으로 나눈 것. parts 는 빈칸 사이의 글(빈칸 수 + 1개), answers 는 빈칸 순서대로의 원래 글 */
export interface BlankSplit {
  parts: string[];
  answers: string[];
}

/**
 * 정답 쿼리에서 빈칸으로 가릴 글을 찾아 나눈다. 가릴 글은 쿼리에 정확히 한 번씩 있어야 하고 서로 겹치면 안 된다.
 *
 * Args:
 *   solution: 정답 쿼리.
 *   tokens: 가릴 글 목록(순서 무관).
 *
 * Returns:
 *   쿼리에 나오는 순서로 나눈 결과. 조건에 맞지 않으면 null.
 */
export const splitBlanks = (solution: string, tokens: string[]): BlankSplit | null => {
  if (!tokens.length) return null;
  const found: { at: number; token: string }[] = [];
  for (const token of tokens) {
    const at = solution.indexOf(token);
    if (!token.trim() || at === -1 || solution.indexOf(token, at + 1) !== -1) return null;
    found.push({ at, token });
  }
  found.sort((a, b) => a.at - b.at);
  const parts: string[] = [];
  let pos = 0;
  for (const f of found) {
    if (f.at < pos) return null;
    parts.push(solution.slice(pos, f.at));
    pos = f.at + f.token.length;
  }
  parts.push(solution.slice(pos));
  return { parts, answers: found.map((f) => f.token) };
};

/** 괄호와 작은따옴표의 짝이 맞는지. 짝이 안 맞는 글은 식 중간에서 잘린 것이라 빈칸으로 쓰지 않는다 */
export const isBalanced = (text: string): boolean => {
  let depth = 0;
  for (const ch of text) {
    if (ch === "(") depth++;
    else if (ch === ")" && --depth < 0) return false;
  }
  return depth === 0 && text.split("'").length % 2 === 1;
};

/** 빈칸에 넣은 글로 쿼리를 다시 잇는다 */
export const joinBlanks = (parts: string[], values: string[]): string => parts.map((p, i) => p + (i < values.length ? values[i] : "")).join("");
