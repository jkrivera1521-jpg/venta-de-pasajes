"use client";

import { AlertCircle, Check, Clipboard, LockKeyhole, Maximize2, Minimize2, RefreshCw, X } from "lucide-react";
import type { SchemaField, SchemaFieldType } from "../lib/types";
import type { FormulaTemplate } from "../lib/formula";
import { AviatorCodeEditor } from "./AviatorCodeEditor";

export type FormulaCatalogState = "loading" | "offline" | "empty" | "error" | "ready";

export type FormulaTemplateCatalogProps = {
  isLoading: boolean;
  isFetching: boolean;
  onRefresh: () => void;
  formulaTemplates: FormulaTemplate[];
  selectedTemplateId: string;
  onSelectTemplate: (templateId: string) => void;
  catalogState: FormulaCatalogState;
  selectedTemplate?: FormulaTemplate;
  templateInfoOpen: boolean;
  templateInfoMaximized: boolean;
  onToggleInfoMaximized: () => void;
  onCloseInfo: () => void;
  templateVariableFields: SchemaField[];
  templateMessage: string;
  copiedCopyId: string | null;
  onCopyValue: (value: string, label: string, copyId: string) => void;
  onCopyExpression: () => void;
};

function formatSchemaFieldType(type: SchemaFieldType) {
  switch (type) {
    case "string": return "Texto";
    case "number": return "Número";
    case "currency": return "Moneda (2 decimales)";
    case "boolean": return "Booleano";
    case "date": return "Fecha";
    case "enum": return "Enumerado";
    default: return "Desconocido";
  }
}

function formatTemplateDate(value?: string | null) {
  if (!value) return "No disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function templateLifecycleLabel(template: FormulaTemplate) {
  if (template.activa) return "ACTIVA";
  return template.estado === "PUBLICADA" ? "PUBLICADA" : "BORRADOR";
}

