"use client";

import {
  AlertCircle,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clipboard,
  LoaderCircle,
  Play,
  RefreshCw,
  RotateCcw,
  Table2,
  WifiOff,
  XCircle
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createValue,
  humanize,
  inputExample,
  readPath,
  schemaForFormula,
  schemaType,
  type FormulaTemplate,
  type JsonSchema,
  type RuntimeExecution,
  type UiSection,
  validateInput,
  writePath
} from "../lib/contracts";

const catalogCacheKey = "formula-runtime.catalog";

function readCachedCatalog(): FormulaTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(catalogCacheKey) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

async function loadCatalog(accessToken?: string | null): Promise<FormulaTemplate[]> {
  const response = await fetch("/api/formulas", { cache: "no-store", headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const errorValue = payload && typeof payload === "object" && "error" in payload ? (payload as { error?: unknown }).error : undefined;
    const message = typeof errorValue === "string"
      ? errorValue
      : errorValue && typeof errorValue === "object" && "message" in errorValue
        ? String((errorValue as { message?: unknown }).message)
        : "No se pudo cargar el catálogo.";
    throw new Error(message);
  }
  if (!Array.isArray(payload)) throw new Error("El catálogo recibido no es válido.");
  return payload as FormulaTemplate[];
}

function copyValue(value: unknown): unknown {
  return value && typeof value === "object" ? structuredClone(value) : value;
}

function getSchemaAtPath(schema: JsonSchema, path: string): JsonSchema | undefined {
  return path.split(".").reduce<JsonSchema | undefined>((current, part) => {
    if (!current) return undefined;
    if (schemaType(current) === "array" && /^\d+$/.test(part)) return current.items;
    return current.properties?.[part];
  }, schema);
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

function isTabularArraySchema(schema: JsonSchema) {
  const itemSchema = schema.items;
  if (!itemSchema || schemaType(itemSchema) !== "object") return false;
  const columns = Object.values(itemSchema.properties ?? {});
  return columns.length > 0 && columns.every((column) => ["string", "number", "integer", "boolean"].includes(schemaType(column)));
}

function PrimitiveField({
  label,
  path,
  schema,
  value,
  required,
  onChange,
  compact = false
}: {
  label: string;
  path: string;
  schema: JsonSchema;
  value: unknown;
  required?: boolean;
  onChange: (path: string, value: unknown) => void;
  compact?: boolean;
}) {
  const type = schemaType(schema);
  const inputId = `runtime-input-${path.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const isBoolean = type === "boolean";
  const inputType = type === "number" || type === "integer" ? "number" : schema.format === "date" ? "date" : schema.format === "date-time" ? "datetime-local" : "text";
  const inputValue = value === null || value === undefined ? "" : value;
  const accessibleLabel = `${label}${required ? " (obligatorio)" : ""}`;

  return (
    <div className={`runtime-input-group ${compact ? "runtime-table-cell-field" : ""}`}>
      {!compact ? <label htmlFor={inputId}>{label}{required ? <span className="runtime-required"> *</span> : null}</label> : null}
      {schema.description && !compact ? <span className="runtime-field-help">{schema.description}</span> : null}
      {schema.enum?.length ? (
        <select aria-label={accessibleLabel} id={inputId} title={schema.description} value={String(inputValue)} onChange={(event) => onChange(path, event.target.value)}>
          <option value="">Selecciona una opción</option>
          {schema.enum.map((option) => <option key={String(option)} value={String(option)}>{String(option)}</option>)}
        </select>
      ) : isBoolean ? (
        <label className="runtime-checkbox-row">
          <input aria-label={accessibleLabel} id={inputId} type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(path, event.target.checked)} />
          <span>{value ? "Sí" : "No"}</span>
        </label>
      ) : (
        <input
          aria-label={accessibleLabel}
          id={inputId}
          max={schema.maximum}
          maxLength={schema.maxLength}
          min={schema.minimum}
          minLength={schema.minLength}
          title={schema.description}
          type={inputType}
          value={String(inputValue)}
          onChange={(event) => {
            const raw = event.target.value;
            if (type === "number" || type === "integer") onChange(path, raw === "" ? "" : Number(raw));
            else onChange(path, raw);
          }}
        />
      )}
    </div>
  );
}

function ArrayTableField({
  label,
  path,
  schema,
  values,
  required,
  onChange
}: {
  label: string;
  path: string;
  schema: JsonSchema;
  values: unknown[];
  required?: boolean;
  onChange: (path: string, value: unknown) => void;
}) {
  const itemSchema = schema.items as JsonSchema;
  const columns = Object.entries(itemSchema.properties ?? {});
  const addItem = () => onChange(path, [...values, createValue(itemSchema)]);

  return (
    <fieldset className="runtime-fieldset runtime-array-fieldset runtime-table-fieldset">
      <legend className="runtime-array-legend">
        <span>{schema.title || label}{required ? <span className="runtime-required"> *</span> : null}</span>
        <button className="runtime-secondary-button runtime-add-button" type="button" onClick={addItem}>
          <span aria-hidden="true">+</span> Agregar elemento
        </button>
      </legend>
      {schema.description ? <p className="runtime-field-help">{schema.description}</p> : null}
      <div className="runtime-array-table-wrap">
        <table className="runtime-array-table">
          <thead>
            <tr>
              {columns.map(([key, column]) => <th key={key} scope="col" title={column.description}>{column.title || humanize(key)}{itemSchema.required?.includes(key) ? <span className="runtime-required"> *</span> : null}</th>)}
              <th scope="col" className="runtime-array-actions-heading">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {values.map((item, index) => (
              <tr key={`${path}.${index}`}>
                {columns.map(([key, column]) => (
                  <td key={key}>
                    <PrimitiveField
                      compact
                      label={`${schema.title || label} ${index + 1}, ${column.title || humanize(key)}`}
                      path={`${path}.${index}.${key}`}
                      required={itemSchema.required?.includes(key)}
                      schema={column}
                      value={readPath(item, key)}
                      onChange={onChange}
                    />
                  </td>
                ))}
                <td className="runtime-array-actions-cell">
                  <button
                    aria-label={`Eliminar ${label.toLowerCase()} ${index + 1}`}
                    className="runtime-icon-button runtime-danger-button"
                    title={`Eliminar ${label.toLowerCase()} ${index + 1}`}
                    type="button"
                    onClick={() => onChange(path, values.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    <XCircle size={15} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
            {!values.length ? <tr><td className="runtime-table-empty" colSpan={columns.length + 1}>No hay elementos. Usa “+ Agregar elemento” para comenzar.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </fieldset>
  );
}

function DynamicField({
  label,
  path,
  schema,
  value,
  required,
  onChange,
  depth = 0
}: {
  label: string;
  path: string;
  schema: JsonSchema;
  value: unknown;
  required?: boolean;
  onChange: (path: string, value: unknown) => void;
  depth?: number;
}) {
  const type = schemaType(schema);
  const title = schema.title || label;
  const description = schema.description;

  if (type === "object") {
    return (
      <fieldset className={`runtime-fieldset runtime-depth-${Math.min(depth, 3)}`}>
        <legend>{title}{required ? <span className="runtime-required"> *</span> : null}</legend>
        {description ? <p className="runtime-field-help">{description}</p> : null}
        {Object.entries(schema.properties ?? {}).map(([key, child]) => (
          <DynamicField
            key={`${path}.${key}`}
            label={humanize(key)}
            path={path ? `${path}.${key}` : key}
            schema={child}
            value={readPath(value, key)}
            required={schema.required?.includes(key)}
            onChange={onChange}
            depth={depth + 1}
          />
        ))}
        {Object.keys(schema.properties ?? {}).length === 0 ? (
          <JsonField label={title} path={path} value={value ?? {}} onChange={onChange} />
        ) : null}
      </fieldset>
    );
  }

  if (type === "array") {
    const values = Array.isArray(value) ? value : [];
    if (isTabularArraySchema(schema)) {
      return <ArrayTableField label={label} path={path} required={required} schema={schema} values={values} onChange={onChange} />;
    }

    return (
      <fieldset className="runtime-fieldset runtime-array-fieldset">
        <legend>{title}{required ? <span className="runtime-required"> *</span> : null}</legend>
        {description ? <p className="runtime-field-help">{description}</p> : null}
        <div className="runtime-array-list">
          {values.map((item, index) => (
            <div className="runtime-array-item" key={`${path}.${index}`}>
              <DynamicField
                label={`${title} ${index + 1}`}
                path={`${path}.${index}`}
                schema={schema.items ?? { type: "unknown" }}
                value={item}
                onChange={onChange}
                depth={depth + 1}
              />
              <button
                className="runtime-icon-button runtime-danger-button"
                type="button"
                title={`Eliminar ${title.toLowerCase()} ${index + 1}`}
                aria-label={`Eliminar ${title.toLowerCase()} ${index + 1}`}
                onClick={() => onChange(path, values.filter((_, itemIndex) => itemIndex !== index))}
              >
                <XCircle size={15} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
        <button
          className="runtime-secondary-button runtime-add-button"
          type="button"
          onClick={() => onChange(path, [...values, createValue(schema.items ?? { type: "unknown" })])}
        >
          <span aria-hidden="true">+</span> Agregar elemento
        </button>
      </fieldset>
    );
  }

  return <PrimitiveField label={title} path={path} required={required} schema={schema} value={value} onChange={onChange} />;
}

function JsonField({ label, path, value, onChange }: { label: string; path: string; value: unknown; onChange: (path: string, value: unknown) => void }) {
  const [text, setText] = useState(() => displayValue(value));
  const [error, setError] = useState("");
  useEffect(() => setText(displayValue(value)), [value]);
  return (
    <div className="runtime-input-group">
      <label htmlFor={`runtime-json-${path}`}>{label}</label>
      <textarea
        id={`runtime-json-${path}`}
        value={text}
        rows={5}
        onChange={(event) => {
          setText(event.target.value);
          try {
            const next = JSON.parse(event.target.value);
            setError("");
            onChange(path, next);
          } catch {
            setError("JSON incompleto o inválido.");
          }
        }}
      />
      {error ? <span className="runtime-inline-error">{error}</span> : null}
    </div>
  );
}

function ResultValue({ value, depth = 0 }: { value: unknown; depth?: number }): ReactNode {
  if (value === null || value === undefined) return <span className="runtime-muted">null</span>;
  if (typeof value !== "object") return <span className="runtime-primitive">{String(value)}</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="runtime-muted">Lista vacía</span>;
    const records = value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)));
    const columns = Array.from(new Set(records.flatMap((item) => Object.keys(item))));
    if (records.length === value.length && columns.length > 0 && columns.length <= 12) {
      return (
        <div className="runtime-table-wrap">
          <table><thead><tr>{columns.map((column) => <th key={column}>{humanize(column)}</th>)}</tr></thead>
            <tbody>{records.map((record, index) => <tr key={index}>{columns.map((column) => <td key={column}><ResultValue value={record[column]} depth={depth + 1} /></td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    }
    return <pre className="runtime-json-output">{JSON.stringify(value, null, 2)}</pre>;
  }
  return (
    <div className="runtime-result-object">
      {Object.entries(value as Record<string, unknown>).map(([key, child]) => (
        <details key={key} open={depth < 1}>
          <summary>{humanize(key)}</summary>
          <div className="runtime-result-child"><ResultValue value={child} depth={depth + 1} /></div>
        </details>
      ))}
    </div>
  );
}

function sectionFields(schema: JsonSchema, section?: UiSection): Array<[string, JsonSchema]> {
  const entries = Object.entries(schema.properties ?? {});
  if (!section?.fields?.length) return entries;
  return section.fields.map((field) => [field, getSchemaAtPath(schema, field)] as [string, JsonSchema]).filter((entry): entry is [string, JsonSchema] => Boolean(entry[1]));
}

export default function FormulaRuntime({ accessToken = null }: { accessToken?: string | null }) {
  // Keep the first render identical on the server and in the browser. localStorage is hydrated after mount.
  const [cachedCatalog, setCachedCatalog] = useState<FormulaTemplate[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [inputValues, setInputValues] = useState<Record<string, unknown>>({});
  const [execution, setExecution] = useState<RuntimeExecution | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [executionError, setExecutionError] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [copied, setCopied] = useState(false);

  const catalogQuery = useQuery<FormulaTemplate[], Error>({ queryKey: ["formula-runtime", "catalog", accessToken ?? "anonymous"], queryFn: () => loadCatalog(accessToken), staleTime: 30_000, retry: 1 });
  const catalog = catalogQuery.data ?? cachedCatalog;
  const activeCatalog = useMemo(() => catalog.filter((formula) => formula.activa), [catalog]);
  const selected = activeCatalog.find((formula) => formula.codigo === selectedCode) ?? activeCatalog[0];
  const inputSchema = useMemo<JsonSchema>(() => selected ? schemaForFormula(selected) : { type: "object", properties: {} }, [selected]);
  const uiSchema = selected?.configuracionInterfaz ?? {};
  const outputSchema = selected?.contratoSalida ?? null;
  const sections = uiSchema.sections?.length ? uiSchema.sections : [{ title: uiSchema.title || "Datos de entrada", description: uiSchema.description, fields: undefined }];

  useEffect(() => {
    setCachedCatalog(readCachedCatalog());
  }, []);

  useEffect(() => {
    if (catalogQuery.data) {
      setCachedCatalog(catalogQuery.data);
      try { window.localStorage.setItem(catalogCacheKey, JSON.stringify(catalogQuery.data)); } catch { /* cache is optional */ }
    }
  }, [catalogQuery.data]);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("formula");
    if (requested && activeCatalog.some((formula) => formula.codigo === requested)) setSelectedCode(requested);
    else if (!selectedCode && activeCatalog[0]) setSelectedCode(activeCatalog[0].codigo);
  }, [activeCatalog, selectedCode]);

  useEffect(() => {
    if (!selected) return;
    setInputValues(copyValue(inputExample(selected)) as Record<string, unknown>);
    setValidationErrors([]);
    setExecution(null);
    setExecutionError("");
  }, [selected?.codigo, selected?.version]);

  const onChange = (path: string, value: unknown) => setInputValues((current) => writePath(current, path, value));
  const resetInput = () => {
    if (!selected) return;
    setInputValues(copyValue(inputExample(selected)) as Record<string, unknown>);
    setValidationErrors([]);
    setExecution(null);
    setExecutionError("");
  };

  const execute = async () => {
    if (!selected) return;
    const errors = validateInput(inputSchema, inputValues);
    setValidationErrors(errors);
    setExecutionError("");
    setExecution(null);
    if (errors.length) return;
    setIsExecuting(true);
    try {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({ codigoFormula: selected.codigo, idSolicitud: `RUNTIME-${Date.now()}`, parametros: inputValues })
      });
      const payload = await response.json().catch(() => null) as RuntimeExecution & { error?: string };
      if (!response.ok) throw new Error(payload?.error || "El motor no pudo ejecutar la fórmula.");
      setExecution(payload);
      if (payload.estado && payload.estado !== "EXITOSO") setExecutionError(payload.error || "El motor rechazó los datos de entrada.");
    } catch (error) {
      setExecutionError(error instanceof Error ? error.message : "No se pudo ejecutar el cálculo.");
    } finally {
      setIsExecuting(false);
    }
  };

  const copyResult = async () => {
    if (!execution) return;
    await navigator.clipboard.writeText(JSON.stringify(execution.resultado ?? execution, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const refresh = () => { void catalogQuery.refetch(); };

  return (
    <main className="runtime-shell">
      <header className="runtime-header">
        <div className="runtime-brand"><div className="runtime-brand-mark"><Calculator size={20} aria-hidden="true" /></div><div><p className="runtime-eyebrow">APLICACIONES DE CÁLCULO</p><h1>{uiSchema.title || "Consulta de cálculo"}</h1><p className="runtime-subtitle">Completa los datos y ejecuta una fórmula publicada en el motor AviatorScript.</p></div></div>
        <div className="runtime-header-actions">
          {catalogQuery.isError && cachedCatalog.length ? <span className="runtime-status runtime-status-warning"><WifiOff size={14} aria-hidden="true" />Modo desconectado</span> : null}
          <button className="runtime-secondary-button" type="button" title="Actualizar el catálogo de fórmulas" onClick={refresh} disabled={catalogQuery.isFetching}><RefreshCw size={15} className={catalogQuery.isFetching ? "runtime-spin" : ""} aria-hidden="true" /> Actualizar</button>
        </div>
      </header>

      {catalogQuery.isError && !cachedCatalog.length ? <section className="runtime-alert runtime-alert-error"><AlertCircle size={18} aria-hidden="true" /><div><strong>No se pudo cargar el catálogo</strong><p>{catalogQuery.error.message}</p></div><button className="runtime-secondary-button" type="button" onClick={refresh}>Reintentar</button></section> : null}
      {!catalogQuery.isError && !catalogQuery.isLoading && !activeCatalog.length ? <section className="runtime-alert runtime-alert-info"><AlertCircle size={18} aria-hidden="true" /><div><strong>No hay fórmulas publicadas</strong><p>El catálogo está disponible, pero no contiene versiones activas para ejecutar.</p></div></section> : null}

      {selected ? <>
        <section className="runtime-formula-bar">
          <div><label htmlFor="runtime-formula">Fórmula publicada</label><select id="runtime-formula" value={selected.codigo} onChange={(event) => setSelectedCode(event.target.value)}>{activeCatalog.map((formula) => <option key={`${formula.codigo}-${formula.version}`} value={formula.codigo}>{formula.nombre} · {formula.codigo} · v{formula.version}</option>)}</select></div>
          <div className="runtime-formula-meta"><span className="runtime-status runtime-status-success"><CheckCircle2 size={14} aria-hidden="true" /> Publicada y activa</span><span>Versión {selected.version}</span></div>
        </section>

        <div className="runtime-grid">
          <section className="runtime-panel runtime-input-panel">
            <div className="runtime-panel-heading"><div><p className="runtime-eyebrow">ENTRADA DINÁMICA</p><h2>{uiSchema.title || "Datos de entrada"}</h2><p>{selected.descripcion || "Los campos se generan desde el contrato de entrada de la fórmula."}</p></div><span className="runtime-contract-badge">{selected.contratoEntrada ? "Contrato publicado" : "Inferido del ejemplo"}</span></div>
            <div className="runtime-form">
              {sections.map((section, index) => <div className="runtime-form-section" key={`${section.title}-${index}`}><div className="runtime-section-heading"><div><h3>{section.title || `Sección ${index + 1}`}</h3>{section.description ? <p>{section.description}</p> : null}</div><ChevronDown size={16} aria-hidden="true" /></div>{sectionFields(inputSchema, section).map(([key, child]) => <DynamicField key={key} label={humanize(key)} path={key} schema={child} value={readPath(inputValues, key)} required={inputSchema.required?.includes(key)} onChange={onChange} />)}</div>)}
            </div>
            {validationErrors.length ? <div className="runtime-alert runtime-alert-error runtime-validation-alert"><AlertCircle size={18} aria-hidden="true" /><div>{validationErrors.map((error) => <p key={error}>{error}</p>)}</div></div> : null}
            <div className="runtime-form-actions"><button className="runtime-secondary-button" type="button" onClick={resetInput}><RotateCcw size={15} aria-hidden="true" /> Restablecer</button><button className="runtime-primary-button" type="button" onClick={execute} disabled={isExecuting}><Play size={16} aria-hidden="true" /> {isExecuting ? "Ejecutando..." : uiSchema.submitLabel || "Ejecutar cálculo"}</button></div>
          </section>

          <section className="runtime-panel runtime-result-panel">
            <div className="runtime-panel-heading"><div><p className="runtime-eyebrow">SALIDA DEL MOTOR</p><h2>{uiSchema.resultTitle || "Resultado"}</h2><p>Respuesta producida por la versión activa de AviatorScript.</p></div><div className="runtime-panel-heading-actions">{outputSchema ? <span className="runtime-contract-badge">Salida tipada</span> : null}{execution ? <button className="runtime-icon-button" type="button" title="Copiar resultado JSON" aria-label="Copiar resultado JSON" onClick={copyResult}><Clipboard size={16} aria-hidden="true" /></button> : null}</div></div>
            {executionError ? <div className="runtime-alert runtime-alert-error"><AlertCircle size={18} aria-hidden="true" /><div><strong>El cálculo no se completó</strong><p>{executionError}</p></div></div> : null}
            {execution && !executionError ? <><div className="runtime-result-summary"><span className="runtime-status runtime-status-success"><CheckCircle2 size={14} aria-hidden="true" /> Ejecución exitosa</span>{execution.tipoResultado ? <span>Tipo: {execution.tipoResultado}</span> : null}{execution.duracionMs !== undefined ? <span>{execution.duracionMs} ms</span> : null}{copied ? <span className="runtime-copied">Copiado</span> : null}</div><div className="runtime-result-content"><ResultValue value={execution.resultado} /></div></> : <div className="runtime-empty-result"><Table2 size={30} aria-hidden="true" /><strong>Listo para ejecutar</strong><p>El resultado aparecerá aquí después de una ejecución válida.</p></div>}
          </section>
        </div>
      </> : null}

      {catalogQuery.isLoading && !cachedCatalog.length ? <div className="runtime-loading"><LoaderCircle className="runtime-spin" size={22} aria-hidden="true" /> Cargando fórmulas publicadas...</div> : null}
      {catalogQuery.isError && cachedCatalog.length ? <div className="runtime-offline-note"><WifiOff size={15} aria-hidden="true" /> El servicio no responde. Estás usando {cachedCatalog.length} fórmula(s) guardada(s) en este navegador.</div> : null}
    </main>
  );
}
