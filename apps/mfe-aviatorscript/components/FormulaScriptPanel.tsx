"use client";

import { AlertCircle, Check, CheckCircle2, Clipboard, Code2, FlaskConical, Maximize2, Minimize2, RefreshCw } from "lucide-react";
import type { CSSProperties, RefObject } from "react";
import type { FormulaIssue, FormulaRoot } from "../lib/formula";
import type { SchemaField } from "../lib/types";
import type { AviatorFlowGraph } from "../lib/visualization";
import { AviatorCodeEditor } from "./AviatorCodeEditor";
import { CurlCodeViewer } from "./CurlCodeViewer";
import { FormulaTestValues } from "./FormulaTestValues";
import { JsonCodeEditor } from "./JsonCodeEditor";

type PanelTab = "script" | "test" | "curl";
type FormulaRepresentationMode = "visual" | "code";

export type FormulaTestResult = { value: unknown; elapsed: number; engine: string };

export type FormulaScriptPanelProps = {
  panelTab: PanelTab;
  onPanelTabChange: (tab: PanelTab) => void;
  mobileVisible: boolean;
  maximized: boolean;
  onToggleMaximize: () => void;
  script: string;
  codeDraft: string;
  codeIssue: string;
  onCodeDraftChange: (value: string) => void;
  onLineClick: (line: number) => void;
  onDiscardCodeDraft: () => void;
  onApplyCodeDraft: () => void;
  expression: FormulaRoot | null;
  visualGraph: AviatorFlowGraph | null;
  selectedFlowNodeId?: string;
  representationMode: FormulaRepresentationMode;
  representationLabel: string;
  issues: FormulaIssue[];
  fields: SchemaField[];
  testPayload: string;
  onOpenJson: () => void;
  onPayloadChange: (value: string) => void;
  copiedCopyId: string | null;
  onCopyScript: () => void;
  onCopyPayload: () => void;
  onCopyResult: () => void;
  onRestorePayload: () => void;
  testBusy: boolean;
  hasValidated: boolean;
  hasBlockingIssues: boolean;
  onExecuteTest: () => void;
  testError: string;
  testResult: FormulaTestResult | null;
  testPayloadHeight: number | null;
  onTestPanelResizeKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onTestPanelResizePointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  curlCommand: string;
  calculationEndpointError: boolean;
  calculationEndpointLoading: boolean;
  calculationEndpoint: string;
  onCopyCurl: () => void;
  scriptPanelRef: RefObject<HTMLElement | null>;
};

