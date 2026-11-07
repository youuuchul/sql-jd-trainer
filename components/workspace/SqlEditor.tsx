"use client";
import CodeMirror, { EditorView, keymap, Prec, type Extension } from "@uiw/react-codemirror";
import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { MySQL, PostgreSQL, StandardSQL, sql, type SQLNamespace } from "@codemirror/lang-sql";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { useMemo } from "react";
import type { Dialect, SchemaDef } from "@/lib/content/types";

const theme = EditorView.theme(
  {
    "&": { backgroundColor: "var(--color-code-bg)", color: "var(--color-code-fg)" },
    ".cm-content": { caretColor: "var(--color-fg)", padding: "12px 0" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--color-fg)" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "color-mix(in srgb, var(--color-accent) 35%, transparent)",
    },
    ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--color-fg) 4%, transparent)" },
    ".cm-gutters": { backgroundColor: "var(--color-code-bg)", color: "var(--color-faint)", border: "none", paddingLeft: "6px" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--color-fg-2)" },
    ".cm-lineNumbers .cm-gutterElement": { minWidth: "2.4em" },
    ".cm-tooltip": { backgroundColor: "var(--color-surface)", color: "var(--color-fg)", border: "1px solid var(--color-line-2)", borderRadius: "12px", overflow: "hidden", boxShadow: "0 10px 28px -12px rgb(0 0 0 / 0.35)" },
    ".cm-tooltip-autocomplete > ul": { fontFamily: "var(--font-mono)", fontSize: "12.5px" },
    ".cm-tooltip-autocomplete > ul > li": { padding: "3px 10px" },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "var(--color-accent-soft)", color: "var(--color-accent-ink)" },
    ".cm-completionDetail": { color: "var(--color-muted)", fontStyle: "normal" },
    ".cm-completionMatchedText": { textDecoration: "none", fontWeight: "700", color: "var(--color-accent-ink)" },
    ".cm-completionInfo": { backgroundColor: "var(--color-surface)", color: "var(--color-fg-2)", border: "1px solid var(--color-line-2)" },
    ".cm-matchingBracket": { backgroundColor: "color-mix(in srgb, var(--color-accent) 25%, transparent)", outline: "none" },
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
  { tag: t.keyword, color: "var(--color-syntax-keyword)", fontWeight: "500" },
  { tag: [t.string, t.special(t.string)], color: "var(--color-syntax-string)" },
  { tag: [t.number, t.bool, t.null], color: "var(--color-syntax-number)" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "var(--color-syntax-comment)", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.standard(t.name)], color: "var(--color-syntax-function)" },
  { tag: t.operator, color: "var(--color-fg)" },
  { tag: t.typeName, color: "var(--color-dialect-bq)" },
]);

const DIALECT_MAP = { postgres: PostgreSQL, mysql: MySQL, bigquery: StandardSQL } as const;

/** 테이블과 "테이블." "별칭." 뒤 컬럼 자동완성용 네임스페이스 */
const toNamespace = (schema: SchemaDef): SQLNamespace =>
  Object.fromEntries(
    schema.tables.map((t) => [
      t.name,
      {
        self: { label: t.name, type: "type", detail: t.grain, info: t.description },
        children: t.columns.map((c) => ({ label: c.name, type: "property", detail: c.type, info: c.description })),
      },
    ]),
  );

/** 접두어 없이 입력한 컬럼 이름. 점 뒤는 스키마 자동완성이 맡는다 */
const columnSource = (schema: SchemaDef) => {
  const seen = new Map<string, Completion>();
  for (const t of schema.tables)
    for (const c of t.columns) {
      const prev = seen.get(c.name);
      seen.set(c.name, { label: c.name, type: "property", detail: prev ? `${prev.detail}, ${t.name}` : t.name, boost: -1 });
    }
  const options = [...seen.values()];
  return (ctx: CompletionContext): CompletionResult | null => {
    const word = ctx.matchBefore(/\w+/);
    if (!word || (word.from === word.to && !ctx.explicit)) return null;
    if (ctx.state.sliceDoc(word.from - 1, word.from) === ".") return null;
    return { from: word.from, options, validFor: /^\w*$/ };
  };
};

export interface SqlEditorProps {
  value: string;
  onChange: (v: string) => void;
  dialect: Dialect;
  onRun?: () => void;
  readOnly?: boolean;
  /** 주면 테이블·컬럼을 자동완성한다 */
  schema?: SchemaDef;
}

export function SqlEditor({ value, onChange, dialect, onRun, readOnly = false, schema }: SqlEditorProps) {
  const extensions = useMemo<Extension[]>(() => {
    const lang = sql({ dialect: DIALECT_MAP[dialect], upperCaseKeywords: true, schema: schema ? toNamespace(schema) : undefined });
    return [
      lang,
      ...(schema ? [lang.language.data.of({ autocomplete: columnSource(schema) })] : []),
      theme,
      syntaxHighlighting(highlight),
      Prec.highest(keymap.of([{ key: "Mod-Enter", run: () => (onRun?.(), true) }])),
      EditorView.lineWrapping,
    ];
  }, [dialect, onRun, schema]);
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      height="100%"
      readOnly={readOnly}
      theme="none"
      basicSetup={{ foldGutter: false, highlightActiveLineGutter: true, autocompletion: true, searchKeymap: false }}
      className="h-full"
      aria-label="SQL 편집기"
    />
  );
}
