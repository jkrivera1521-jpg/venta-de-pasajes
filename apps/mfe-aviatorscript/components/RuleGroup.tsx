"use client";

import { ChevronDown, GitBranch, Plus, Trash2 } from "lucide-react";
import { RuleCondition } from "./RuleCondition";
import type { RuleConditionNode, RuleGroupNode, RuleNode, SchemaField, ValidationIssue } from "../lib/types";

type RuleGroupProps = {
  group: RuleGroupNode;
  fields: SchemaField[];
  isRoot?: boolean;
  issues: ValidationIssue[];
  onChangeGroup: (group: RuleGroupNode) => void;
  onChangeNode: (node: RuleNode) => void;
  onAddCondition: () => void;
  onAddGroup: () => void;
  onDeleteNode: (nodeId: string) => void;
};

function issueMessages(issues: ValidationIssue[], nodeId: string) {
  return issues.filter((issue) => issue.nodeId === nodeId).map((issue) => issue.message);
}

function groupTitle(group: RuleGroupNode, isRoot: boolean) {
  if (group.logicalOperator === "AND") return isRoot ? "Todas las condiciones" : "Todas estas condiciones";
  return isRoot ? "Al menos una condicion" : "Cualquiera de estas condiciones";
}

export function RuleGroup({
  group,
  fields,
  isRoot = false,
  issues,
  onChangeGroup,
  onChangeNode,
  onAddCondition,
  onAddGroup,
  onDeleteNode
}: RuleGroupProps) {
  return (
    <section className={`rule-group ${isRoot ? "rule-group-root" : ""}`}>
      <header className="rule-group-header">
        <div className="rule-group-heading">
          <span className="group-marker"><GitBranch size={16} /></span>
          <div>
            <strong>{groupTitle(group, isRoot)}</strong>
            <span>{group.logicalOperator === "AND" ? "Cada condicion debe cumplirse" : "Una condicion es suficiente"}</span>
          </div>
        </div>
        <div className="logical-toggle" role="group" aria-label="Operador logico">
          <button className={group.logicalOperator === "AND" ? "is-selected" : ""} onClick={() => onChangeGroup({ ...group, logicalOperator: "AND" })} type="button">AND</button>
          <button className={group.logicalOperator === "OR" ? "is-selected" : ""} onClick={() => onChangeGroup({ ...group, logicalOperator: "OR" })} type="button">OR</button>
        </div>
        {!isRoot && (
          <button className="icon-button danger-button" onClick={() => onDeleteNode(group.id)} title="Eliminar grupo" type="button">
            <Trash2 size={16} />
          </button>
        )}
      </header>

      <div className="rule-group-children">
        {group.children.map((child) => child.kind === "condition" ? (
          <RuleCondition
            condition={child as RuleConditionNode}
            fields={fields}
            issueMessages={issueMessages(issues, child.id)}
            key={child.id}
            onChange={onChangeNode}
            onDelete={() => onDeleteNode(child.id)}
          />
        ) : (
          <RuleGroup
            fields={fields}
            group={child as RuleGroupNode}
            isRoot={false}
            issues={issues}
            key={child.id}
            onAddCondition={onAddCondition}
            onAddGroup={onAddGroup}
            onChangeGroup={onChangeNode as (group: RuleGroupNode) => void}
            onChangeNode={onChangeNode}
            onDeleteNode={onDeleteNode}
          />
        ))}
        {group.children.length === 0 && <div className="group-empty">Este grupo esta vacio. Agrega una condicion o un subgrupo.</div>}
      </div>

      <footer className="rule-group-actions">
        <button className="text-button" onClick={onAddCondition} type="button"><Plus size={15} /> Agregar condicion</button>
        <button className="text-button muted" onClick={onAddGroup} type="button"><Plus size={15} /> Agregar subgrupo</button>
        <span className="group-count"><ChevronDown size={14} /> {group.children.length} {group.children.length === 1 ? "bloque" : "bloques"}</span>
      </footer>
    </section>
  );
}
