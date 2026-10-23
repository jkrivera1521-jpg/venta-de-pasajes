"use client";

import { AlertCircle, Blocks, CheckCircle2, Database, FilePlus2, FlaskConical, FolderOpen, GitBranch, Save } from "lucide-react";
import type { ChangeEvent, ReactNode, RefObject } from "react";
import type { FormulaIssue, FormulaRoot, FormulaTemplate } from "../lib/formula";

type FormulaRepresentationMode = "visual" | "code";
type WorkflowStatus = "BORRADOR" | "VALIDADA" | "VERSION_GUARDADA" | "PUBLICADA" | "ACTIVA";

export type FormulaToolbarProps = {
  schemaIsError: boolean;
  fieldsLength: number;
  workflowStatus: WorkflowStatus;
  workflowStatusLabel: string;
  expression: FormulaRoot | null;
  payrollLayout: "compact" | "decomposed";
  onDecompose: () => void;
  onCompact: () => void;
  onNew: () => void;
  onOpen: (event: ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  selectedTemplate: FormulaTemplate | undefined;
  onNewVersion: (template: FormulaTemplate) => void;
  actionButtonsDisabled: boolean;
  representationActionsDisabledReason: string;
  onSave: () => void;
  databaseSaveDisabled: boolean;
  databaseSaveBusy: boolean;
  onSaveVersion: () => void;
  canPublish: boolean;
  lifecycleBusy: boolean;
  onPublish: () => void;
  canActivate: boolean;
  onActivate: () => void;
  validationBusy: boolean;
  onValidate: () => void;
  onTest: () => void;
  formulaName: string;
  onFormulaNameChange: (value: string) => void;
  formulaCode: string;
  onFormulaCodeChange: (value: string) => void;
  templateContent: ReactNode;
  validationState: "is-invalid" | "is-valid" | "is-pending";
  validationLabel: string;
  issues: FormulaIssue[];
  saveMessage: string;
  representationMode: FormulaRepresentationMode;
  representationInfo: { label: string; description: string };
};

export function FormulaToolbar({
  schemaIsError,
  fieldsLength,
  workflowStatus,
  workflowStatusLabel,
  expression,
  payrollLayout,
  onDecompose,
  onCompact,
  onNew,
  onOpen,
  fileInputRef,
  selectedTemplate,
  onNewVersion,
  actionButtonsDisabled,
  representationActionsDisabledReason,
  onSave,
  databaseSaveDisabled,
  databaseSaveBusy,
  onSaveVersion,
  canPublish,
  lifecycleBusy,
  onPublish,
  canActivate,
  onActivate,
  validationBusy,
  onValidate,
  onTest,
  formulaName,
  onFormulaNameChange,
  formulaCode,
  onFormulaCodeChange,
  templateContent,
  validationState,
  validationLabel,
  issues,
  saveMessage,
  representationMode,
  representationInfo
}: FormulaToolbarProps) {
  return <>
    <header className="formula-toolbar">
      <div className="formula-brand">
        <div className="formula-brand-mark" aria-hidden="true">ƒx</div>
        <div>
          <span className="formula-eyebrow">AVIATORSCRIPT STUDIO</span>
          <h1>Constructor visual de fórmulas</h1>
          <p>Arma la lógica conectando bloques; la expresión se genera por ti.</p>
        </div>
      </div>
      <div className="formula-actions">
        <span className={`formula-connection ${schemaIsError ? "is-warning" : ""}`}><span />{schemaIsError ? "Esquema local" : `${fieldsLength} variables`}</span>
        <span className={`formula-workflow-status formula-workflow-${workflowStatus.toLowerCase()}`}><span />{workflowStatusLabel}</span>
        {expression?.kind === "payroll" && payrollLayout === "compact" && <button className="formula-button" onClick={onDecompose} title="Descomponer la fórmula de nómina en bloques editables" type="button"><Blocks size={16} /> Descomponer</button>}
        {expression?.kind === "payroll" && payrollLayout === "decomposed" && <button className="formula-button" onClick={onCompact} title="Compactar la fórmula de nómina en un bloque resumido" type="button"><Blocks size={16} /> Compactar</button>}
        <button className="formula-button" onClick={onNew} title="Crear una fórmula nueva desde cero" type="button"><FilePlus2 size={16} /> Nueva</button>
        <button className="formula-button" onClick={() => fileInputRef.current?.click()} title="Abrir una fórmula guardada desde un archivo JSON" type="button"><FolderOpen size={16} /> Abrir</button>
        <input accept="application/json,.json" className="visually-hidden" onChange={onOpen} ref={fileInputRef} type="file" />
        {selectedTemplate && <button className="formula-button" onClick={() => onNewVersion(selectedTemplate)} title="Crear una copia editable sin modificar la plantilla original" type="button"><GitBranch size={16} /> Nueva versión</button>}
        <button className="formula-button" disabled={actionButtonsDisabled} onClick={onSave} title={representationActionsDisabledReason || "Conservar el borrador local y descargar un archivo .aviatorscript.json"} type="button"><Save size={16} /> Guardar</button>
        <button aria-label="Guardar versión en la base de datos" className="formula-button formula-button-database" disabled={databaseSaveDisabled} onClick={onSaveVersion} title={representationActionsDisabledReason || (databaseSaveDisabled ? "Valida la fórmula antes de guardar una versión" : "Guardar una nueva versión como borrador en la base de datos")} type="button"><Database size={16} /> {databaseSaveBusy ? "Guardando..." : "Guardar versión"}</button>
        {canPublish && <button className="formula-button formula-button-primary" disabled={lifecycleBusy} onClick={onPublish} title="Cambiar la versión guardada de BORRADOR a PUBLICADA" type="button"><CheckCircle2 size={16} /> Publicar</button>}
        {canActivate && <button className="formula-button formula-button-primary" disabled={lifecycleBusy} onClick={onActivate} title="Desactivar la versión activa anterior y activar esta versión PUBLICADA" type="button"><CheckCircle2 size={16} /> Activar</button>}
        <button className="formula-button formula-button-primary" disabled={actionButtonsDisabled || validationBusy} onClick={onValidate} title={representationActionsDisabledReason || "Validar la fórmula antes de persistirla o probarla"} type="button"><CheckCircle2 size={16} /> {validationBusy ? "Validando..." : "Validar"}</button>
        <button className="formula-button formula-button-primary" disabled={actionButtonsDisabled} onClick={onTest} title={representationActionsDisabledReason || "Abrir el panel para ejecutar una prueba con datos JSON"} type="button"><FlaskConical size={16} /> Probar fórmula</button>
      </div>
    </header>

    <div className="formula-definition-bar">
      <div className="formula-heading">
        <label htmlFor="formula-name">Nombre de la fórmula</label>
        <input className="formula-name-input" id="formula-name" maxLength={100} onChange={(event) => onFormulaNameChange(event.target.value)} value={formulaName} />
        <label className="formula-code-label" htmlFor="formula-code">Código BD</label>
        <input className="formula-code-input" id="formula-code" maxLength={100} onChange={(event) => onFormulaCodeChange(event.target.value)} spellCheck={false} value={formulaCode} />
        <div className={`formula-status formula-status-inline ${validationState}`}>
          <div className="formula-status-main">
            {validationState === "is-invalid" ? <AlertCircle size={15} /> : validationState === "is-valid" ? <CheckCircle2 size={15} /> : <span className="status-dot" />}
            <strong>{validationLabel}</strong>
          </div>
          {(issues.length > 0 || saveMessage || validationState === "is-valid") && <span className="formula-status-message">{issues[0]?.message ?? saveMessage ?? "La fórmula está lista para probarse."}</span>}
        </div>
        <div aria-label={`Representación: ${representationInfo.label}`} className={`formula-representation-badge formula-representation-${representationMode}`} title={representationInfo.description}>
          {representationMode === "visual" ? <Blocks size={14} /> : <span aria-hidden="true">&lt;/&gt;</span>}
          <span>{representationInfo.label}</span>
        </div>
      </div>
      {templateContent}
    </div>
  </>;
}
