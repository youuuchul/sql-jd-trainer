"use client";
import CodeMirror, { EditorView, keymap, type Extension } from "@uiw/react-codemirror";
import { MySQL, PostgreSQL, StandardSQL, sql } from "@codemirror/lang-sql";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { useMemo } from "react";
import type { Dialect } from "@/lib/content/types";

const theme = EditorView.theme(
  {
    "&": { backgroundColor: "var(--color-bg)", color: "var(--color-fg)" },
    ".cm-content": { caretColor: "var(--color-fg)", padding: "12px 0" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--color-fg)" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "color-mix(in srgb, var(--color-accent) 35%, transparent)",
    },
    ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--color-fg) 4%, transparent)" },
    ".cm-gutters": { backgroundColor: "var(--color-bg)", color: "var(--color-muted)", border: "none", paddingLeft: "6px" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--color-fg)" },
    ".cm-lineNumbers .cm-gutterElement": { minWidth: "2.4em" },
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

export interface SqlEditorProps {
  value: string;
  onChange: (v: string) => void;
  dialect: Dialect;
  onRun?: () => void;
  readOnly?: boolean;
}

export function SqlEditor({ value, onChange, dialect, onRun, readOnly = false }: SqlEditorProps) {
  const extensions = useMemo<Extension[]>(
    () => [
      sql({ dialect: DIALECT_MAP[dialect], upperCaseKeywords: true }),
      theme,
      syntaxHighlighting(highlight),
      keymap.of([{ key: "Mod-Enter", run: () => (onRun?.(), true) }]),
      EditorView.lineWrapping,
    ],
    [dialect, onRun],
  );
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
