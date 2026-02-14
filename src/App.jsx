import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  Code,
  Play,
  CheckCircle,
  AlertCircle,
  Cpu,
  Briefcase,
  ChevronRight,
  Layout,
  MessageSquare,
  Loader2,
  Table as TableIcon,
  LinkIcon,
  FileDown
} from 'lucide-react';

// Lazy PDF.js loader (browser-only, uses CDN to avoid bundling)
const loadPdfJs = async () => {
  if (window.__pdfjs) return window.__pdfjs;
  // Use ESM build from CDN
  const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
  // Worker via CDN as well
  pdfjs.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
  window.__pdfjs = pdfjs;
  return pdfjs;
};

// Lazy CodeMirror loader (browser-only, uses CDN to avoid bundling)
const loadCodeMirror = async () => {
  if (window.__codemirror) return window.__codemirror;

  const [
    cmView,
    cmState,
    cmCommands,
    cmLangSql,
    cmComment,
    cmLanguage,
  ] = await Promise.all([
    import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@codemirror/view@6.36.4/dist/index.min.js'),
    import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@codemirror/state@6.4.1/dist/index.min.js'),
    import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@codemirror/commands@6.3.3/dist/index.min.js'),
    import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@codemirror/lang-sql@6.8.0/dist/index.min.js'),
    import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@codemirror/comment@6.3.1/dist/index.min.js'),
    import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@codemirror/language@6.10.2/dist/index.min.js'),
  ]);

  const {
    EditorView,
    keymap,
    lineNumbers,
    highlightActiveLine,
    highlightActiveLineGutter,
    drawSelection,
    dropCursor,
    highlightSpecialChars,
  } = cmView;
  const { EditorState } = cmState;
  const { defaultKeymap, history, historyKeymap, indentWithTab } = cmCommands;
  const { sql, MySQL } = cmLangSql;
  const { commentKeymap } = cmComment;
  const { indentOnInput, syntaxHighlighting, defaultHighlightStyle } = cmLanguage;

  const theme = EditorView.theme({
    "&": { height: "100%", fontSize: "12px" },
    ".cm-scroller": {
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    },
    ".cm-content": { padding: "12px" },
    ".cm-gutters": { backgroundColor: "transparent", border: "none", color: "#94a3b8" },
  });

  const extensions = (onChange) => [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    highlightSpecialChars(),
    history(),
    drawSelection(),
    dropCursor(),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    sql({ dialect: MySQL }),
    keymap.of([...commentKeymap, indentWithTab, ...defaultKeymap, ...historyKeymap]),
    EditorView.updateListener.of((v) => {
      if (v.docChanged) onChange(v.state.doc.toString());
    }),
    EditorView.lineWrapping,
    theme,
  ];

  const api = { EditorView, EditorState, extensions };
  window.__codemirror = api;
  return api;
};

const STORAGE_KEY = 'sqlJdSessions';
const SESSION_LIMIT = 20;

/**
 * SQL-JD-Trainer
 * * A React application that generates SQL problems based on Job Descriptions (JD),
 * creates a virtual in-memory database, and allows users to practice SQL queries
 * with AI feedback.
 * * Tech Stack: React, Tailwind CSS, AlaSQL (In-memory DB), Google Gemini API
 */

// --- Constants & Prompts ---

const SYSTEM_PROMPT_ANALYSIS = `
당신은 시니어 데이터 엔지니어이자 SQL 면접관입니다.
입력된 JD를 분석해 핵심 SQL 역량을 추출하고, 도메인에 맞는 스키마와 문제 3개를 생성하세요.

언어 규칙(매우 중요):
- 사용자에게 노출되는 모든 텍스트(도메인, 키워드, 난이도, 제목, 설명, 힌트, expectedLogic)는 한국어로 작성합니다.
- 테이블명/컬럼명/스키마 구조는 반드시 영어로 유지합니다.
- SQL 키워드(JOIN, GROUP BY 등)는 원문 그대로 사용 가능합니다.

출력은 반드시 JSON 하나만 반환하세요.
구조:
{
  "domain": "한국어 문자열",
  "keywords": ["한국어", "한국어"],
  "schema": [
    {
      "tableName": "string",
      "columns": ["col1", "col2"],
      "data": [
        {"col1": val, "col2": val},
        {"col1": val, "col2": val} 
      ] 
    }
  ],
  "problems": [
    {
      "id": 1,
      "difficulty": "주니어/미들/시니어",
      "title": "한국어 문자열",
      "description": "한국어 문자열",
      "expectedLogic": "한국어로 SQL 로직 요약",
      "hint": "한국어 문자열"
    }
  ]
}

조건:
- 각 테이블에 5~10행 이상의 현실적인 샘플 데이터 포함
- JD에 언급된 요구사항을 문제에 반영(예: Window Function 언급 시 RANK/ROW_NUMBER 포함)
`;

