"use client";

import { AlignLeft } from "lucide-react";
import { basicSetup } from "codemirror";
import { autocompletion, closeBrackets, completeFromList, type Completion } from "@codemirror/autocomplete";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { StreamLanguage, defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { linter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { Compartment, EditorSelection, EditorState } from "@codemirror/state";
import { EditorView, placeholder } from "@codemirror/view";
import { useEffect, useMemo, useRef } from "react";
import type { AviatorSourceRange } from "../lib/visualization";

type CodeLanguage = "aviatorscript" | "json" | "mermaid";

type CodeMirrorEditorProps = {
  value: string;
  onChange?: (value: string) => void;
  language: CodeLanguage;
  ariaLabel: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  className?: string;
  id?: string;
  readOnly?: boolean;
  activeRange?: AviatorSourceRange;
  error?: string;
  onLineClick?: (line: number) => void;
  placeholderText?: string;
  format?: (value: string) => string;
  showFormatButton?: boolean;
  minHeight?: string;
};

type StreamState = Record<string, never>;

const aviatorKeywords = [
  "let", "if", "elsif", "else", "for", "in", "while", "continue", "break", "throw", "return",
  "nil", "true", "false", "seq.list", "seq.map", "seq.filter", "seq.reduce", "seq.add", "math.max", "math.min", "math.round"
];

const mermaidKeywords = [
  "flowchart", "graph", "subgraph", "end", "click", "classDef", "class", "style", "linkStyle", "direction",
  "TD", "TB", "BT", "LR", "RL"
];

function completionItems(labels: string[]): Completion[] {
  return labels.map((label) => ({ label, type: "keyword" }));
}

const aviatorLanguage = StreamLanguage.define<StreamState>({
  startState: () => ({}),
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/^(?:##|\/\/).*/)) return "comment";
    if (stream.match(/^"(?:\\.|[^"\\])*"/) || stream.match(/^'(?:\\.|[^'\\])*'/)) return "string";
    if (stream.match(/^(?:let|if|elsif|else|for|in|while|continue|break|throw|return)\b/)) return "keyword";
    if (stream.match(/^(?:true|false|nil|null)\b/)) return "bool";
    if (stream.match(/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?\b/)) return "number";
    if (stream.match(/^(?:===|!==|==|!=|>=|<=|&&|\|\||\*\*|>>>|<<|>>|[+*/%<>=!&|^~-])/)) return "operator";
    stream.next();
    return null;
  }
});

const mermaidLanguage = StreamLanguage.define<StreamState>({
  startState: () => ({}),
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/^%%.*/)) return "comment";
    if (stream.match(/^"(?:\\.|[^"\\])*"/) || stream.match(/^'(?:\\.|[^'\\])*'/)) return "string";
    if (stream.match(/^(?:flowchart|graph|subgraph|end|click|classDef|class|style|linkStyle|direction)\b/)) return "keyword";
    if (stream.match(/^(?:-\.->|-->|==>|---|===|--|-.->)/)) return "operator";
    if (stream.match(/^#[0-9a-fA-F]{3,8}\b/)) return "atom";
    if (stream.match(/^\d+(?:\.\d+)?\b/)) return "number";
    stream.next();
    return null;
  }
});

function languageExtension(language: CodeLanguage) {
  if (language === "json") return json();
  return language === "aviatorscript" ? aviatorLanguage : mermaidLanguage;
}

function completionExtension(language: CodeLanguage) {
  if (language === "json") return autocompletion();
  return autocompletion({ override: [completeFromList(completionItems(language === "aviatorscript" ? aviatorKeywords : mermaidKeywords))] });
}

function diagnosticForError(doc: EditorState["doc"], message: string): Diagnostic {
  const match = message.match(/(?:line(?:Number)?|linea)\D*(\d+)/i);
  const lineNumber = Math.min(doc.lines, Math.max(1, Number(match?.[1] ?? 1)));
  const line = doc.line(lineNumber);
  return { from: line.from, to: Math.max(line.from, line.to), severity: "error", message, source: "AviatorScript" };
}

function formatDocument(view: EditorView, formatter: ((value: string) => string) | undefined) {
  if (!formatter || view.state.readOnly) return false;
  const current = view.state.doc.toString();
  const formatted = formatter(current);
  if (formatted !== current) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: formatted } });
  return true;
}

