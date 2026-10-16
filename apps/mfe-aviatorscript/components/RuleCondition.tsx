"use client";

import { Check, ChevronDown, GripVertical, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { defaultOperatorForField, defaultValueForField, getField, OPERATORS_BY_TYPE, OPERATOR_LABELS } from "../lib/rules";
import type { ComparisonOperator, RuleConditionNode, RuleValue, SchemaField } from "../lib/types";

type RuleConditionProps = {
  condition: RuleConditionNode;
  fields: SchemaField[];
  issueMessages: string[];
  onChange: (condition: RuleConditionNode) => void;
  onDelete: () => void;
};

function FieldPicker({ value, fields, onChange }: { value: string; fields: SchemaField[]; onChange: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selected = getField(fields, value);
  const filteredFields = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return fields;
    return fields.filter((field) => `${field.key} ${field.label}`.toLowerCase().includes(query));
  }, [fields, search]);

  useEffect(() => {
    function closeOnOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, []);

  return (
    <div className="field-picker" ref={containerRef}>
      <button className={`field-picker-trigger ${!selected ? "has-error" : ""}`} onClick={() => setOpen((current) => !current)} type="button">
        <span>{selected?.label ?? "Selecciona un campo"}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="field-picker-menu">
          <input autoFocus onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en el esquema" value={search} />
          <div className="field-picker-options">
            {filteredFields.map((field) => (
              <button
                className="field-picker-option"
                key={field.key}
                onClick={() => {
                  onChange(field.key);
                  setOpen(false);
                  setSearch("");
                }}
                type="button"
              >
                <span><strong>{field.label}</strong><code>{field.key}</code></span>
                {field.key === value && <Check size={15} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ValueEditor({ field, condition, onChange }: { field?: SchemaField; condition: RuleConditionNode; onChange: (value: RuleValue) => void }) {
  if (!field || condition.operator === "is_true" || condition.operator === "is_false") {
    return <div className="value-placeholder">No requiere valor</div>;
  }

  const value = condition.value;
  if (field.type === "boolean") {
    return (
      <label className="boolean-editor">
        <input checked={value === true} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
        <span>{value === true ? "Verdadero" : "Falso"}</span>
      </label>
    );
  }

  if (field.type === "enum") {
    if (condition.operator === "in") {
      return (
        <div className="enum-checks">
          {(field.options ?? []).map((option) => {
            const selected = Array.isArray(value) && value.some((item) => item === option);
            return (
              <label key={option}>
                <input
                  checked={selected}
                  onChange={(event) => {
                    const current = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
                    onChange(event.target.checked ? [...current, option] : current.filter((item) => item !== option));
                  }}
                  type="checkbox"
                />
                {option}
              </label>
            );
          })}
        </div>
      );
    }
    return (
      <select value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">Selecciona una opcion</option>
        {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  }

  if (condition.operator === "in" && field.type === "string") {
    return (
      <input
        onChange={(event) => onChange(event.target.value.split(",").map((item) => item.trim()).filter(Boolean))}
        placeholder="VIP, MAYORISTA, EMPRESA"
        type="text"
        value={Array.isArray(value) ? value.join(", ") : typeof value === "string" ? value : ""}
      />
    );
  }

  const inputType = field.type === "number" ? "number" : field.type === "date" ? "date" : "text";
  return (
    <input
      min={field.type === "number" ? 0 : undefined}
      onChange={(event) => onChange(field.type === "number" ? (event.target.value === "" ? "" : Number(event.target.value)) : event.target.value)}
      placeholder={field.type === "number" ? "0.00" : "Escribe un valor"}
      type={inputType}
      value={typeof value === "string" || typeof value === "number" ? value : ""}
    />
  );
}

export function RuleCondition({ condition, fields, issueMessages, onChange, onDelete }: RuleConditionProps) {
  const field = getField(fields, condition.fieldKey);
  const operators = OPERATORS_BY_TYPE[field?.type ?? "string"];
  const hasError = issueMessages.length > 0;

  function selectField(fieldKey: string) {
    const nextField = getField(fields, fieldKey);
    const nextOperator = defaultOperatorForField(nextField);
    onChange({
      ...condition,
      fieldKey,
      operator: nextOperator,
      value: defaultValueForField(nextField, nextOperator)
    });
  }

  function selectOperator(operator: ComparisonOperator) {
    onChange({
      ...condition,
      operator,
      value: operator === "is_true" || operator === "is_false" ? undefined : defaultValueForField(field, operator)
    });
  }

  return (
    <article className={`rule-condition ${hasError ? "has-error" : ""}`}>
      <div className="condition-grip" title="Condicion"><GripVertical size={17} /></div>
      <div className="condition-field condition-control">
        <span className="control-label">Campo</span>
        <FieldPicker fields={fields} onChange={selectField} value={condition.fieldKey} />
      </div>
      <div className="condition-operator condition-control">
        <span className="control-label">Operador</span>
        <select value={condition.operator} onChange={(event) => selectOperator(event.target.value as ComparisonOperator)}>
          {operators.map((operator) => <option key={operator} value={operator}>{OPERATOR_LABELS[operator]}</option>)}
        </select>
      </div>
      <div className="condition-value condition-control">
        <span className="control-label">Valor</span>
        <ValueEditor condition={condition} field={field} onChange={(value) => onChange({ ...condition, value })} />
      </div>
      <button className="icon-button danger-button condition-delete" onClick={onDelete} title="Eliminar condicion" type="button">
        <Trash2 size={16} />
      </button>
      {hasError && <div className="condition-errors">{issueMessages.map((message) => <span key={message}>{message}</span>)}</div>}
    </article>
  );
}