const SYSTEM_PROMPT_FEEDBACK = `
당신은 친절하고 정확한 SQL 튜터입니다.
사용자의 SQL 쿼리를 문제 설명과 스키마 기준으로 검토하세요.
간결하고 건설적인 피드백을 한국어로 제공합니다.
- 오류가 있으면 무엇이 잘못되었는지 쉽게 설명합니다.
- 정답이라도 더 나은 작성법(CTE, 윈도우 함수 최적화 등)이 있으면 제안합니다.
JSON 형식으로 답하세요: { "feedback": "문장", "isCorrect": true/false }.
`;

const SYSTEM_PROMPT_TRANSLATE = `
다음 problems 배열을 한국어로 정제하세요.
규칙:
- id 값은 유지
- difficulty/title/description/expectedLogic/hint는 한국어로 변환
- SQL 키워드(JOIN, GROUP BY 등)는 그대로 유지 가능
JSON 형식으로만 반환: { "problems": [ ... ] }
`;

const SYSTEM_PROMPT_LOCALIZE = `
다음 JSON의 사용자 노출 텍스트를 한국어로 변환하세요.
규칙:
- domain, keywords, problems 내부 텍스트를 한국어로 변환
- problems는 id 유지, difficulty/title/description/expectedLogic/hint만 변환
- SQL 키워드(JOIN, GROUP BY 등)는 그대로 유지 가능
JSON 형식으로만 반환: { "domain": "...", "keywords": ["..."], "problems": [ ... ] }
`;

const getSafeId = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const hasKorean = (text = '') => /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(text);
const needsKoreanRewrite = (analysis) => {
  if (!analysis?.problems?.length) return false;
  return analysis.problems.some((p) => {
    if (!hasKorean(p.title)) return true;
    if (!hasKorean(p.description)) return true;
    if (p.hint && !hasKorean(p.hint)) return true;
    if (p.expectedLogic && !hasKorean(p.expectedLogic)) return true;
    if (p.difficulty && !hasKorean(p.difficulty)) return true;
    return false;
  });
};
const needsKoreanLocalization = (analysis) => {
  if (!analysis) return false;
  if (!hasKorean(analysis.domain || '')) return true;
  if (Array.isArray(analysis.keywords) && analysis.keywords.length > 0) {
    const anyKorean = analysis.keywords.some((k) => hasKorean(String(k)));
    if (!anyKorean) return true;
  }
  if (needsKoreanRewrite(analysis)) return true;
  return false;
};

const normalizeSql = (sql = '') =>
  sql
    .split('\n')
    .map((line) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith('#')) {
        return line.replace('#', '--');
      }
      if (trimmed.startsWith('//')) {
        return line.replace('//', '--');
      }
      return line;
    })
    .join('\n');

// Offline mock for demo / fallback
const MOCK_ANALYSIS = {
  domain: "E-commerce",
  keywords: ["JOIN", "GROUP BY", "Window Functions", "Cohort"],
  schema: [
    {
      tableName: "customers",
      columns: ["customer_id", "country", "signup_date"],
      data: [
        { customer_id: 1, country: "US", signup_date: "2024-01-05" },
        { customer_id: 2, country: "KR", signup_date: "2024-02-10" },
        { customer_id: 3, country: "US", signup_date: "2024-02-18" },
        { customer_id: 4, country: "JP", signup_date: "2024-03-01" },
        { customer_id: 5, country: "KR", signup_date: "2024-03-15" },
      ],
    },
    {
      tableName: "orders",
      columns: ["order_id", "customer_id", "order_date", "amount"],
      data: [
        { order_id: 101, customer_id: 1, order_date: "2024-03-02", amount: 120 },
        { order_id: 102, customer_id: 2, order_date: "2024-03-05", amount: 80 },
        { order_id: 103, customer_id: 3, order_date: "2024-03-08", amount: 200 },
        { order_id: 104, customer_id: 1, order_date: "2024-03-10", amount: 60 },
        { order_id: 105, customer_id: 4, order_date: "2024-03-12", amount: 150 },
        { order_id: 106, customer_id: 5, order_date: "2024-03-15", amount: 90 },
        { order_id: 107, customer_id: 2, order_date: "2024-03-20", amount: 300 },
        { order_id: 108, customer_id: 3, order_date: "2024-03-22", amount: 50 },
      ],
    },
  ],
  problems: [
    {
      id: 1,
      difficulty: "Junior",
      title: "국가별 주문 건수 집계",
      description: "고객 국가별로 주문 수를 집계하고 건수 기준 내림차순으로 정렬하세요.",
      expectedLogic: "JOIN + GROUP BY + ORDER BY",
      hint: "customers.country 를 GROUP BY 하고 COUNT(*)",
    },
    {
      id: 2,
      difficulty: "Middle",
      title: "월별 매출 및 신규 고객 여부",
      description: "주문을 월 단위로 묶어 총 매출을 계산하고, 해당 월에 가입한 신규 고객 수를 함께 표시하세요.",
      expectedLogic: "DATE_TRUNC, GROUP BY, conditional COUNT",
      hint: "signup_date와 order_date를 같은 월로 묶어 JOIN",
    },
    {
      id: 3,
      difficulty: "Senior",
      title: "고객별 누적 매출 랭킹",
      description: "고객별 총매출을 계산하고, 윈도우 함수를 사용해 매출 순위를 매기세요.",
      expectedLogic: "SUM + WINDOW (RANK/DENSE_RANK)",
      hint: "SUM(amount) OVER(PARTITION BY customer_id) 후 랭크",
    },
  ],
};

