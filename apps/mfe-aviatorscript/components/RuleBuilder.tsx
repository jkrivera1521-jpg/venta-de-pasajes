"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, FileCheck2, FlaskConical, GitBranch, PanelRight, Save, Sparkles, Workflow } from "lucide-react";
import type { DragEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { getRuleSchema, validateRule } from "../lib/api";
import {
  appendChildToGroup,
  createCondition,
  createGroup,
  createInitialRule,
  DEFAULT_SCHEMA,
  removeNodeById,
  updateNodeById,
  validateRuleDocument
} from "../lib/rules";
import type { RuleDocument, RuleGroupNode, RuleNode, SchemaField, ValidationIssue } from "../lib/types";
import { RuleGroup } from "./RuleGroup";
import { SandboxTester } from "./SandboxTester";
import { SchemaSidebar } from "./SchemaSidebar";

export type RuleBuilderMFEProps = {
  schema?: SchemaField[];
  onSave?: (rule: RuleDocument) => void | Promise<void>;
};

function findIssuesForNode(issues: ValidationIssue[], nodeId: string) {
  return issues.filter((issue) => issue.nodeId === nodeId);
}

export function RuleBuilder({ schema: providedSchema, onSave }: RuleBuilderMFEProps = {}) {
  const schemaQuery = useQuery({
    enabled: !providedSchema,
    initialData: providedSchema?.length ? providedSchema : undefined,
    queryFn: getRuleSchema,
    queryKey: ["aviatorscript", "schema"]
  });
  const fields = schemaQuery.data?.length ? schemaQuery.data : providedSchema?.length ? providedSchema : DEFAULT_SCHEMA;
  const [rule, setRule] = useState<RuleDocument>(() => createInitialRule(fields));
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const localIssues = useMemo(() => validateRuleDocument(rule, fields), [fields, rule]);
  const validationMutation = useMutation({ mutationFn: () => validateRule(rule) });

  useEffect(() => {
    function closePanels(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSchemaOpen(false);
        setSandboxOpen(false);
      }
    }

    window.addEventListener("keydown", closePanels);
    return () => window.removeEventListener("keydown", closePanels);
  }, []);

  useEffect(() => {
    const lockPage = sandboxOpen || (schemaOpen && window.matchMedia("(max-width: 760px)").matches);
    document.body.classList.toggle("panel-is-open", lockPage);
    return () => document.body.classList.remove("panel-is-open");
  }, [sandboxOpen, schemaOpen]);

  function changeNode(node: RuleNode) {
    setRule((current) => ({ ...current, root: updateNodeById(current.root, node.id, () => node) }));
    setSaveMessage(null);
  }

  function changeGroup(group: RuleGroupNode) {
    setRule((current) => ({ ...current, root: updateNodeById(current.root, group.id, () => group) }));
    setSaveMessage(null);
  }

  function addCondition(groupId: string) {
    setRule((current) => ({ ...current, root: appendChildToGroup(current.root, groupId, createCondition()) }));
    setSaveMessage(null);
  }

  function addSubgroup(groupId: string) {
    setRule((current) => ({ ...current, root: appendChildToGroup(current.root, groupId, createGroup("AND")) }));
    setSaveMessage(null);
  }

  function deleteNode(nodeId: string) {
    setRule((current) => ({ ...current, root: removeNodeById(current.root, nodeId) }));
    setSaveMessage(null);
  }

  function insertField(field: SchemaField) {
    setRule((current) => ({
      ...current,
      root: appendChildToGroup(current.root, current.root.id, createCondition(field.key))
    }));
    setSchemaOpen(false);
    setSaveMessage(null);
  }

  async function validateCurrentRule() {
    setSaveMessage(null);
    await validationMutation.mutateAsync();
  }

  async function saveCurrentRule() {
    setSaveMessage(null);
    const validation = await validationMutation.mutateAsync();
    if (!validation.valid) {
      setSaveMessage("Corrige los campos marcados antes de guardar la regla.");
      return;
    }
    await onSave?.(rule);
    setSaveMessage("Regla lista para guardar en AviatorScript.");
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const key = event.dataTransfer.getData("application/x-rule-field");
    const field = fields.find((item) => item.key === key);
    if (field) insertField(field);
  }

  const serverIssues = validationMutation.data?.issues ?? [];
  const visibleIssues = localIssues.length > 0 ? localIssues : serverIssues;
  const isValid = localIssues.length === 0 && validationMutation.data?.valid === true;

  return (
    <div className="rules-app">
      <header className="rules-toolbar">
        <div className="rules-title-block">
          <div className="rules-title-icon"><Workflow size={21} /></div>
          <div>
            <span className="eyebrow"><Sparkles size={14} /> AVIATORSCRIPT</span>
            <h1>Constructor visual de reglas</h1>
            <p>Define condiciones de negocio sin escribir codigo.</p>
          </div>
        </div>
        <div className="rules-toolbar-actions">
          <span className={`connection-badge ${schemaQuery.isError ? "is-warning" : ""}`}>
            <span className="status-dot" /> {schemaQuery.isError ? "Esquema local" : "Esquema conectado"}
          </span>
          <button className="secondary-button" onClick={() => { setSandboxOpen(false); setSchemaOpen(true); }} type="button"><PanelRight size={16} /> Variables</button>
          <button className="secondary-button" onClick={() => { setSchemaOpen(false); setSandboxOpen(true); }} type="button"><FlaskConical size={16} /> Probar</button>
          <button className="secondary-button" disabled={validationMutation.isPending} onClick={validateCurrentRule} type="button"><FileCheck2 size={16} /> {validationMutation.isPending ? "Validando..." : "Validar regla"}</button>
          <button className="primary-button" disabled={validationMutation.isPending} onClick={saveCurrentRule} type="button"><Save size={16} /> Guardar regla</button>
        </div>
      </header>

      <div className="rules-status-line">
        <div className={`validation-badge ${isValid ? "is-valid" : visibleIssues.length > 0 ? "is-invalid" : "is-pending"}`}>
          {isValid ? <CheckCircle2 size={16} /> : <FileCheck2 size={16} />}
          {isValid ? "Sintaxis valida" : visibleIssues.length > 0 ? "Revisa la regla" : "Regla sin validar"}
        </div>
        <span className="status-help">{visibleIssues.length > 0 ? `${visibleIssues.length} observacion${visibleIssues.length === 1 ? "" : "es"} pendiente${visibleIssues.length === 1 ? "" : "s"}.` : "Usa Validar regla para comprobar la compilacion en AviatorScript."}</span>
        {saveMessage && <span className="save-message">{saveMessage}</span>}
      </div>

      <div className="rules-layout">
        <main className="builder-workspace">
          <div className="workspace-heading">
            <div>
              <span className="eyebrow">REGLA SIN TITULO</span>
              <h2>Cuando se cumpla...</h2>
            </div>
            <span className="rule-version">AST v1</span>
          </div>
          <div className="drop-hint" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
            <GitBranch size={17} /> Arrastra una variable desde el esquema para agregar una condicion
          </div>
          <RuleGroup
            fields={fields}
            group={rule.root}
            isRoot
            issues={visibleIssues}
            onAddCondition={() => addCondition(rule.root.id)}
            onAddGroup={() => addSubgroup(rule.root.id)}
            onChangeGroup={changeGroup}
            onChangeNode={changeNode}
            onDeleteNode={deleteNode}
          />
          {visibleIssues.length > 0 && (
            <section className="validation-summary">
              <div className="validation-summary-heading"><FileCheck2 size={17} /><strong>Detalles de validacion</strong></div>
              {visibleIssues.map((issue) => <div className="validation-summary-item" key={`${issue.nodeId}-${issue.path}-${issue.message}`}>{issue.message}<code>{issue.path}</code></div>)}
            </section>
          )}
        </main>
        {schemaOpen && <button aria-label="Cerrar panel de variables" className="panel-backdrop schema-backdrop" onClick={() => setSchemaOpen(false)} type="button" />}
        <SchemaSidebar fields={fields} onClose={() => setSchemaOpen(false)} onInsert={insertField} open={schemaOpen} />
      </div>

      {!sandboxOpen && <button aria-label="Probar regla" className="sandbox-launcher" onClick={() => { setSchemaOpen(false); setSandboxOpen(true); }} title="Probar regla" type="button"><FlaskConical size={17} /> Probar regla</button>}
      {sandboxOpen && <button aria-label="Cerrar sandbox" className="panel-backdrop sandbox-backdrop" onClick={() => setSandboxOpen(false)} type="button" />}
      <SandboxTester onClose={() => setSandboxOpen(false)} open={sandboxOpen} rule={rule} />
    </div>
  );
}

export const RuleBuilderMFE = RuleBuilder;