export function FormulaTemplateCatalog({
  isLoading,
  isFetching,
  onRefresh,
  formulaTemplates,
  selectedTemplateId,
  onSelectTemplate,
  catalogState,
  selectedTemplate,
  templateInfoOpen,
  templateInfoMaximized,
  onToggleInfoMaximized,
  onCloseInfo,
  templateVariableFields,
  templateMessage,
  copiedCopyId,
  onCopyValue,
  onCopyExpression
}: FormulaTemplateCatalogProps) {
  return <section aria-label="Plantillas de fórmulas" className="formula-template-copy">
    <div className="formula-template-intro">
      <strong>Empezar desde una fórmula existente</strong>
      <span>Elige una fórmula guardada para cargar una copia editable como nueva.</span>
    </div>
    <div className="formula-template-controls">
      <select aria-label="Seleccionar fórmula como plantilla" disabled={isLoading || !formulaTemplates.length} onChange={(event) => onSelectTemplate(event.target.value)} value={selectedTemplateId}>
        <option value="">
          {isLoading
            ? "Cargando fórmulas..."
            : catalogState === "error"
              ? "Servicio no disponible"
                : catalogState === "empty"
                ? "Catálogo vacío"
                : "Selecciona una fórmula"}
        </option>
        {formulaTemplates.map((template) => (
          <option key={`${template.codigo}::${template.version}`} value={`${template.codigo}::${template.version}`}>
            {template.id}.- {template.nombre} · {template.codigo} · v{template.version}{template.activa ? " · Activa" : " · Inactiva"}
          </option>
        ))}
      </select>
      <button aria-label="Actualizar catálogo de fórmulas" className="formula-icon-button" disabled={isFetching} onClick={onRefresh} title="Actualizar catálogo" type="button"><RefreshCw size={16} /></button>
    </div>
    {catalogState !== "ready" && <div aria-live="polite" className={`formula-template-catalog-status is-${catalogState}`} role={catalogState === "error" ? "alert" : "status"}>
      <AlertCircle size={16} />
      <div>
        <strong>
          {catalogState === "loading" ? "Cargando catálogo" : catalogState === "offline" ? "Modo desconectado" : catalogState === "empty" ? "Catálogo vacío" : "Servicio de plantillas no disponible"}
        </strong>
        <span>
          {catalogState === "loading" ? "Consultando las fórmulas disponibles." : catalogState === "offline" ? `El servicio no responde. Puedes seguir usando las ${formulaTemplates.length} plantillas guardadas en este navegador.` : catalogState === "empty" ? "El servicio respondió correctamente, pero no hay plantillas registradas." : "No se pudo consultar el catálogo. El constructor sigue disponible para crear una fórmula nueva."}
        </span>
      </div>
      {catalogState !== "loading" && <button className="formula-button" disabled={isFetching} onClick={onRefresh} title="Volver a consultar el catálogo de fórmulas" type="button"><RefreshCw size={14} /> {isFetching ? "Consultando..." : "Reintentar"}</button>}
    </div>}
    {templateInfoOpen && selectedTemplate && <section aria-labelledby="formula-template-info-title" className={`formula-template-info-popover ${templateInfoMaximized ? "is-maximized" : ""}`} role="dialog">
      <div className="formula-template-info-header">
        <div>
          <span className="formula-eyebrow">INFORMACIÓN DE LA FÓRMULA</span>
          <h2 id="formula-template-info-title">{selectedTemplate.nombre}</h2>
          <div className="formula-readonly-badge"><LockKeyhole size={13} /> Plantilla original · solo lectura</div>
        </div>
        <div className="formula-template-info-actions">
          <button aria-label={templateInfoMaximized ? "Restaurar información de la fórmula" : "Maximizar información de la fórmula"} className="formula-icon-button" onClick={onToggleInfoMaximized} title={templateInfoMaximized ? "Restaurar" : "Maximizar"} type="button">{templateInfoMaximized ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
          <button aria-label="Cerrar información de la fórmula" className="formula-icon-button" onClick={onCloseInfo} title="Cerrar" type="button"><X size={17} /></button>
        </div>
      </div>
      <dl className="formula-template-info-grid">
        <div><dt>Código</dt><dd className="formula-template-copy-value"><span>{selectedTemplate.codigo}</span><button aria-label={copiedCopyId === "template-code" ? "Código de la fórmula copiado" : "Copiar código de la fórmula"} className={`formula-icon-button ${copiedCopyId === "template-code" ? "is-copied" : ""}`} onClick={() => onCopyValue(selectedTemplate.codigo, "Código", "template-code")} title={copiedCopyId === "template-code" ? "Copiado" : "Copiar código"} type="button">{copiedCopyId === "template-code" ? <Check size={14} /> : <Clipboard size={14} />}</button></dd></div>
        <div><dt>Versión</dt><dd>v{selectedTemplate.version}</dd></div>
        <div><dt>Estado</dt><dd>{templateLifecycleLabel(selectedTemplate)}</dd></div>
        <div><dt>Creado por</dt><dd>{selectedTemplate.creadoPor?.trim() || "desconocido"}</dd></div>
        <div><dt>Fecha de creación</dt><dd className="formula-template-copy-value"><span>{formatTemplateDate(selectedTemplate.fechaCreacion)}</span><button aria-label={copiedCopyId === "template-created-at" ? "Fecha de creación copiada" : "Copiar fecha de creación"} className={`formula-icon-button ${copiedCopyId === "template-created-at" ? "is-copied" : ""}`} disabled={!selectedTemplate.fechaCreacion} onClick={() => onCopyValue(formatTemplateDate(selectedTemplate.fechaCreacion), "Fecha de creación", "template-created-at")} title={copiedCopyId === "template-created-at" ? "Copiada" : "Copiar fecha de creación"} type="button">{copiedCopyId === "template-created-at" ? <Check size={14} /> : <Clipboard size={14} />}</button></dd></div>
      </dl>
      <div className="formula-template-info-section"><h3>Descripción</h3><p>{selectedTemplate.descripcion?.trim() || "No hay una descripción disponible para esta fórmula."}</p></div>
      <div className="formula-template-info-section">
        <h3>Variables utilizadas</h3>
        {templateVariableFields.length ? <div className="formula-template-variable-list">{templateVariableFields.map((field) => {
          const copyId = `template-variable:${field.key}`;
          const isCopied = copiedCopyId === copyId;
          return <div className="formula-template-variable" key={field.key}>
            <div className="formula-template-variable-name"><strong>{field.label}</strong><code>{field.key}</code></div>
            <div className="formula-template-variable-actions"><span>{formatSchemaFieldType(field.type)}</span><button aria-label={isCopied ? `Variable ${field.key} copiada` : `Copiar variable ${field.key}`} className={`formula-icon-button ${isCopied ? "is-copied" : ""}`} onClick={() => onCopyValue(field.key, "Variable", copyId)} title={isCopied ? "Copiada" : "Copiar variable"} type="button">{isCopied ? <Check size={14} /> : <Clipboard size={14} />}</button></div>
          </div>;
        })}</div> : <p>Esta fórmula no utiliza variables de entrada.</p>}
      </div>
      {templateMessage && <div className="formula-template-info-message">{templateMessage}</div>}
      <div className="formula-template-info-section">
        <div className="formula-template-code-heading"><h3>Expresión guardada</h3><button aria-label={copiedCopyId === "template-expression" ? "Expresión guardada copiada" : "Copiar expresión guardada"} className={`formula-icon-button ${copiedCopyId === "template-expression" ? "is-copied" : ""}`} disabled={!selectedTemplate.expresion} onClick={onCopyExpression} title={copiedCopyId === "template-expression" ? "Copiada" : "Copiar expresión"} type="button">{copiedCopyId === "template-expression" ? <Check size={16} /> : <Clipboard size={16} />}</button></div>
        {selectedTemplate.expresion ? <div className="formula-template-code-editor"><AviatorCodeEditor onChange={() => undefined} readOnly value={selectedTemplate.expresion} /></div> : <p>No hay una expresión disponible.</p>}
      </div>
    </section>}
  </section>;
}