export function FormulaScriptPanel({
  panelTab,
  onPanelTabChange,
  mobileVisible,
  maximized,
  onToggleMaximize,
  script,
  codeDraft,
  codeIssue,
  onCodeDraftChange,
  onLineClick,
  onDiscardCodeDraft,
  onApplyCodeDraft,
  expression,
  visualGraph,
  selectedFlowNodeId,
  representationMode,
  representationLabel,
  issues,
  fields,
  testPayload,
  onOpenJson,
  onPayloadChange,
  copiedCopyId,
  onCopyScript,
  onCopyPayload,
  onCopyResult,
  onRestorePayload,
  testBusy,
  hasValidated,
  hasBlockingIssues,
  onExecuteTest,
  testError,
  testResult,
  testPayloadHeight,
  onTestPanelResizeKeyDown,
  onTestPanelResizePointerDown,
  curlCommand,
  calculationEndpointError,
  calculationEndpointLoading,
  calculationEndpoint,
  onCopyCurl,
  scriptPanelRef
}: FormulaScriptPanelProps) {
  return <aside
    aria-label={maximized ? (panelTab === "script" ? "AviatorScript ampliado" : panelTab === "test" ? "Prueba de regla ampliada" : "cURL ampliado") : undefined}
    aria-modal={maximized ? true : undefined}
    className={`script-panel ${panelTab !== "script" ? "is-testing" : ""} ${mobileVisible ? "mobile-visible" : "mobile-hidden"} ${maximized ? "panel-maximized" : ""}`}
    data-maximized-panel={maximized ? "script" : undefined}
    ref={scriptPanelRef}
    role={maximized ? "dialog" : undefined}
    tabIndex={maximized ? -1 : undefined}
  >
    <div className="script-panel-header">
      <div>
        <span className="formula-eyebrow">{panelTab === "script" ? "EXPRESIÓN GENERADA" : panelTab === "test" ? "MOTOR REAL" : "INTEGRACIÓN API"}</span>
        <h2 id="script-panel-title">{panelTab === "script" ? "AviatorScript" : panelTab === "test" ? "Probar fórmula" : "cURL"}</h2>
        {panelTab === "script" && <div className={`formula-panel-representation formula-representation-${representationMode}`}>{representationMode === "visual" ? <Code2 size={13} /> : <span aria-hidden="true">&lt;/&gt;</span>} {representationLabel}</div>}
      </div>
      <div className="script-panel-header-actions">
        {panelTab === "script" && <button aria-label={copiedCopyId === "generated-script" ? "Fórmula copiada" : "Copiar fórmula"} className={`formula-icon-button ${copiedCopyId === "generated-script" ? "is-copied" : ""}`} disabled={!script} onClick={onCopyScript} title={copiedCopyId === "generated-script" ? "Copiada" : "Copiar fórmula"} type="button">{copiedCopyId === "generated-script" ? <Check size={17} /> : <Clipboard size={17} />}</button>}
        <button aria-label={maximized ? "Restaurar panel" : "Maximizar panel"} className="formula-icon-button" onClick={onToggleMaximize} title={maximized ? "Restaurar panel" : "Maximizar panel"} type="button">{maximized ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
      </div>
    </div>
    <div aria-label="Pestañas del panel de fórmula" className="script-panel-tabs" role="tablist">
      <button aria-controls="formula-panel-content" aria-selected={panelTab === "script"} className={panelTab === "script" ? "is-active" : ""} id="aviatorscript-panel-tab" onClick={() => onPanelTabChange("script")} role="tab" title="Ver el AviatorScript generado" type="button">AviatorScript</button>
      <button aria-controls="formula-panel-content" aria-selected={panelTab === "test"} className={panelTab === "test" ? "is-active" : ""} id="test-rule-panel-tab" onClick={() => onPanelTabChange("test")} role="tab" title="Editar el JSON y ejecutar la fórmula en el motor AviatorScript" type="button">Probar fórmula</button>
      <button aria-controls="formula-panel-content" aria-selected={panelTab === "curl"} className={panelTab === "curl" ? "is-active" : ""} id="curl-panel-tab" onClick={() => onPanelTabChange("curl")} role="tab" title="Ver y copiar el comando cURL de la prueba" type="button">cURL</button>
    </div>
    <div aria-labelledby={panelTab === "script" ? "aviatorscript-panel-tab" : panelTab === "test" ? "test-rule-panel-tab" : "curl-panel-tab"} className="formula-panel-content" id="formula-panel-content" role="tabpanel" style={testPayloadHeight === null ? undefined : { "--formula-test-payload-height": `${testPayloadHeight}px` } as CSSProperties}>
      {panelTab === "script" ? <>
        <AviatorCodeEditor activeRange={visualGraph?.nodes.find((node) => node.id === selectedFlowNodeId)?.data.source} error={codeIssue} onChange={onCodeDraftChange} onLineClick={onLineClick} value={codeDraft} />
        <div className="script-editor-actions">
          <button className="formula-button" disabled={!codeDraft.trim() || codeDraft === script} onClick={onDiscardCodeDraft} title="Descartar los cambios del editor y conservar el código actual" type="button">Descartar cambios</button>
          <button className="formula-button formula-button-primary" disabled={!codeDraft.trim() || codeDraft === script} onClick={onApplyCodeDraft} title="Aplicar el código editado al gráfico y a la fórmula" type="button">Aplicar al gráfico</button>
        </div>
        {codeIssue && <div className="formula-issue script-editor-error"><AlertCircle size={15} /><span>{codeIssue}</span></div>}
        <div className="script-type-line"><span>Resultado</span><strong>{expression?.valueType ?? "pendiente"}</strong></div>
        <div className="formula-issues" aria-live="polite">{issues.length ? issues.map((issue) => <div className="formula-issue" key={`${issue.path}-${issue.message}`}><AlertCircle size={15} /><span>{issue.message}</span><code>{issue.path}</code></div>) : <div className="formula-valid-note"><Check size={15} /> Los tipos de datos y las conexiones están listos.</div>}</div>
        <p className="script-note">Edita el código y pulsa <strong>Aplicar al gráfico</strong>. {representationMode === "code" ? "La conversión se intentará sin alterar la fuente completa." : "Solo se aceptan instrucciones que el editor visual puede representar."}</p>
        {expression && <FormulaTestValues expression={expression} fields={fields} onOpenJson={onOpenJson} onPayloadChange={onPayloadChange} payload={testPayload} />}
      </> : panelTab === "test" ? <>
        <p className="test-drawer-copy">Ingresa los datos de contexto en JSON y ejecuta la fórmula actual en el motor AviatorScript.</p>
        {issues.length > 0 && <section aria-labelledby="formula-test-observations-title" className="formula-test-observations">
          <div className="formula-test-observations-header"><div><strong id="formula-test-observations-title"><AlertCircle size={15} /> Observaciones antes de probar ({issues.length})</strong><span>Corrige las observaciones con severidad de error antes de ejecutar la fórmula.</span></div><button className="formula-button" onClick={() => onPanelTabChange("script")} title="Abrir AviatorScript para revisar las observaciones" type="button">Ver en AviatorScript</button></div>
          <div className="formula-test-observations-list">{issues.map((issue) => <div className={`formula-test-observation is-${issue.severity}`} key={`${issue.path}-${issue.message}`}><AlertCircle size={14} /><span>{issue.message}</span><code>{issue.path}</code></div>)}</div>
        </section>}
        <label className="test-payload-label" htmlFor="formula-test-payload">Datos de prueba (JSON)</label>
        <JsonCodeEditor ariaLabel="Datos de prueba en formato JSON" actions={<div className="test-drawer-actions"><button aria-label="Restaurar ejemplo" className="formula-icon-button json-action-button" onClick={onRestorePayload} title="Restaurar ejemplo" type="button"><RefreshCw size={16} /></button><button aria-label={testBusy ? "Ejecutando en el motor AviatorScript" : "Ejecutar en el motor AviatorScript"} className={`formula-icon-button json-action-button ${testBusy ? "is-busy" : ""}`} disabled={testBusy || !hasValidated || hasBlockingIssues} onClick={onExecuteTest} title={testBusy ? "Ejecutando en el motor AviatorScript" : "Ejecutar en el motor AviatorScript"} type="button"><FlaskConical size={16} /></button></div>} className="test-payload" copied={copiedCopyId === "test-payload"} id="formula-test-payload" onChange={onPayloadChange} onCopy={onCopyPayload} value={testPayload} />
        {testResult && <div aria-label="Ajustar alto del editor y el resultado" aria-orientation="horizontal" className="formula-test-resizer" onKeyDown={onTestPanelResizeKeyDown} onPointerDown={onTestPanelResizePointerDown} role="separator" tabIndex={0} title="Arrastra para ajustar el alto del editor y el resultado" />}
        {testError && <div className="test-result is-error"><AlertCircle size={18} /><span>{testError}</span></div>}
        {testResult && <div className="test-result is-success"><CheckCircle2 size={18} /><div><div className="test-result-heading"><strong>Resultado (JSON)</strong><button aria-label={copiedCopyId === "test-result-json" ? "Resultado JSON copiado" : "Copiar resultado JSON"} className={`formula-icon-button test-result-copy-button ${copiedCopyId === "test-result-json" ? "is-copied" : ""}`} onClick={onCopyResult} title={copiedCopyId === "test-result-json" ? "Copiado" : "Copiar resultado JSON"} type="button">{copiedCopyId === "test-result-json" ? <Check size={15} /> : <Clipboard size={15} />}</button></div><pre className="test-result-json">{JSON.stringify(testResult.value, null, 2) ?? "null"}</pre><small>{testResult.elapsed} ms · {testResult.engine}</small></div></div>}
      </> : <>
        <p className="test-drawer-copy">Solicitud lista para ejecutar la fórmula en el servicio AviatorScript.</p>
        <label className="test-payload-label" htmlFor="curl-command">Comando cURL</label>
        {curlCommand ? <CurlCodeViewer copied={copiedCopyId === "curl-command"} onCopy={onCopyCurl} value={curlCommand} /> : <div className="curl-code-placeholder">{calculationEndpointError ? "No se pudo obtener el endpoint configurado." : calculationEndpointLoading ? "Cargando el endpoint configurado..." : "No hay un endpoint configurado."}</div>}
        {calculationEndpoint && <p className="curl-note">Comando preparado para Windows PowerShell. Endpoint configurado: <code>{calculationEndpoint}</code></p>}
      </>}
    </div>
  </aside>;
}
