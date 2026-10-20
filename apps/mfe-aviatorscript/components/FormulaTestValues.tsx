"use client";

import { Braces } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormulaRoot } from "../lib/formula";
import { createFormulaTestPayload, getFormulaTestFields, readTestPayload, readTestPayloadField, updateTestPayloadField } from "../lib/test-payload";
import type { SchemaField } from "../lib/types";

type FormulaTestValuesProps = {
  expression: FormulaRoot;
  fields: SchemaField[];
  payload: string;
  onPayloadChange: (payload: string) => void;
  onOpenJson: () => void;
};

function fieldValue(value: unknown, field: SchemaField) {
  if (value !== undefined) return value;
  if (field.type === "boolean") return false;
  if (field.type === "number") return "";
  if (field.type === "unknown") return [];
  return "";
}

export function FormulaTestValues({ expression, fields, payload, onPayloadChange, onOpenJson }: FormulaTestValuesProps) {
  const formulaFields = useMemo(() => getFormulaTestFields(expression, fields), [expression, fields]);
  const fallbackPayload = useMemo(() => createFormulaTestPayload(expression, fields, undefined, false), [expression, fields]);
  const payloadValues = readTestPayload(payload);
  const fallbackValues = readTestPayload(fallbackPayload) ?? {};
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setDrafts({});
    setFieldErrors({});
  }, [expression, payload]);

  function commit(field: SchemaField, value: unknown) {
    onPayloadChange(updateTestPayloadField(payload, field.key, value, fallbackPayload));
    setDrafts((current) => {
      const next = { ...current };
      delete next[field.key];
      return next;
    });
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field.key];
      return next;
    });
  }

  function updateDraft(field: SchemaField, value: string) {
    setDrafts((current) => ({ ...current, [field.key]: value }));
  }

  function renderField(field: SchemaField) {
    const fromPayload = payloadValues ? readTestPayloadField(payloadValues, field.key) : undefined;
    const fromFallback = readTestPayloadField(fallbackValues, field.key);
    const value = fieldValue(fromPayload === undefined ? fromFallback : fromPayload, field);
    const draft = drafts[field.key];
    const error = fieldErrors[field.key];
    const structured = field.type === "unknown" || (value !== null && typeof value === "object");
    const controlId = `formula-test-value-${field.key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

    let control;
    if (structured) {
      const text = draft ?? JSON.stringify(value, null, 2) ?? "[]";
      control = <textarea
        aria-describedby={error ? `${controlId}-error` : undefined}
        aria-invalid={Boolean(error)}
        id={controlId}
        onChange={(event) => {
          const next = event.target.value;
          updateDraft(field, next);
          try {
            const parsed: unknown = JSON.parse(next);
            if ((field.key === "horasExtras" || field.key === "descuentosAdicionales") && !Array.isArray(parsed)) {
              throw new Error("Ingresa una lista JSON.");
            }
            commit(field, parsed);
          } catch (parseError) {
            setFieldErrors((current) => ({ ...current, [field.key]: parseError instanceof Error ? parseError.message : "JSON no valido." }));
          }
        }}
        rows={3}
        spellCheck={false}
        value={text}
      />;
    } else if (field.type === "boolean") {
      control = <label className="formula-test-toggle" htmlFor={controlId}>
        <input checked={value === true} id={controlId} onChange={(event) => commit(field, event.target.checked)} type="checkbox" />
        <span>{value === true ? "Verdadero" : "Falso"}</span>
      </label>;
    } else if (field.type === "enum" && field.options?.length) {
      control = <select id={controlId} onChange={(event) => commit(field, event.target.value)} value={typeof value === "string" ? value : ""}>
        {!field.options.includes(String(value)) && <option value="">Selecciona una opcion</option>}
        {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>;
    } else {
      const inputType = field.type === "number" ? "number" : field.type === "date" ? "date" : "text";
      const displayValue = draft ?? (value === null ? "" : String(value ?? ""));
      control = <input
        id={controlId}
        onChange={(event) => {
          const next = event.target.value;
          updateDraft(field, next);
          if (inputType !== "number") {
            commit(field, next);
          } else if (next === "") {
            commit(field, null);
          } else if (Number.isFinite(Number(next))) {
            commit(field, Number(next));
          }
        }}
        step={inputType === "number" ? "any" : undefined}
        type={inputType}
        value={displayValue}
      />;
    }

    return <div className={`formula-test-field ${structured ? "is-structured" : ""}`} key={field.key}>
      <div className="formula-test-field-heading">
        <label htmlFor={controlId}>{field.label}</label>
        <span>{field.type === "unknown" ? "JSON" : field.type}</span>
      </div>
      {control}
      {field.description && <small>{field.description}</small>}
      {error && <small className="formula-test-field-error" id={`${controlId}-error`}>{error}</small>}
    </div>;
  }

  return <section aria-label="Valores para los datos de prueba" className="formula-test-values">
    <div className="formula-test-values-heading">
      <div>
        <h3>Variables para probar</h3>
        <p>El JSON de la pestaña de prueba se actualiza con estos valores.</p>
      </div>
      <button className="formula-button" onClick={onOpenJson} type="button"><Braces size={15} /> Ver JSON</button>
    </div>
    {payload.trim() && !payloadValues && <p className="formula-test-json-warning">El JSON actual no es válido. Ajusta los valores aquí o corrígelo en “Probar regla”.</p>}
    {formulaFields.length
      ? <div className="formula-test-fields">{formulaFields.map(renderField)}</div>
      : <p className="formula-test-empty">Esta fórmula no utiliza variables de contexto.</p>}
  </section>;
}
