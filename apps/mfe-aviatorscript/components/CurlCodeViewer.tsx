"use client";

import { Check, Clipboard } from "lucide-react";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

function highlightCurl(value: string) {
  const tokenPattern = /curl(?:\.exe)?|--%|--location|--request|--header|--data(?:-raw)?|--write-out|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|https?:\/\/[^\s'\"]+/g;
  let html = "";
  let cursor = 0;
  for (const match of value.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    html += escapeHtml(value.slice(cursor, index));
    const token = match[0];
    const className = token === "curl" || token === "curl.exe"
      ? "command"
      : token.startsWith("--")
        ? "option"
        : token.startsWith("'")
          ? "string"
          : "url";
    html += `<span class="curl-syntax-${className}">${escapeHtml(token)}</span>`;
    cursor = index + token.length;
  }
  return html + escapeHtml(value.slice(cursor));
}

type CurlCodeViewerProps = {
  copied?: boolean;
  onCopy: () => void;
  value: string;
};

export function CurlCodeViewer({ copied = false, onCopy, value }: CurlCodeViewerProps) {
  return (
    <div className="curl-code-viewer">
      <div aria-hidden="true" className="curl-code-line-numbers"><span>1</span></div>
      <pre aria-label="Comando cURL generado" className="curl-code" id="curl-command" dangerouslySetInnerHTML={{ __html: highlightCurl(value) }} />
      <button
        aria-label={copied ? "cURL copiado" : "Copiar cURL"}
        className={`formula-icon-button curl-copy-button ${copied ? "is-copied" : ""}`}
        onClick={onCopy}
        title={copied ? "Copiado" : "Copiar cURL"}
        type="button"
      >{copied ? <Check size={16} /> : <Clipboard size={16} />}</button>
    </div>
  );
}
