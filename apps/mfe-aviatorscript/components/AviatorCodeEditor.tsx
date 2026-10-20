"use client";

import { useEffect, useMemo, useRef } from "react";
import type { AviatorSourceRange } from "../lib/visualization";

type AviatorCodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  activeRange?: AviatorSourceRange;
  error?: string;
};

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

export function highlightAviatorLine(line: string) {
  const tokenPattern = /(##.*$|\/\/.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:let|if|elsif|else|for|in|while|continue|break|throw|return)\b|\b\d+(?:\.\d+)?\b|===|==|!=|>=|<=|&&|\|\||[+*/%<>=!-])/g;
  let html = "";
  let cursor = 0;
  for (const match of line.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    html += escapeHtml(line.slice(cursor, index));
    const token = match[0];
    const className = token.startsWith("##") || token.startsWith("//")
      ? "comment"
      : token.startsWith("\"") || token.startsWith("'")
        ? "string"
        : /^(?:let|if|elsif|else|for|in|while|continue|break|throw|return)$/.test(token)
          ? "keyword"
          : /^\d/.test(token) ? "number" : "operator";
    html += `<span class="syntax-${className}">${escapeHtml(token)}</span>`;
    cursor = index + token.length;
  }
  return html + escapeHtml(line.slice(cursor));
}

export function AviatorCodeEditor({ value, onChange, activeRange, error }: AviatorCodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const lineNumberRef = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => value.split("\n"), [value]);
  const highlighted = useMemo(() => lines.map(highlightAviatorLine).join("\n"), [lines]);

  useEffect(() => {
    if (!activeRange || !textareaRef.current) return;
    const textarea = textareaRef.current;
    const lineStart = lines.slice(0, Math.max(0, activeRange.startLine - 1)).join("\n").length + (activeRange.startLine > 1 ? 1 : 0);
    const lineEnd = lines.slice(0, Math.max(0, activeRange.endLine)).join("\n").length;
    textarea.focus();
    textarea.setSelectionRange(lineStart, Math.min(value.length, Math.max(lineStart, lineEnd)));
  }, [activeRange, lines, value]);

  function syncScroll() {
    const textarea = textareaRef.current;
    const highlight = highlightRef.current;
    const lineNumbers = lineNumberRef.current;
    if (!textarea || !highlight || !lineNumbers) return;
    highlight.scrollTop = textarea.scrollTop;
    highlight.scrollLeft = textarea.scrollLeft;
    lineNumbers.scrollTop = textarea.scrollTop;
  }

  return (
    <div className={`aviator-code-editor ${error ? "has-error" : ""}`}>
      <div className="aviator-code-editor-toolbar">
        <span>Editor AviatorScript</span>
        <small>{lines.length} lineas · analisis estatico</small>
      </div>
      <div className="aviator-code-editor-body">
        <div aria-hidden="true" className="aviator-code-line-numbers" ref={lineNumberRef}>
          {lines.map((_, index) => <span key={index}>{index + 1}</span>)}
        </div>
        <div className="aviator-code-layer">
          <pre aria-hidden="true" className="aviator-code-highlight" ref={highlightRef} dangerouslySetInnerHTML={{ __html: highlighted }} />
          <textarea
            aria-label="Codigo AviatorScript para visualizar"
            className="aviator-code-input"
            onChange={(event) => onChange(event.target.value)}
            onScroll={syncScroll}
            ref={textareaRef}
            spellCheck={false}
            value={value}
          />
        </div>
      </div>
      {error && <p className="aviator-code-error">{error}</p>}
    </div>
  );
}
