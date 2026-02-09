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
  Table as TableIcon
} from 'lucide-react';

/**
 * SQL-JD-Trainer
 * * A React application that generates SQL problems based on Job Descriptions (JD),
 * creates a virtual in-memory database, and allows users to practice SQL queries
 * with AI feedback.
 * * Tech Stack: React, Tailwind CSS, AlaSQL (In-memory DB), Google Gemini API
 */

// --- Constants & Prompts ---

const SYSTEM_PROMPT_ANALYSIS = `
You are a Senior Data Engineer & Technical Interviewer at a top-tier tech company.
Analyze the provided Job Description (JD) and extract key SQL skills.
Based on the domain (e.g., E-commerce, Fintech, AdTech), generate a relevant database schema and 3 progressive SQL problems.

Output MUST be valid JSON with this structure:
{
  "domain": "string (e.g., E-commerce)",
  "keywords": ["string", "string"],
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
      "difficulty": "Junior/Middle/Senior",
      "title": "string",
      "description": "string",
      "expectedLogic": "string (briefly explain the SQL logic needed, e.g., JOIN, GROUP BY)",
      "hint": "string"
    }
  ]
}

Ensure 'data' contains at least 5-10 realistic rows per table.
Ensure problems match the JD's requirements (e.g., if JD mentions 'Window Functions', include a problem using RANK()).
`;

const SYSTEM_PROMPT_FEEDBACK = `
You are a kind and precise SQL Tutor. 
Review the user's query against the problem description and the schema.
The user just ran this query.
Provide brief, constructive feedback. 
If there's an error, explain it simply. 
If it works but can be optimized (e.g., using CTE instead of subquery), suggest it.
`;

// --- Components ---

const LoadingOverlay = ({ message }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
    <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-2xl flex flex-col items-center max-w-sm text-center">
      <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
      <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Processing</h3>
      <p className="text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  </div>
);

