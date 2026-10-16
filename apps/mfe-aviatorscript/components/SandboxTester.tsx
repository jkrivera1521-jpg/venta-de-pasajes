"use client";

import { AlertCircle, CheckCircle2, Code2, Play, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { testRule } from "../lib/api";
import type { RuleDocument, TestResponse } from "../lib/types";

type SandboxTesterProps = {
  open: boolean;
  rule: RuleDocument;
  onClose: () => void;
};

const samplePayload = JSON.stringify({
  order: { amount: 600, category: "ELECTRO", createdAt: "2026-10-15" },
  user: { age: 31, isVip: true },
  passenger: { email: "pasajero@ejemplo.com" }
}, null, 2);

export function SandboxTester({ open, rule, onClose }: SandboxTesterProps) {
  const [payload, setPayload] = useState(samplePayload);
  const [response, setResponse] = useState<TestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setResponse(null);
      setError(null);
    }
  }, [open]);

  async function executeTest() {
    setBusy(true);
    setError(null);
    setResponse(null);
    try {
      const testData = JSON.parse(payload) as unknown;
      setResponse(await testRule(rule, testData));
    } catch (testError) {
      setError(testError instanceof SyntaxError ? "El JSON de prueba no es valido." : testError instanceof Error ? testError.message : "No se pudo ejecutar la prueba.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside aria-label="Sandbox de pruebas" aria-modal={open ? true : undefined} className={`sandbox-drawer ${open ? "is-open" : ""}`} role="dialog">
      <div className="sandbox-header">
        <div>
          <span className="eyebrow"><Code2 size={14} /> Sandbox</span>
          <h2>Prueba tu regla</h2>
        </div>
        <button className="icon-button" onClick={onClose} title="Cerrar sandbox" type="button"><X size={17} /></button>
      </div>
      <p className="sandbox-description">Simula la informacion que recibira la JVM y revisa el resultado de la regla.</p>
      <label className="json-label" htmlFor="sandbox-json">Payload de prueba</label>
      <textarea className="json-editor" id="sandbox-json" onChange={(event) => setPayload(event.target.value)} spellCheck={false} value={payload} />
      <div className="sandbox-actions">
        <button className="secondary-button" onClick={() => setPayload(samplePayload)} type="button"><RotateCcw size={15} /> Restaurar ejemplo</button>
        <button className="primary-button" disabled={busy} onClick={executeTest} type="button"><Play size={15} /> {busy ? "Ejecutando..." : "Ejecutar prueba"}</button>
      </div>
      {error && <div className="result-panel result-error"><AlertCircle size={17} /><span>{error}</span></div>}
      {response && (
        <div className={`result-panel ${response.success ? "result-success" : "result-error"}`}>
          {response.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <div>
            <strong>{response.success ? (response.matched ? "La regla se cumple" : "La regla no se cumple") : "La prueba fallo"}</strong>
            <span>{response.success ? `Resultado: ${String(response.result)} · ${response.executionTimeMs} ms` : response.error}</span>
          </div>
        </div>
      )}
    </aside>
  );
}