export function CodeMirrorEditor({
  value,
  onChange,
  language: codeLanguage,
  ariaLabel,
  ariaInvalid,
  ariaDescribedBy,
  className = "",
  id,
  readOnly = false,
  activeRange,
  error,
  onLineClick,
  placeholderText,
  format,
  showFormatButton = Boolean(format),
  minHeight
}: CodeMirrorEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onLineClickRef = useRef(onLineClick);
  const formatRef = useRef(format);
  const editableCompartment = useMemo(() => new Compartment(), []);
  const language = useMemo(() => languageExtension(codeLanguage), [codeLanguage]);
  const completions = useMemo(() => completionExtension(codeLanguage), [codeLanguage]);

  onChangeRef.current = onChange;
  onLineClickRef.current = onLineClick;
  formatRef.current = format;

  useEffect(() => {
    if (!hostRef.current) return;
    const contentAttributes: Record<string, string> = {
      "aria-label": ariaLabel,
      ...(id ? { id } : {}),
      ...(ariaInvalid !== undefined ? { "aria-invalid": String(ariaInvalid) } : {}),
      ...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {})
    };

    const extensions = [
      basicSetup,
      language,
      completions,
      closeBrackets(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      editableCompartment.of([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
      EditorView.contentAttributes.of(contentAttributes),
      EditorView.domEventHandlers({
        mousedown(event) {
          const target = event.target instanceof Element ? event.target.closest(".cm-lineNumbers .cm-gutterElement") : null;
          if (!target || !onLineClickRef.current) return false;
          const line = Number.parseInt(target.textContent?.trim() ?? "", 10);
          if (!Number.isFinite(line)) return false;
          onLineClickRef.current(line);
          return true;
        }
      }),
      EditorView.theme({
        "&": { height: "100%", minHeight: "0", backgroundColor: "#15293d", color: "#e7f0fa" },
        ".cm-scroller": { overflow: "auto", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" },
        ".cm-content": { minHeight: "100%", padding: "12px", caretColor: "#f6fbff" },
        ".cm-line": { padding: "0" },
        ".cm-gutters": { backgroundColor: "#122337", color: "#6c8aa4", borderRight: "1px solid #25435d" },
        ".cm-lineNumbers .cm-gutterElement": { minWidth: "34px", padding: "0 8px", cursor: onLineClickRef.current ? "pointer" : "default" },
        ".cm-lineNumbers .cm-gutterElement:hover": { color: "#f6fbff", backgroundColor: "#25435d" },
        ".cm-activeLine": { backgroundColor: "rgba(37, 116, 207, .16)" },
        ".cm-activeLineGutter": { backgroundColor: "#1d3b59", color: "#f6fbff" },
        ".cm-selectionBackground, ::selection": { backgroundColor: "rgba(134, 183, 255, .35)" },
        ".cm-focused": { outline: "none" },
        ".cm-tooltip": { zIndex: "20" },
        ".cm-placeholder": { color: "#91a5b8" }
      }),
      ...(placeholderText ? [placeholder(placeholderText)] : []),
      ...(codeLanguage === "json" ? [linter(jsonParseLinter(), { delay: 240 })] : []),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onChangeRef.current?.(update.state.doc.toString());
      })
    ];

    const view = new EditorView({ state: EditorState.create({ doc: value, extensions }), parent: hostRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [ariaDescribedBy, ariaInvalid, ariaLabel, codeLanguage, completions, editableCompartment, id, language, placeholderText, readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: editableCompartment.reconfigure([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)])
    });
  }, [editableCompartment, readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch(setDiagnostics(view.state, error ? [diagnosticForError(view.state.doc, error)] : []));
  }, [error, value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !activeRange) return;
    const startLine = Math.min(view.state.doc.lines, Math.max(1, activeRange.startLine));
    const endLine = Math.min(view.state.doc.lines, Math.max(startLine, activeRange.endLine));
    const start = view.state.doc.line(startLine).from;
    const end = view.state.doc.line(endLine).to;
    view.dispatch({
      selection: EditorSelection.range(start, end),
      effects: EditorView.scrollIntoView(start, { y: "center" })
    });
    view.focus();
  }, [activeRange]);

  function requestFormat() {
    const view = viewRef.current;
    if (!view) return;
    formatDocument(view, formatRef.current);
  }

  return (
    <div className={`codemirror-editor ${className}`.trim()} style={minHeight ? { minHeight } : undefined}>
      <div className="codemirror-editor-host" ref={hostRef} />
      {showFormatButton && format && <button
        aria-label="Formatear codigo"
        className="codemirror-format-button formula-icon-button"
        disabled={readOnly}
        onClick={requestFormat}
        title="Formatear codigo (Ctrl/Cmd+Shift+F)"
        type="button"
      ><AlignLeft size={15} /></button>}
      <div className="visually-hidden" aria-live="polite">{error ?? ""}</div>
    </div>
  );
}

export function formatJsonDocument(value: string) {
  try {
    return `${JSON.stringify(JSON.parse(value), null, 2)}\n`;
  } catch {
    return value;
  }
}

export function formatCodeWhitespace(value: string) {
  if (!value.trim()) return value;
  return `${value.split("\n").map((line) => line.replace(/[ \t]+$/g, "")).join("\n").replace(/\n+$/g, "")}\n`;
}
