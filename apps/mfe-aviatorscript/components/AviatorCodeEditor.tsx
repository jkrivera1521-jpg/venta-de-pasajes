"use client";

import type { AviatorSourceRange } from "../lib/visualization";
import { CodeMirrorEditor, formatCodeWhitespace } from "./CodeMirrorEditor";

type AviatorCodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  activeRange?: AviatorSourceRange;
  error?: string;
  onLineClick?: (line: number) => void;
  readOnly?: boolean;
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

export function AviatorCodeEditor({ value, onChange, activeRange, error, onLineClick, readOnly = false }: AviatorCodeEditorProps) {
  const lines = value.split("\n");

  return (
    <div className={`aviator-code-editor ${error ? "has-error" : ""}`}>
      <div className="aviator-code-editor-toolbar">
        <span>Editor AviatorScript</span>
        <small>{lines.length} lineas · analisis estatico</small>
      </div>
      <div className="aviator-code-editor-body">
        <CodeMirrorEditor
          activeRange={activeRange}
          ariaLabel={readOnly ? "Codigo AviatorScript de la formula" : "Codigo AviatorScript editable"}
          error={error}
          format={formatCodeWhitespace}
          language="aviatorscript"
          onChange={onChange}
          onLineClick={onLineClick}
          readOnly={readOnly}
          value={value}
        />
      </div>
      {error && <p className="aviator-code-error">{error}</p>}
    </div>
  );
}