const SchemaViewer = ({ schema }) => (
  <div className="space-y-4">
    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">Database Schema</h3>
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
        No results to display. Run a query to see data.
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

// --- Main Application ---

export default function App() {
  // State
  const [view, setView] = useState('setup'); // 'setup' | 'workspace'
  const [jdText, setJdText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  // Data State
  const [analysis, setAnalysis] = useState(null); // { domain, keywords, schema, problems }
  const [currentProblemIdx, setCurrentProblemIdx] = useState(0);
  const [userQuery, setUserQuery] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [queryError, setQueryError] = useState(null);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [dbReady, setDbReady] = useState(false);

  // References
  const alasqlRef = useRef(null);

  // Initialize AlaSQL
  useEffect(() => {
    const initSqlEngine = async () => {
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
            console.log("AlaSQL loaded successfully");
          };
          document.body.appendChild(script);
        } catch (e) {
          console.error("Failed to load AlaSQL", e);
        }
      } else {
        alasqlRef.current = window.alasql;
      }
    };
    initSqlEngine();
  }, []);

  // Gemini API Caller
  const callGemini = async (prompt, systemInstruction = "") => {
    try {
      const apiKey = ""; // Injected by environment
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

      if (!response.ok) throw new Error("API call failed");

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return JSON.parse(text);
    } catch (error) {
      console.error("Gemini Error:", error);
      throw error;
    }
  };

  const handleAnalyzeJD = async () => {
    if (!jdText.trim()) return;

    setLoading(true);
    setLoadingMsg("Analyzing Job Description & Extracting Keywords...");

    try {
      // 1. Analyze JD & Generate Schema/Problems
      const result = await callGemini(jdText, SYSTEM_PROMPT_ANALYSIS);
      setAnalysis(result);

      // 2. Initialize In-Memory DB
      setLoadingMsg(`Building Virtual ${result.domain || 'Database'} Environment...`);

      if (alasqlRef.current) {
        // Clear existing database
        alasqlRef.current('CREATE DATABASE IF NOT EXISTS sql_trainer; USE sql_trainer;');

        // Create Tables & Insert Data
        result.schema.forEach(table => {
          // Flatten columns for CREATE TABLE
          // Simplified: AlaSQL is flexible, we can just insert JSON objects directly into a table
          // But creating table structure is better for strict mode

          // Drop if exists
          alasqlRef.current(`DROP TABLE IF EXISTS ${table.tableName}`);

          // Create Table
          // We define columns loosely as strings for this demo
          const colDefs = table.columns.map(c => `${c} STRING`).join(', ');
          alasqlRef.current(`CREATE TABLE ${table.tableName} (${colDefs})`);

          // Insert Data
          if (table.data && table.data.length > 0) {
            alasqlRef.current(`SELECT * INTO ${table.tableName} FROM ?`, [table.data]);
          }
        });

        setDbReady(true);
        setView('workspace');
        // Set initial query to a simple select on the first table
        if (result.schema.length > 0) {
          setUserQuery(`SELECT * FROM ${result.schema[0].tableName} LIMIT 5;`);
        }
      } else {
        throw new Error("SQL Engine not loaded yet. Please refresh.");
      }

    } catch (err) {
      alert("Failed to analyze JD. Please try again. " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const runQuery = () => {
    if (!alasqlRef.current) return;
    setQueryError(null);
    setQueryResult(null);
    setAiFeedback(null);

    try {
      // Multiple statements support? AlaSQL supports it but returns array.
      // We focus on the last result for display usually.
      const res = alasqlRef.current(userQuery);
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
    setLoadingMsg("AI Tutor is reviewing your code...");
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
        `Review this user SQL query attempt. Return JSON: { "feedback": "your string here", "isCorrect": boolean } \n Context: ${prompt}`,
        SYSTEM_PROMPT_FEEDBACK
      );

      setAiFeedback(feedbackResponse);

    } catch (e) {
      console.error(e);
      setAiFeedback({ feedback: "Could not retrieve feedback at this time.", isCorrect: false });
    } finally {
      setLoading(false);
    }
  };

  // --- Render Functions ---

  const renderSetup = () => (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6">
      <div className="max-w-3xl w-full space-y-8">
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
            Paste a Job Description. Our AI will extract the required SQL skills, generate a mock database, and interview you with real-world problems.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Paste Job Description (JD)
          </label>
          <textarea
            className="w-full h-48 p-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition text-slate-700 dark:text-slate-200 text-sm leading-relaxed resize-none font-mono"
            placeholder="e.g. 'We are looking for a Data Analyst proficient in SQL, experienced with complex joins, window functions, and cohort analysis...'"
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
          />
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleAnalyzeJD}
              disabled={!jdText.trim() || loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg hover:shadow-blue-500/30"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Cpu className="w-5 h-5" />}
              Analyze & Start Challenge
            </button>
          </div>
        </div>

        {/* Features Preview */}
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { icon: Briefcase, title: "JD Analysis", desc: "Extracts real-world requirements" },
            { icon: Database, title: "Virtual DB", desc: "Instantly creates tables & data" },
            { icon: MessageSquare, title: "AI Feedback", desc: "Get code reviews instantly" }
          ].map((item, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <item.icon className="w-6 h-6 mx-auto mb-2 text-blue-500" />
              <h3 className="font-semibold text-slate-800 dark:text-white text-sm">{item.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.desc}</p>
            </div>
          ))}
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
              SQL Trainer <span className="text-slate-400 font-normal">| {analysis.domain}</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
              <span className="font-bold text-blue-600">Keywords:</span>
              {analysis.keywords.slice(0, 3).join(", ")}
            </div>
            <button onClick={() => setView('setup')} className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white">
              Exit
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar: Schema & Context */}
          <aside className="w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <h2 className="font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Layout className="w-4 h-4" /> Tables
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
                    {problem.difficulty}
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
                  <span className="font-bold mr-1">💡 Hint:</span> {problem.hint}
                </div>
              )}
            </div>

            {/* Split View: Editor & Result */}
            <div className="flex-1 flex flex-col md:flex-row min-h-0">

              {/* Editor Pane */}
              <div className="flex-1 flex flex-col border-r border-slate-200 dark:border-slate-800">
                <div className="h-10 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4">
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-2">
                    <Code className="w-3 h-3" /> SQL Editor
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={runQuery}
                      className="flex items-center gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded shadow-sm transition-all"
                    >
                      <Play className="w-3 h-3 fill-current" /> Run
                    </button>
                  </div>
                </div>
                <div className="flex-1 bg-slate-50 dark:bg-slate-900 relative">
                  <textarea
                    className="absolute inset-0 w-full h-full p-4 font-mono text-sm bg-transparent border-none outline-none resize-none text-slate-800 dark:text-slate-200 leading-6"
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    spellCheck={false}
                    placeholder="SELECT * FROM orders..."
                  />
                </div>
              </div>

              {/* Results & Feedback Pane */}
              <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 min-h-[300px]">
                {/* Result Header */}
                <div className="h-10 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4">
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-2">
                    <TableIcon className="w-3 h-3" /> Query Result
                  </span>
                  {queryResult && (
                    <button
                      onClick={askAiFeedback}
                      className="text-xs flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded"
                    >
                      <MessageSquare className="w-3 h-3" /> Get Feedback
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
                          {aiFeedback.isCorrect ? "Excellent!" : "Needs Improvement"}
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