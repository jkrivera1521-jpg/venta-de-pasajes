"use client";

import { AlignLeft, Check, Clipboard } from "lucide-react";
import { type ReactNode } from "react";
import { CodeMirrorEditor, formatJsonDocument } from "./CodeMirrorEditor";

type JsonCodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  className?: string;
  id?: string;
  copied?: boolean;
  onCopy?: () => void;
  actions?: ReactNode;
  rows?: number;
};

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

function highlightJsonLine(line: string) {
  const tokenPattern = /"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b|[{}[\],:]/g;
  let html = "";
  let cursor = 0;
  for (const match of line.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    html += escapeHtml(line.slice(cursor, index));
    const token = match[0];
    const isKey = token.startsWith("\"") && /^\s*:/.test(line.slice(index + token.length));
    const className = isKey
      ? "key"
      : token.startsWith("\"")
        ? "string"
        : /^(?:true|false)$/.test(token)
          ? "boolean"
          : token === "null"
            ? "null"
            : /^-?\d/.test(token)
              ? "number"
              : "punctuation";
    html += `<span class="json-syntax-${className}">${escapeHtml(token)}</span>`;
    cursor = index + token.length;
  }
  return html + escapeHtml(line.slice(cursor));
}

export function highlightJson(value: string) {
  return value.split("\n").map(highlightJsonLine).join("\n");
}

export function JsonCodeEditor({ value, onChange, ariaLabel, ariaInvalid, ariaDescribedBy, actions, className = "", copied = false, id, onCopy, rows = 8 }: JsonCodeEditorProps) {
  return (
    <div className={`json-code-editor ${className}`.trim()}>
      <div className="json-code-editor-body">
        <CodeMirrorEditor
          ariaDescribedBy={ariaDescribedBy}
          ariaInvalid={ariaInvalid}
          ariaLabel={ariaLabel}
          className="json-code-mirror"
          format={formatJsonDocument}
          id={id}
          language="json"
          minHeight={`${Math.max(3, rows) * 19.2 + 24}px`}
          onChange={onChange}
          showFormatButton={false}
          value={value}
        />
        <div className="json-code-actions">
          <button
            aria-label="Formatear JSON"
            className="formula-icon-button json-action-button"
            onClick={() => onChange(formatJsonDocument(value))}
            title="Formatear JSON"
            type="button"
          ><AlignLeft size={16} /></button>
          {onCopy && <button
            aria-label={copied ? "JSON copiado" : "Copiar JSON"}
            className={`formula-icon-button json-code-copy-button ${copied ? "is-copied" : ""}`}
            onClick={onCopy}
            title={copied ? "Copiado" : "Copiar JSON"}
            type="button"
          >{copied ? <Check size={16} /> : <Clipboard size={16} />}</button>}
          {actions}
        </div>
      </div>
    </div>
  );
}