// --- Components ---

const LoadingOverlay = ({ message }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
    <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-2xl flex flex-col items-center max-w-sm text-center">
      <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
      <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">처리 중</h3>
      <p className="text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  </div>
);

const SchemaViewer = ({ schema }) => (
  <div className="space-y-4">
    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">데이터베이스 스키마</h3>
    {schema.map((table) => (
      <div key={table.tableName} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-800 px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <TableIcon className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">{table.tableName}</span>
        </div>
        <div className="p-3 bg-white dark:bg-slate-900">
          <div className="flex flex-wrap gap-2">
            {table.columns.map((col) => (
              <span key={col} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-xs rounded text-slate-600 dark:text-slate-400 font-mono">
                {col}
              </span>
            ))}
          </div>
        </div>
      </div>
    ))}
  </div>
);

const ResultTable = ({ data, error }) => {
  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg flex items-start gap-3">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="font-mono text-sm whitespace-pre-wrap">{error}</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 italic">
        <TableIcon className="w-12 h-12 mb-2 opacity-20" />
        표시할 결과가 없습니다. 쿼리를 실행해보세요.
      </div>
    );
  }

  const columns = Object.keys(data[0]);

  return (
    <div className="overflow-auto h-full border rounded-lg border-slate-200 dark:border-slate-700 shadow-sm">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 sticky top-0">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-4 py-3 font-semibold border-b border-slate-200 dark:border-slate-700">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
          {data.map((row, idx) => (
            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              {columns.map((col) => (
                <td key={`${idx}-${col}`} className="px-4 py-2 text-slate-600 dark:text-slate-400 font-mono">
                  {row[col] !== null ? String(row[col]) : <span className="text-slate-300">NULL</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const SqlEditor = ({ value, onChange }) => {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cm = await loadCodeMirror();
        if (cancelled || !hostRef.current) return;
        const state = cm.EditorState.create({
          doc: value || '',
          extensions: cm.extensions((nextValue) => onChange(nextValue)),
        });
        viewRef.current = new cm.EditorView({
          state,
          parent: hostRef.current,
        });
        setReady(true);
      } catch (err) {
        console.warn('CodeMirror load failed, fallback to textarea', err);
      }
    })();
    return () => {
      cancelled = true;
      if (viewRef.current) viewRef.current.destroy();
    };
  }, []);

  // Persist last query per session (debounced)
  useEffect(() => {
    if (!currentSessionId || view !== 'workspace') return;
    const timer = setTimeout(() => {
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === currentSessionId ? { ...s, lastQuery: userQuery } : s
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [currentSessionId, userQuery, view]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value || '' },
      });
    }
  }, [value]);

  return (
    <div className="absolute inset-0">
      <div ref={hostRef} className="h-full w-full" />
      {!ready && (
        <textarea
          className="absolute inset-0 w-full h-full p-4 font-mono text-sm bg-transparent border-none outline-none resize-none text-slate-800 dark:text-slate-200 leading-6"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          placeholder="SELECT * FROM orders..."
        />
      )}
    </div>
  );
};

// --- Main Application ---

export default function App() {
  // State
  const [view, setView] = useState('setup'); // 'setup' | 'workspace'
  const [jdText, setJdText] = useState('');
  const [inputMode, setInputMode] = useState('text'); // 'text' | 'url'
  const [urlInput, setUrlInput] = useState('');
  const [urlStatus, setUrlStatus] = useState({ loading: false, error: '' });
  const [pdfStatus, setPdfStatus] = useState({ loading: false, error: '' });
  const [sourceLabel, setSourceLabel] = useState('수동 입력');
  const [sessions, setSessions] = useState([]);
  const [sessionFilter, setSessionFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [apiStats, setApiStats] = useState({
    calls: 0,
    lastModel: 'gemini-2.5-flash-preview-09-2025',
    keyPresent: !!import.meta.env.VITE_GEMINI_API_KEY
  });
  const [dbMode, setDbMode] = useState('browser'); // 'browser' | 'mysql'
  const [backendStatus, setBackendStatus] = useState({ checked: false, available: false, error: '' });

  const toKoreanDifficulty = (value) => {
    const normalized = String(value || '').toLowerCase();
    const map = { junior: '주니어', middle: '미들', senior: '시니어' };
    return map[normalized] || value;
  };

  // Data State
  const [analysis, setAnalysis] = useState(null); // { domain, keywords, schema, problems }
  const [currentProblemIdx, setCurrentProblemIdx] = useState(0);
  const [userQuery, setUserQuery] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [queryError, setQueryError] = useState(null);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [dbReady, setDbReady] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  // References
  const alasqlRef = useRef(null);
  const pdfInputRef = useRef(null);

  // Initialize AlaSQL
  useEffect(() => {
    const initSqlEngine = async () => {
      const registerSqlFunctions = (alasql) => {
        if (!alasql?.fn) return;

        const toDate = (val) => {
          if (val instanceof Date) return val;
          if (typeof val === 'number') return new Date(val);
          return new Date(String(val));
        };

        // Supports DATEDIFF(end, start) and DATEDIFF(unit, start, end)
        alasql.fn.DATEDIFF = (...args) => {
          if (args.length < 2) return null;
          if (args.length === 2) {
            const [end, start] = args;
            const diffMs = toDate(end) - toDate(start);
            return Math.floor(diffMs / 86400000);
          }
          const [unitRaw, start, end] = args;
          const unit = String(unitRaw || '').toLowerCase();
          const startDate = toDate(start);
          const endDate = toDate(end);
          const diffMs = endDate - startDate;

          if (['year', 'yy', 'yyyy'].includes(unit)) {
            return endDate.getFullYear() - startDate.getFullYear();
          }
          if (['month', 'mm', 'm'].includes(unit)) {
            return (
              (endDate.getFullYear() - startDate.getFullYear()) * 12 +
              (endDate.getMonth() - startDate.getMonth())
            );
          }
          if (['day', 'dd', 'd'].includes(unit)) {
            return Math.floor(diffMs / 86400000);
          }
          if (['hour', 'hh'].includes(unit)) {
            return Math.floor(diffMs / 3600000);
          }
          if (['minute', 'mi', 'n'].includes(unit)) {
            return Math.floor(diffMs / 60000);
          }
          if (['second', 'ss', 's'].includes(unit)) {
            return Math.floor(diffMs / 1000);
          }
          return Math.floor(diffMs / 86400000);
        };
      };

      // Check if alasql is available globally (from CDN)
      // Since we can't easily inject CDN in this environment, we will check window.
      // If not, we will try to dynamically load it.
      if (!window.alasql) {
        try {
          const script = document.createElement('script');
          script.src = "https://cdn.jsdelivr.net/npm/alasql@4.0.0/dist/alasql.min.js";
          script.async = true;
          script.onload = () => {
            alasqlRef.current = window.alasql;
            registerSqlFunctions(alasqlRef.current);
            console.log("AlaSQL loaded successfully");
          };
          document.body.appendChild(script);
        } catch (e) {
          console.error("Failed to load AlaSQL", e);
        }
      } else {
        alasqlRef.current = window.alasql;
        registerSqlFunctions(alasqlRef.current);
      }
    };
    initSqlEngine();
  }, []);

  // Load saved sessions from localStorage on mount
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setSessions(JSON.parse(raw));
      } catch (e) {
        console.error('Failed to parse saved sessions', e);
      }
    }
  }, []);

  // Check backend availability (MySQL proxy)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/health');
        if (!res.ok) throw new Error(`API 응답 오류 (${res.status})`);
        if (cancelled) return;
        setBackendStatus({ checked: true, available: true, error: '' });
      } catch (e) {
        if (cancelled) return;
        setBackendStatus({ checked: true, available: false, error: e.message || '백엔드 연결 실패' });
        setDbMode('browser');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Gemini API Caller
  const callGemini = async (prompt, systemInstruction = "") => {
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
      if (!apiKey) {
        throw new Error("Gemini API 키가 없습니다. .env.local 파일에 VITE_GEMINI_API_KEY를 설정하세요.");
      }
      setApiStats((prev) => ({
        ...prev,
        calls: prev.calls + 1,
        lastModel: 'gemini-2.5-flash-preview-09-2025',
        keyPresent: true,
      }));
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: { responseMimeType: "application/json" }
          }),
        }
      );

      if (!response.ok) throw new Error("Gemini API 호출이 실패했습니다");

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return JSON.parse(text);
    } catch (error) {
      console.error("Gemini Error:", error);
      throw error;
    }
  };

  const initMysqlSchema = async (schema) => {
    const res = await fetch('/api/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schema }),
    });
    if (!res.ok) {
      let message = 'MySQL 초기화 실패';
      try {
        const data = await res.json();
        message = data?.error || message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }
  };

  const localizeAnalysis = async (analysis) => {
    const payload = {
      domain: analysis.domain,
      keywords: analysis.keywords,
      problems: analysis.problems,
    };
    const localized = await callGemini(JSON.stringify(payload), SYSTEM_PROMPT_LOCALIZE);
    if (!localized) return analysis;
    return {
      ...analysis,
      domain: localized.domain || analysis.domain,
      keywords: localized.keywords || analysis.keywords,
      problems: localized.problems || analysis.problems,
    };
  };

  const extractTextFromPdf = async (file) => {
    const pdfjs = await loadPdfJs();
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;
    let text = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      text += content.items.map((i) => i.str).join(' ') + '\n';
    }
    return text;
  };

  const handlePdfUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPdfStatus({ loading: true, error: '' });
    try {
      const text = await extractTextFromPdf(file);
      if (!text.trim()) throw new Error('PDF에서 텍스트를 찾지 못했습니다');
      setJdText(text.trim());
      setInputMode('text');
      setSourceLabel(`PDF · ${file.name}`);
    } catch (err) {
      setPdfStatus({ loading: false, error: err.message || 'PDF 추출 실패' });
      return;
    }
    setPdfStatus({ loading: false, error: '' });
  };

  const persistSessions = (list) => {
    setSessions(list);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  };

  const saveSession = (payload) => {
    const newList = [payload, ...sessions].slice(0, SESSION_LIMIT);
    setCurrentSessionId(payload.id);
    persistSessions(newList);
  };

  const buildDatabaseFromAnalysis = (result, initialQuery = '') => {
    if (!alasqlRef.current) throw new Error("SQL Engine not loaded yet. Please refresh.");

    alasqlRef.current('CREATE DATABASE IF NOT EXISTS sql_trainer; USE sql_trainer;');
    result.schema.forEach(table => {
      alasqlRef.current(`DROP TABLE IF EXISTS ${table.tableName}`);
      const colDefs = table.columns.map(c => `${c} STRING`).join(', ');
      alasqlRef.current(`CREATE TABLE ${table.tableName} (${colDefs})`);
      if (table.data && table.data.length > 0) {
        alasqlRef.current(`SELECT * INTO ${table.tableName} FROM ?`, [table.data]);
      }
    });
    setDbReady(true);
    setCurrentProblemIdx(0);
    setQueryResult(null);
    setQueryError(null);
    setAiFeedback(null);
    if (initialQuery) {
      setUserQuery(initialQuery);
    } else if (result.schema.length > 0) {
      setUserQuery(`SELECT * FROM ${result.schema[0].tableName} LIMIT 5;`);
    }
  };

  const handleAnalyzeJD = async () => {
    if (!jdText.trim()) return;

    setLoading(true);
    setLoadingMsg("JD를 분석하고 키워드를 추출하는 중...");

    try {
      // 1. Analyze JD & Generate Schema/Problems
      let result;
      let usedMock = false;
      try {
        result = await callGemini(jdText, SYSTEM_PROMPT_ANALYSIS);
      } catch (apiErr) {
        console.warn("Gemini failed, falling back to mock dataset", apiErr);
        setApiStats((prev) => ({
          ...prev,
          keyPresent: !!import.meta.env.VITE_GEMINI_API_KEY,
        }));
        usedMock = true;
        result = MOCK_ANALYSIS;
        setApiStats((prev) => ({ ...prev, lastModel: 'offline-mock' }));
      }

      if (result && needsKoreanLocalization(result)) {
        setLoadingMsg("문제를 한국어로 보정하는 중...");
        try {
          // 1) 전체 텍스트 로컬라이즈 시도
          if (import.meta.env.VITE_GEMINI_API_KEY) {
            result = await localizeAnalysis(result);
          }
        } catch (rewriteErr) {
          console.warn("Korean localization failed", rewriteErr);
        }
        // 2) problems만 재보정(최후 단계)
        if (needsKoreanRewrite(result)) {
          try {
            const rewritten = await callGemini(
              JSON.stringify({ problems: result.problems }),
              SYSTEM_PROMPT_TRANSLATE
            );
            if (rewritten?.problems?.length) {
              result = { ...result, problems: rewritten.problems };
            }
          } catch (rewriteErr) {
            console.warn("Korean rewrite failed", rewriteErr);
          }
        }
      }
      setAnalysis(result);

      // 2. Initialize In-Memory DB
      setLoadingMsg(`가상 ${result.domain || 'Database'} 환경을 준비하는 중...`);

      if (backendStatus.available) {
        try {
          setLoadingMsg("MySQL에 스키마를 적용하는 중...");
          await initMysqlSchema(result.schema);
          setDbMode('mysql');
        } catch (e) {
          console.warn("MySQL init failed, falling back to browser DB", e);
          setDbMode('browser');
        }
      } else {
        setDbMode('browser');
      }

      const defaultQuery = result.schema.length > 0 ? `SELECT * FROM ${result.schema[0].tableName} LIMIT 5;` : '';
      buildDatabaseFromAnalysis(result, defaultQuery);
      setView('workspace');

      saveSession({
        id: getSafeId(),
        createdAt: Date.now(),
        jdText,
        analysis: result,
        sourceLabel: usedMock ? `${sourceLabel} · (mock)` : sourceLabel,
        lastQuery: defaultQuery,
      });
    } catch (err) {
      // Last-resort fallback: if analysis is missing, load mock and keep user in workspace
      if (!analysis) {
        try {
          const defaultQuery = MOCK_ANALYSIS.schema.length > 0
            ? `SELECT * FROM ${MOCK_ANALYSIS.schema[0].tableName} LIMIT 5;`
            : '';
          buildDatabaseFromAnalysis(MOCK_ANALYSIS, defaultQuery);
          setAnalysis(MOCK_ANALYSIS);
          setView('workspace');
          saveSession({
            id: getSafeId(),
            createdAt: Date.now(),
            jdText: '(offline mock)',
            analysis: MOCK_ANALYSIS,
            sourceLabel: 'offline mock',
            lastQuery: defaultQuery,
          });
          alert("네트워크 없이도 샘플 세션으로 시작합니다.");
          return;
        } catch (fallbackErr) {
          alert("JD 분석에 실패했습니다. 다시 시도해주세요. " + fallbackErr.message);
          return;
        }
      }
      alert("JD 분석에 실패했습니다. 다시 시도해주세요. " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSession = (session) => {
    (async () => {
      try {
        setLoading(true);
        setLoadingMsg("저장된 세션을 불러오는 중...");
        let analysisData = session.analysis;
        if (analysisData && needsKoreanLocalization(analysisData) && import.meta.env.VITE_GEMINI_API_KEY) {
          setLoadingMsg("저장된 세션을 한국어로 보정하는 중...");
          try {
            const localized = await localizeAnalysis(analysisData);
            analysisData = localized;
            // Update stored session to avoid repeated translation
            setSessions((prev) => {
              const updated = prev.map((s) =>
                s.id === session.id ? { ...s, analysis: localized } : s
              );
              localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
              return updated;
            });
          } catch (e) {
            console.warn("Session localization failed", e);
          }
        }
        setAnalysis(analysisData);
        setJdText(session.jdText);
        setSourceLabel(session.sourceLabel || '저장된 세션');
        if (backendStatus.available) {
          setLoadingMsg("MySQL에 스키마를 적용하는 중...");
          try {
            await initMysqlSchema(analysisData.schema);
            setDbMode('mysql');
          } catch (e) {
            console.warn("MySQL init failed, fallback to browser DB", e);
            setDbMode('browser');
          }
        } else {
          setDbMode('browser');
        }
        setCurrentSessionId(session.id);
        buildDatabaseFromAnalysis(analysisData, session.lastQuery || '');
        setView('workspace');
      } catch (err) {
        alert('세션을 불러오지 못했습니다: ' + err.message);
      } finally {
        setLoading(false);
      }
    })();
  };

  // Load JD text from a URL (basic fetch + HTML to text)
  const handleFetchFromUrl = async () => {
    if (!urlInput.trim()) return;
    setUrlStatus({ loading: true, error: '' });

    try {
      const res = await fetch(urlInput.trim());
      if (!res.ok) throw new Error(`Failed to load (status ${res.status})`);
      const html = await res.text();

      // Strip scripts/styles and return visible text
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      doc.querySelectorAll('script, style, noscript').forEach((el) => el.remove());
      const text = doc.body?.innerText || '';

      if (!text.trim()) throw new Error('페이지에서 텍스트를 찾지 못했습니다');

      setJdText(text.trim());
      setInputMode('text');
      try {
        const { hostname } = new URL(urlInput.trim());
        setSourceLabel(`URL · ${hostname}`);
      } catch {
        setSourceLabel('URL 입력');
      }
    } catch (err) {
      setUrlStatus({ loading: false, error: err.message || '불러오기 실패' });
      return;
    }

    setUrlStatus({ loading: false, error: '' });
  };

  const runQuery = async () => {
    setQueryError(null);
    setQueryResult(null);
    setAiFeedback(null);

    try {
      const normalizedQuery = normalizeSql(userQuery);
      if (dbMode === 'mysql') {
        const res = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql: normalizedQuery }),
        });
        if (!res.ok) {
          let message = '쿼리 실행 실패';
          try {
            const data = await res.json();
            message = data?.error || message;
          } catch {
            // ignore
          }
          throw new Error(message);
        }
        const data = await res.json();
        setQueryResult(data?.rows || []);
        return;
      }

      if (!alasqlRef.current) return;
      // Multiple statements support? AlaSQL supports it but returns array.
      // We focus on the last result for display usually.
      const res = alasqlRef.current(normalizedQuery);
      // AlaSQL returns array of arrays if multiple queries, or array of objects if single
      // We handle single query mostly
      if (Array.isArray(res) && res.length > 0 && Array.isArray(res[0])) {
        // Multiple queries, take the last one that looks like a result set
        setQueryResult(res[res.length - 1]);
      } else {
        setQueryResult(res);
      }
    } catch (e) {
      setQueryError(e.message);
    }
  };

  const askAiFeedback = async () => {
    setLoading(true);
    setLoadingMsg("AI가 쿼리를 검토하는 중...");
    try {
      const problem = analysis.problems[currentProblemIdx];
      const context = {
        problem: problem,
        userQuery: userQuery,
        queryError: queryError,
        // We don't send full data, just schema info usually
      };

      const prompt = JSON.stringify(context);
      // We use a simpler call here, expecting text response (not JSON forced)
      // Re-using callGemini but we need to change config if we want plain text. 
      // For simplicity, we ask for JSON with a 'feedback' field.

      const feedbackResponse = await callGemini(
        `다음은 사용자의 SQL 풀이입니다. JSON으로만 답하세요: { "feedback": "한국어 피드백", "isCorrect": true/false }\n컨텍스트: ${prompt}`,
        SYSTEM_PROMPT_FEEDBACK
      );

      setAiFeedback(feedbackResponse);

    } catch (e) {
      console.error(e);
      setAiFeedback({ feedback: "지금은 피드백을 가져오지 못했습니다.", isCorrect: false });
    } finally {
      setLoading(false);
    }
  };

  // --- Render Functions ---

  const renderSetup = () => (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6">
      <div className="max-w-5xl w-full space-y-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-blue-600 p-4 rounded-2xl shadow-lg">
              <Database className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-extrabold text-slate-800 dark:text-white tracking-tight">
            SQL JD Trainer
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            JD를 붙여 넣으면 필요한 SQL 스킬을 추출하고, 가상 DB와 맞춤형 문제를 만들어 바로 연습할 수 있어요.
          </p>
          <div className="flex justify-center">
            <div className="text-[11px] bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full text-slate-500">
              모델: {apiStats.lastModel} · 키: {apiStats.keyPresent ? '설정됨' : '없음'} · 호출: {apiStats.calls}회
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => {
                setInputMode('text');
                setSourceLabel('수동 입력');
              }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                inputMode === 'text'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 border-transparent'
              }`}
            >
              텍스트 입력
            </button>
            <button
              onClick={() => setInputMode('url')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                inputMode === 'url'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 border-transparent'
              }`}
            >
              URL 불러오기
            </button>
            <button
              onClick={() => pdfInputRef.current?.click()}
              className="ml-auto flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-400"
            >
              <FileDown className="w-3 h-3" /> PDF 업로드
            </button>
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handlePdfUpload}
            />
          </div>

          {inputMode === 'text' ? (
            <>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                JD 텍스트 입력
              </label>
              <textarea
                className="w-full h-48 p-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition text-slate-700 dark:text-slate-200 text-sm leading-relaxed resize-none font-mono"
                placeholder="예) SQL, 조인, 윈도우 함수, 코호트 분석 경험을 요구합니다..."
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
              />
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">출처: {sourceLabel}</div>
              {pdfStatus.error && (
                <div className="text-xs text-red-500 dark:text-red-300 font-semibold mt-1">
                  {pdfStatus.error}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                채용 공고 페이지 URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://careers.example.com/job/123"
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={urlStatus.loading}
                />
                <button
                  onClick={handleFetchFromUrl}
                  disabled={!urlInput.trim() || urlStatus.loading}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 disabled:opacity-50"
                >
                  {urlStatus.loading ? '불러오는 중...' : 'URL 불러오기'}
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                공고 페이지에서 본문 텍스트를 추출해 JD 입력창으로 옮깁니다. 로그인/차단된 페이지는 실패할 수 있어요.
              </p>
              {urlStatus.error && (
                <div className="text-xs text-red-500 dark:text-red-300 font-semibold">
                  {urlStatus.error}
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => {
                setJdText(JSON.stringify(MOCK_ANALYSIS, null, 2));
                setSourceLabel('오프라인 샘플');
                setInputMode('text');
              }}
              className="text-xs mr-auto px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 hover:border-blue-400"
            >
              샘플 JD 불러오기 (오프라인)
            </button>
            <button
              onClick={handleAnalyzeJD}
              disabled={!jdText.trim() || loading || urlStatus.loading || pdfStatus.loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg hover:shadow-blue-500/30"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Cpu className="w-5 h-5" />}
              분석 시작
            </button>
          </div>
        </div>

        {/* Features Preview */}
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { icon: Briefcase, title: "JD 분석", desc: "실제 요구 역량 추출" },
            { icon: Database, title: "가상 DB", desc: "스키마·데이터 즉시 생성" },
            { icon: MessageSquare, title: "AI 피드백", desc: "쿼리 리뷰 즉시 제공" }
          ].map((item, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <item.icon className="w-6 h-6 mx-auto mb-2 text-blue-500" />
              <h3 className="font-semibold text-slate-800 dark:text-white text-sm">{item.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Saved Sessions / History */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">저장된 JD 세션</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">최근 {SESSION_LIMIT}개 자동 저장 · 클릭해서 이어하기</p>
            </div>
            <input
              type="text"
              placeholder="검색 (회사, 도메인, 키워드)"
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
              value={sessionFilter}
              onChange={(e) => setSessionFilter(e.target.value)}
            />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {sessions
              .filter((s) => {
                const q = sessionFilter.toLowerCase();
                if (!q) return true;
                return (
                  s.analysis?.domain?.toLowerCase().includes(q) ||
                  s.analysis?.keywords?.join(' ').toLowerCase().includes(q) ||
                  s.jdText?.toLowerCase().includes(q) ||
                  (s.sourceLabel || '').toLowerCase().includes(q)
                );
              })
              .map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleLoadSession(s)}
                  className="text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:border-blue-400 transition"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <span>{new Date(s.createdAt).toLocaleString()}</span>
                    <span className="flex items-center gap-1">
                      <LinkIcon className="w-3 h-3" /> {s.sourceLabel}
                    </span>
                  </div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100">{s.analysis?.domain || '도메인 미정'}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {s.analysis?.keywords?.slice(0, 5).join(', ')}
                  </div>
                  <div className="text-xs text-slate-400 line-clamp-2 mt-1">{s.analysis?.problems?.[0]?.description}</div>
                </button>
              ))}
            {sessions.length === 0 && (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                아직 저장된 세션이 없습니다. JD를 분석하면 자동으로 저장돼요.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderWorkspace = () => {
    if (!analysis) return null;
    const problem = analysis.problems[currentProblemIdx];

    return (
      <div className="h-screen flex flex-col bg-slate-100 dark:bg-slate-950">
        {/* Header */}
        <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <Database className="w-4 h-4 text-white" />
            </div>
            <h1 className="font-bold text-slate-700 dark:text-slate-200">
              SQL 트레이너 <span className="text-slate-400 font-normal">| {analysis.domain}</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
              <span className="font-bold text-blue-600">키워드</span>
              {analysis.keywords.slice(0, 3).join(", ")}
            </div>
            <div className="text-[11px] bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full text-slate-500">
              모델: {apiStats.lastModel} · 키: {apiStats.keyPresent ? '설정됨' : '없음'} · 호출: {apiStats.calls}회
            </div>
            <div className="text-[11px] bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full text-slate-500">
              DB: {dbMode === 'mysql' ? 'MySQL' : '브라우저'}
            </div>
            <button onClick={() => setView('setup')} className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white">
              나가기
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar: Schema & Context */}
          <aside className="w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <h2 className="font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Layout className="w-4 h-4" /> 테이블
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <SchemaViewer schema={analysis.schema} />
            </div>
          </aside>

          {/* Main Area */}
          <main className="flex-1 flex flex-col min-w-0">
            {/* Problem Section */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide
                      ${problem.difficulty === 'Senior' ? 'bg-red-100 text-red-600' :
                      problem.difficulty === 'Junior' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-700'}`}>
                    {toKoreanDifficulty(problem.difficulty)}
                  </span>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white mt-2">
                    {currentProblemIdx + 1}. {problem.title}
                  </h2>
                </div>

                {/* Problem Navigation */}
                <div className="flex items-center gap-1">
                  {analysis.problems.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentProblemIdx(idx)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                          ${idx === currentProblemIdx
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                {problem.description}
              </p>

              {problem.hint && (
                <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                  <span className="font-bold mr-1">💡 힌트:</span> {problem.hint}
                </div>
              )}
            </div>

            {/* Split View: Editor & Result */}
            <div className="flex-1 flex flex-col md:flex-row min-h-0">

              {/* Editor Pane */}
              <div className="flex-1 flex flex-col border-r border-slate-200 dark:border-slate-800">
                <div className="h-10 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4">
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-2">
                    <Code className="w-3 h-3" /> SQL 에디터
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={runQuery}
                      className="flex items-center gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded shadow-sm transition-all"
                    >
                      <Play className="w-3 h-3 fill-current" /> 실행
                    </button>
                  </div>
                </div>
                <div className="flex-1 bg-slate-50 dark:bg-slate-900 relative">
                  <SqlEditor value={userQuery} onChange={setUserQuery} />
                </div>
              </div>

              {/* Results & Feedback Pane */}
              <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 min-h-[300px]">
                {/* Result Header */}
                <div className="h-10 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4">
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-2">
                    <TableIcon className="w-3 h-3" /> 쿼리 결과
                  </span>
                  {queryResult && (
                    <button
                      onClick={askAiFeedback}
                      className="text-xs flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded"
                    >
                      <MessageSquare className="w-3 h-3" /> 피드백 받기
                    </button>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 p-4 overflow-hidden flex flex-col gap-4">
                  <div className="flex-1 overflow-hidden">
                    <ResultTable data={queryResult} error={queryError} />
                  </div>

                  {/* AI Feedback Panel */}
                  {aiFeedback && (
                    <div className={`p-4 rounded-xl border flex gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500
                      ${aiFeedback.isCorrect
                        ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900/50'
                        : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-900/50'}`}
                    >
                      <div className={`mt-1 ${aiFeedback.isCorrect ? 'text-green-600' : 'text-amber-600'}`}>
                        {aiFeedback.isCorrect ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                      </div>
                      <div className="flex-1">
                        <h4 className={`font-bold text-sm mb-1 ${aiFeedback.isCorrect ? 'text-green-800 dark:text-green-300' : 'text-amber-800 dark:text-amber-300'}`}>
                          {aiFeedback.isCorrect ? "정답에 가깝습니다" : "개선이 필요합니다"}
                        </h4>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                          {aiFeedback.feedback}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </main>
        </div>
      </div>
    );
  };

  return (
    <div className="font-sans text-slate-900 dark:text-slate-100">
      {loading && <LoadingOverlay message={loadingMsg} />}
      {view === 'setup' ? renderSetup() : renderWorkspace()}
    </div>
  );
}
