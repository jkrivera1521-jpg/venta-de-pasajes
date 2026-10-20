"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Blocks, Check, CheckCircle2, Clipboard, FilePlus2, FolderOpen, FlaskConical, GitBranch, Maximize2, Minimize2, RefreshCw, Save } from "lucide-react";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceSvg } from "blockly";
import { getFormulaTemplates, getRuleSchema, visualizeAviatorSource } from "../lib/api";
import { buildFormulaFromWorkspace, compactPayrollGraph, createFormulaToolbox, createStarterFormula, decomposePayrollGraph, fitNestedBlockContainers, getUserVariableFields, isDecomposedPayrollWorkspaceState, loadFormulaExpression, refreshPayrollFormulaGraph, registerAviatorBlocks } from "../lib/blockly-editor";
import { compileFormula, evaluateFormula, type FormulaDocument, type FormulaIssue, type FormulaRoot, type FormulaTemplate, validateFormula } from "../lib/formula";
import { parseAviatorSource, parseAviatorTemplate, schemaForTemplate } from "../lib/formula-template";
import { parseAdvancedPayrollConfig, payrollProgramFromConfig } from "../lib/payroll-formula";
import { createFormulaTestPayload } from "../lib/test-payload";
import { DEFAULT_SCHEMA } from "../lib/rules";
import type { SchemaField } from "../lib/types";
import { buildLocalAviatorFlow, type AviatorFlowGraph, type AviatorFlowNode } from "../lib/visualization";
import { AviatorVisualizationWorkspace } from "./AviatorVisualizationWorkspace";
import { FormulaTestValues } from "./FormulaTestValues";

const STORAGE_KEY = "aviatorscript-formulas-v1";
const INITIAL_TEST_PAYLOAD = "{}";

type SavedFormula = Pick<FormulaDocument, "name" | "updatedAt" | "expression" | "workspace">;
type MobileTab = "blocks" | "script";
type PanelTab = "script" | "test";
type MaximizedPanel = "workspace" | "script";
type ViewMode = "builder" | "visualizer";

export type VisualFormulaBuilderProps = {
  schema?: SchemaField[];
  onSave?: (formula: FormulaDocument) => void | Promise<void>;
};

function combineIssues(builtIssues: FormulaIssue[], expression?: FormulaRoot, fields: SchemaField[] = []) {
  return expression ? [...builtIssues, ...validateFormula(expression, fields)] : builtIssues;
}

function makeFormulaDocument(name: string, expression: FormulaRoot, workspace: unknown): FormulaDocument {
  return {
    format: "aviatorscript-formula",
    version: 1,
    name: name.trim() || "Formula sin titulo",
    expression,
    workspace,
    updatedAt: new Date().toISOString()
  };
}

function saveToBrowser(formula: FormulaDocument) {
  let existing: SavedFormula[] = [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (Array.isArray(parsed)) existing = parsed as SavedFormula[];
  } catch {
    existing = [];
  }
  const saved = [formula, ...existing.filter((item) => item.name !== formula.name)].slice(0, 25);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

function downloadFormula(formula: FormulaDocument) {
  const file = new Blob([JSON.stringify(formula, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${formula.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "formula"}.aviatorscript.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function VisualFormulaBuilder({ schema: providedSchema, onSave }: VisualFormulaBuilderProps = {}) {
  const schemaQuery = useQuery({
    enabled: !providedSchema,
    initialData: providedSchema?.length ? providedSchema : undefined,
    queryFn: getRuleSchema,
    queryKey: ["aviatorscript", "schema"]
  });
  const templatesQuery = useQuery({
    queryFn: getFormulaTemplates,
    queryKey: ["aviatorscript", "formula-templates"],
    refetchOnWindowFocus: false,
    staleTime: 30_000
  });
  const baseFields = schemaQuery.data?.length ? schemaQuery.data : providedSchema?.length ? providedSchema : DEFAULT_SCHEMA;
  const [templateFields, setTemplateFields] = useState<SchemaField[] | null>(null);
  const [userFields, setUserFields] = useState<SchemaField[]>([]);
  const fields = useMemo(() => {
    const known = new Set((templateFields ?? baseFields).map((field) => field.key));
    return [...(templateFields ?? baseFields), ...userFields.filter((field) => !known.has(field.key))];
  }, [baseFields, templateFields, userFields]);
  const fieldsKey = useMemo(() => fields.map((field) => `${field.key}:${field.type}`).join("|"), [fields]);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<WorkspaceSvg | null>(null);
  const workspaceMountTokenRef = useRef(0);
  const nestedFitFrameRef = useRef<number | null>(null);
  const blocklyRef = useRef<typeof import("blockly") | null>(null);
  const fieldsRef = useRef(fields);
  const staticFieldsRef = useRef<SchemaField[]>(templateFields ?? baseFields);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [expression, setExpression] = useState<FormulaRoot | null>(null);
  const [script, setScript] = useState("");
  const [codeDraft, setCodeDraft] = useState("");
  const [codeIssue, setCodeIssue] = useState("");
  const [issues, setIssues] = useState<FormulaIssue[]>([]);
  const [hasValidated, setHasValidated] = useState(false);
  const [formulaName, setFormulaName] = useState("Regla de negocio");
  const [saveMessage, setSaveMessage] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateMessage, setTemplateMessage] = useState("");
  const [mobileTab, setMobileTab] = useState<MobileTab>("blocks");
  const [panelTab, setPanelTab] = useState<PanelTab>("script");
  const [testPayload, setTestPayload] = useState(INITIAL_TEST_PAYLOAD);
  const [testResult, setTestResult] = useState<{ value: unknown; elapsed: number } | null>(null);
  const [testError, setTestError] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [blocklyReady, setBlocklyReady] = useState(false);
  const [payrollLayout, setPayrollLayout] = useState<"compact" | "decomposed">("compact");
  const [maximizedPanel, setMaximizedPanel] = useState<MaximizedPanel | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("builder");
  const [visualGraph, setVisualGraph] = useState<AviatorFlowGraph | null>(null);
  const [visualError, setVisualError] = useState("");
  const [visualLoading, setVisualLoading] = useState(false);
  const [selectedFlowNodeId, setSelectedFlowNodeId] = useState<string>();
  const maximizeReturnFocusRef = useRef<HTMLElement | null>(null);
  const selectedTemplate = templatesQuery.data?.find((item) => `${item.codigo}::${item.version}` === selectedTemplateId);

  fieldsRef.current = fields;
  staticFieldsRef.current = templateFields ?? baseFields;

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (viewMode !== "visualizer") return;
    const source = codeDraft.trim();
    if (!source) {
      setVisualGraph(null);
      setVisualError("No hay codigo para analizar.");
      setVisualLoading(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      let localGraph: AviatorFlowGraph;
      try {
        const parsed = parseAviatorSource(source, fieldsRef.current);
        localGraph = buildLocalAviatorFlow(source, parsed);
        if (active) {
          setVisualGraph(localGraph);
          setVisualError("");
          setSelectedFlowNodeId(undefined);
        }
      } catch (error) {
        if (active) {
          setVisualGraph(null);
          setVisualError(error instanceof Error ? error.message : "No se pudo analizar el codigo AviatorScript.");
          setSelectedFlowNodeId(undefined);
        }
        return;
      }

      setVisualLoading(true);
      void visualizeAviatorSource(source).then((remoteGraph) => {
        if (!active || !remoteGraph?.nodes?.length) return;
        setVisualGraph(remoteGraph);
        setVisualError("");
      }).catch(() => {
        if (active) setVisualError("Analisis local activo. El servicio remoto no esta disponible.");
      }).finally(() => {
        if (active) setVisualLoading(false);
      });
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [codeDraft, fieldsKey, viewMode]);

  useEffect(() => {
    if (!maximizedPanel) {
      maximizeReturnFocusRef.current?.focus();
      maximizeReturnFocusRef.current = null;
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-maximized-panel="${maximizedPanel}"]`)?.focus();
    });

    function containDialogFocus(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMaximizedPanel(null);
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = document.querySelector<HTMLElement>(`[data-maximized-panel="${maximizedPanel}"]`);
      if (!dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", containDialogFocus);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", containDialogFocus);
      document.body.style.overflow = previousOverflow;
    };
  }, [maximizedPanel]);

  function toggleMaximizedPanel(panel: MaximizedPanel) {
    if (maximizedPanel === panel) {
      setMaximizedPanel(null);
      return;
    }
    maximizeReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMaximizedPanel(panel);
  }

  const refreshFormula = useCallback(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const Blockly = blocklyRef.current;
    if (Blockly) {
      refreshPayrollFormulaGraph(Blockly, workspace);
      if (nestedFitFrameRef.current !== null) window.cancelAnimationFrame(nestedFitFrameRef.current);
      nestedFitFrameRef.current = window.requestAnimationFrame(() => {
        nestedFitFrameRef.current = null;
        if (workspaceRef.current === workspace && blocklyRef.current === Blockly) fitNestedBlockContainers(Blockly, workspace);
      });
    }
    const nextUserFields = getUserVariableFields(workspace);
    const staticFields = staticFieldsRef.current;
    const known = new Set(staticFields.map((field) => field.key));
    const nextFields = [...staticFields, ...nextUserFields.filter((field) => !known.has(field.key))];
    fieldsRef.current = nextFields;
    setUserFields((current) => JSON.stringify(current) === JSON.stringify(nextUserFields) ? current : nextUserFields);
    const built = buildFormulaFromWorkspace(workspace, nextFields);
    const nextScript = built.expression ? compileFormula(built.expression) : "";
    const nextIssues = combineIssues(built.issues, built.expression, nextFields);
    setExpression(built.expression ?? null);
    setScript(nextScript);
    setCodeDraft(nextScript);
    setCodeIssue("");
    if (built.expression) {
      setTestPayload((current) => createFormulaTestPayload(built.expression!, nextFields, current));
    }
    setIssues(nextIssues);
    setHasValidated(false);
    setTestResult(null);
    setTestError("");
  }, []);

  const mountWorkspace = useCallback(async (initialState?: unknown, isCurrent: () => boolean = () => true) => {
    const host = hostRef.current;
    if (!host) return;
    const mountToken = ++workspaceMountTokenRef.current;
    const [Blockly, spanish] = await Promise.all([import("blockly"), import("blockly/msg/es")]);
    if (!isCurrent() || hostRef.current !== host || mountToken !== workspaceMountTokenRef.current) return;
    workspaceRef.current?.dispose();
    workspaceRef.current = null;
    host.replaceChildren();
    Blockly.setLocale(spanish as unknown as Record<string, string>);
    const mobile = window.matchMedia("(max-width: 760px)").matches;
    registerAviatorBlocks(Blockly, fieldsRef, mobile);
    blocklyRef.current = Blockly;
    const workspace = Blockly.inject(host, {
      toolbox: createFormulaToolbox(fieldsRef.current),
      toolboxPosition: "start",
      horizontalLayout: mobile,
      renderer: "zelos",
      grid: { spacing: 24, length: 3, colour: "#dfe7ef", snap: true },
      move: { drag: true, scrollbars: true, wheel: true },
      scrollbars: true,
      trashcan: true,
      zoom: { controls: true, wheel: true, pinch: true, startScale: 0.9, maxScale: 1.4, minScale: 0.55 }
    });
    workspaceRef.current = workspace;
    if (initialState) {
      Blockly.serialization.workspaces.load(initialState as Record<string, unknown>, workspace);
      if (!workspace.getBlocksByType("aviator_formula", true).length && !workspace.getBlocksByType("aviator_program", true).length) createStarterFormula(Blockly, workspace, fieldsRef.current);
    } else {
      createStarterFormula(Blockly, workspace, fieldsRef.current);
    }
    workspace.addChangeListener(refreshFormula);
    Blockly.svgResize(workspace);
    setBlocklyReady(true);
    refreshFormula();
  }, [refreshFormula]);

  useEffect(() => {
    let cancelled = false;
    let resizeTimer: number | undefined;
    let resizeFrame = 0;
    let previousMobile = window.matchMedia("(max-width: 760px)").matches;
    void mountWorkspace(undefined, () => !cancelled);

    const resizeObserver = new ResizeObserver(() => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        const workspace = workspaceRef.current;
        const Blockly = blocklyRef.current;
        if (workspace && Blockly) Blockly.svgResize(workspace);
      });
    });
    if (hostRef.current) resizeObserver.observe(hostRef.current);

    function handleResize() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(async () => {
        const workspace = workspaceRef.current;
        const Blockly = blocklyRef.current;
        if (!workspace || !Blockly) return;
        const mobile = window.matchMedia("(max-width: 760px)").matches;
        if (mobile !== previousMobile && hostRef.current) {
          previousMobile = mobile;
          const state = Blockly.serialization.workspaces.save(workspace);
          workspace.dispose();
          workspaceRef.current = null;
          await mountWorkspace(state);
        } else {
          Blockly.svgResize(workspace);
        }
      }, 140);
    }

    window.addEventListener("resize", handleResize);
    return () => {
      cancelled = true;
      window.clearTimeout(resizeTimer);
      window.cancelAnimationFrame(resizeFrame);
      if (nestedFitFrameRef.current !== null) window.cancelAnimationFrame(nestedFitFrameRef.current);
      nestedFitFrameRef.current = null;
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      workspaceRef.current?.dispose();
      workspaceRef.current = null;
    };
  }, [mountWorkspace]);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace || !blocklyRef.current) return;
    workspace.updateToolbox(createFormulaToolbox(fields));
    workspace.getAllBlocks(false).filter((block) => block.type === "aviator_context_variable").forEach((block) => {
      const selectedKey = block.getFieldValue("FIELD");
      if (!fields.some((field) => field.key === selectedKey) && fields[0]) block.setFieldValue(fields[0].key, "FIELD");
    });
    refreshFormula();
  }, [fieldsKey, fields, refreshFormula]);

  useEffect(() => {
    const workspace = workspaceRef.current;
    const Blockly = blocklyRef.current;
    if (workspace && Blockly) requestAnimationFrame(() => Blockly.svgResize(workspace));
  }, [mobileTab]);

  function startNewFormula() {
    const Blockly = blocklyRef.current;
    const workspace = workspaceRef.current;
    if (!Blockly || !workspace) return;
    workspace.clear();
    fieldsRef.current = baseFields;
    staticFieldsRef.current = baseFields;
    setTemplateFields(null);
    setUserFields([]);
    createStarterFormula(Blockly, workspace, fieldsRef.current);
    setFormulaName("Nueva formula");
    setSaveMessage("");
    setSelectedTemplateId("");
    setTemplateMessage("");
    setPayrollLayout("compact");
    setMobileTab("blocks");
    setPanelTab("script");
    refreshFormula();
  }

  function useFormulaTemplate(template: FormulaTemplate) {
    const Blockly = blocklyRef.current;
    const workspace = workspaceRef.current;
    if (!Blockly || !workspace) return;
    const previousWorkspace = Blockly.serialization.workspaces.save(workspace);
    const previousFields = fieldsRef.current;
    const previousTemplateFields = templateFields;
    const previousUserFields = userFields;
    try {
      const payrollConfig = parseAdvancedPayrollConfig(template.expresion);
      const parsed = payrollConfig
        ? payrollProgramFromConfig(payrollConfig)
        : parseAviatorTemplate(template.expresion, baseFields);
      const expandedFields = schemaForTemplate(parsed, baseFields);
      fieldsRef.current = expandedFields;
      staticFieldsRef.current = expandedFields;
      setTemplateFields(expandedFields);
      setUserFields([]);
      loadFormulaExpression(Blockly, workspace, parsed);
      const shouldDecomposePayroll = parsed.kind === "payroll";
      setFormulaName(`Nueva - ${template.nombre}`.slice(0, 100));
      setSelectedTemplateId(`${template.codigo}::${template.version}`);
      setTemplateMessage(`Plantilla ${template.codigo} v${template.version} cargada como una formula nueva. La formula guardada no se modifica.`);
      setPayrollLayout(shouldDecomposePayroll ? "decomposed" : "compact");
      setTestPayload(createFormulaTestPayload(parsed, expandedFields, undefined, false));
      setTestResult(null);
      setTestError("");
      setSaveMessage("");
      setCodeIssue("");
      setHasValidated(false);
      setMobileTab("blocks");
      setPanelTab("script");
      refreshFormula();
    } catch (error) {
      fieldsRef.current = previousFields;
      staticFieldsRef.current = previousTemplateFields ?? baseFields;
      setTemplateFields(previousTemplateFields);
      setUserFields(previousUserFields);
      workspace.clear();
      Blockly.serialization.workspaces.load(previousWorkspace as Record<string, unknown>, workspace);
      refreshFormula();
      setTemplateMessage(error instanceof Error
        ? `No se pudo convertir esta formula en bloques: ${error.message}`
        : "No se pudo convertir esta formula en bloques.");
    }
  }

  async function saveFormula() {
    const workspace = workspaceRef.current;
    if (!workspace || !expression) return;
    const built = buildFormulaFromWorkspace(workspace, fieldsRef.current);
    const currentIssues = combineIssues(built.issues, built.expression, fieldsRef.current);
    setIssues(currentIssues);
    setHasValidated(true);
    if (currentIssues.length || !built.expression) {
      setSaveMessage("Completa los bloques marcados antes de guardar.");
      return;
    }
    const Blockly = blocklyRef.current;
    if (!Blockly) return;
    const formula = makeFormulaDocument(formulaName, built.expression, Blockly.serialization.workspaces.save(workspace));
    if (onSave) {
      await onSave(formula);
      setSaveMessage("Formula enviada al proceso de guardado.");
    } else {
      saveToBrowser(formula);
      downloadFormula(formula);
      setSaveMessage("Guardada en este navegador y descargada como archivo JSON.");
    }
  }

  async function openFormula(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    const workspace = workspaceRef.current;
    const Blockly = blocklyRef.current;
    event.target.value = "";
    if (!selectedFile || !workspace || !Blockly) return;
    if (selectedFile.size > 1024 * 1024) {
      setSaveMessage("El archivo supera el limite de 1 MB.");
      return;
    }
    try {
      const parsed = JSON.parse(await selectedFile.text()) as Partial<FormulaDocument>;
      if (parsed.format !== "aviatorscript-formula" || parsed.version !== 1 || !parsed.workspace || !parsed.expression || typeof parsed.name !== "string") {
        throw new Error("El archivo no tiene el formato de formula esperado.");
      }
      const openedFields = schemaForTemplate(parsed.expression, baseFields);
      fieldsRef.current = openedFields;
      staticFieldsRef.current = openedFields;
      setTemplateFields(openedFields.length === baseFields.length ? null : openedFields);
      setUserFields([]);
      const openedExpression = parsed.expression.kind === "payroll"
        ? payrollProgramFromConfig(parsed.expression.config)
        : parsed.expression;
      if (parsed.expression.kind === "payroll" && isDecomposedPayrollWorkspaceState(parsed.workspace)) {
        workspace.clear();
        Blockly.serialization.workspaces.load(parsed.workspace as Record<string, unknown>, workspace);
        setPayrollLayout("decomposed");
      } else if (parsed.expression.kind === "payroll") {
        loadFormulaExpression(Blockly, workspace, openedExpression);
        setPayrollLayout("compact");
      } else {
        workspace.clear();
        Blockly.serialization.workspaces.load(parsed.workspace as Record<string, unknown>, workspace);
        setPayrollLayout("compact");
      }
      setFormulaName(parsed.name);
      setSelectedTemplateId("");
      setTemplateMessage("");
      setSaveMessage("Formula abierta correctamente.");
      setPanelTab("script");
      setTestPayload(createFormulaTestPayload(openedExpression, openedFields, undefined, false));
      refreshFormula();
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "No se pudo abrir el archivo.");
    }
  }

  function validateCurrentFormula() {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const built = buildFormulaFromWorkspace(workspace, fieldsRef.current);
    const currentIssues = combineIssues(built.issues, built.expression, fieldsRef.current);
    setExpression(built.expression ?? null);
    const nextScript = built.expression ? compileFormula(built.expression) : "";
    setScript(nextScript);
    setCodeDraft(nextScript);
    setCodeIssue("");
    setIssues(currentIssues);
    setHasValidated(true);
    setSaveMessage(currentIssues.length ? "Revisa las observaciones antes de usar la formula." : "Estructura visual y tipos de datos validos.");
  }

  async function copyScript() {
    if (!codeDraft) return;
    await navigator.clipboard.writeText(codeDraft);
    setSaveMessage("Formula copiada al portapapeles.");
  }

  function applyCodeDraft() {
    const Blockly = blocklyRef.current;
    const workspace = workspaceRef.current;
    if (!Blockly || !workspace) return;
    try {
      const parsed = parseAviatorSource(codeDraft, fieldsRef.current);
      const parsedFields = schemaForTemplate(parsed, baseFields);
      const parsedIssues = combineIssues([], parsed, parsedFields);
      fieldsRef.current = parsedFields;
      staticFieldsRef.current = parsedFields;
      setTemplateFields(parsedFields.length === baseFields.length ? null : parsedFields);
      setUserFields([]);
      workspace.clear();
      loadFormulaExpression(Blockly, workspace, parsed);
      setPayrollLayout("compact");
      setSelectedTemplateId("");
      setTemplateMessage("");
      setCodeIssue("");
      setIssues(parsedIssues);
      setHasValidated(false);
      setTestResult(null);
      setTestError("");
      setSaveMessage(parsedIssues.length ? "Codigo cargado, pero debes corregir las observaciones visuales." : "Codigo aplicado al lienzo visual.");
      setMobileTab("blocks");
    } catch (error) {
      setCodeIssue(error instanceof Error ? error.message : "No se pudo interpretar el codigo AviatorScript.");
      setSaveMessage("Corrige el codigo y vuelve a aplicarlo al lienzo.");
    }
  }

  function discardCodeDraft() {
    setCodeDraft(script);
    setCodeIssue("");
    setSaveMessage("Cambios de codigo descartados.");
  }

  function decomposeCurrentFormula() {
    const Blockly = blocklyRef.current;
    const workspace = workspaceRef.current;
    if (!Blockly || !workspace || expression?.kind !== "payroll") return;
    if (decomposePayrollGraph(Blockly, workspace)) {
      setPayrollLayout("decomposed");
      setSaveMessage("Formula descompuesta: cada parametro, validacion y sentencia se puede mover y revisar por separado.");
      refreshFormula();
    }
  }

  function compactCurrentFormula() {
    const Blockly = blocklyRef.current;
    const workspace = workspaceRef.current;
    if (!Blockly || !workspace || expression?.kind !== "payroll") return;
    if (compactPayrollGraph(Blockly, workspace)) {
      setPayrollLayout("compact");
      setSaveMessage("Formula compactada en un solo bloque de nomina avanzada.");
      refreshFormula();
    }
  }

  async function executeTest() {
    if (!expression || issues.length) return;
    setTestBusy(true);
    setTestError("");
    setTestResult(null);
    const startedAt = performance.now();
    try {
      const payload = JSON.parse(testPayload) as unknown;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("El JSON debe ser un objeto con los datos de contexto.");
      const value = evaluateFormula(expression, payload);
      setTestResult({ value, elapsed: Number((performance.now() - startedAt).toFixed(2)) });
    } catch (error) {
      setTestError(error instanceof Error ? error.message : "No se pudo ejecutar la prueba.");
    } finally {
      setTestBusy(false);
    }
  }

  function openTestTab() {
    setPanelTab("test");
    setMobileTab("script");
    setSaveMessage("");
  }

  function openVisualization() {
    setViewMode("visualizer");
    setSelectedFlowNodeId(undefined);
    setSaveMessage("");
  }

  function applyVisualCode() {
    applyCodeDraft();
    setViewMode("builder");
  }

  function selectFlowNode(node: AviatorFlowNode | undefined) {
    setSelectedFlowNodeId(node?.id);
  }

  function selectRelatedFlowNode(nodeId: string) {
    setSelectedFlowNodeId(nodeId);
  }

  const validationLabel = issues.length
    ? `${issues.length} observacion${issues.length === 1 ? "" : "es"}`
    : hasValidated ? "Formula valida" : "Edicion en curso";
  const validationState = issues.length ? "is-invalid" : hasValidated ? "is-valid" : "is-pending";

  return (
    <main className="formula-app">
      <header className="formula-toolbar">
        <div className="formula-brand">
          <div className="formula-brand-mark" aria-hidden="true">ƒx</div>
          <div>
            <span className="formula-eyebrow">AVIATORSCRIPT STUDIO</span>
            <h1>Constructor visual de formulas</h1>
            <p>Arma la logica conectando bloques; la expresion se genera por ti.</p>
          </div>
        </div>
        <div className="formula-actions">
          <span className={`formula-connection ${schemaQuery.isError ? "is-warning" : ""}`}><span />{schemaQuery.isError ? "Esquema local" : `${fields.length} variables`}</span>
          {expression?.kind === "payroll" && payrollLayout === "compact" && <button className="formula-button" onClick={decomposeCurrentFormula} type="button"><Blocks size={16} /> Descomponer</button>}
          {expression?.kind === "payroll" && payrollLayout === "decomposed" && <button className="formula-button" onClick={compactCurrentFormula} type="button"><Blocks size={16} /> Compactar</button>}
          <button className={`formula-button ${viewMode === "visualizer" ? "formula-button-primary" : ""}`} onClick={viewMode === "builder" ? openVisualization : () => setViewMode("builder")} type="button"><GitBranch size={16} /> {viewMode === "builder" ? "Visualizar flujo" : "Constructor"}</button>
          <button className="formula-button" onClick={startNewFormula} type="button"><FilePlus2 size={16} /> Nueva</button>
          <button className="formula-button" onClick={() => fileInputRef.current?.click()} type="button"><FolderOpen size={16} /> Abrir</button>
          <input accept="application/json,.json" className="visually-hidden" onChange={openFormula} ref={fileInputRef} type="file" />
          <button className="formula-button" disabled={!isHydrated || !blocklyReady} onClick={() => void saveFormula()} type="button"><Save size={16} /> Guardar</button>
          <button className="formula-button formula-button-primary" disabled={!isHydrated || !blocklyReady} onClick={validateCurrentFormula} type="button"><CheckCircle2 size={16} /> Validar</button>
          <button className="formula-button formula-button-primary" disabled={!isHydrated || !blocklyReady} onClick={openTestTab} type="button"><FlaskConical size={16} /> Probar</button>
        </div>
      </header>

      <div className={`formula-status ${validationState}`}>
        <div className="formula-status-main">
          {issues.length ? <AlertCircle size={17} /> : hasValidated ? <CheckCircle2 size={17} /> : <span className="status-dot" />}
          <strong>{validationLabel}</strong>
        </div>
        <span>{issues[0]?.message ?? saveMessage ?? (hasValidated ? "La formula esta lista para probarse." : "Arrastra bloques al lienzo para construir la formula.")}</span>
      </div>

      <div className="formula-heading">
        <label htmlFor="formula-name">Nombre de la formula</label>
        <input id="formula-name" maxLength={100} onChange={(event) => { setFormulaName(event.target.value); setSaveMessage(""); }} value={formulaName} />
        <span className="formula-format">AST v1</span>
      </div>

      <section aria-label="Plantillas de formulas" className="formula-template-copy">
        <div className="formula-template-intro">
          <strong>Empezar desde una formula existente</strong>
          <span>Elige una formula guardada para cargar una copia editable como nueva.</span>
        </div>
        <div className="formula-template-controls">
          <select
            aria-label="Seleccionar formula como plantilla"
            disabled={templatesQuery.isLoading || !templatesQuery.data?.length}
            onChange={(event) => {
              const selected = templatesQuery.data?.find((item) => `${item.codigo}::${item.version}` === event.target.value);
              setSelectedTemplateId(event.target.value);
              setTemplateMessage("");
              if (selected) useFormulaTemplate(selected);
            }}
            value={selectedTemplateId}
          >
            <option value="">{templatesQuery.isLoading ? "Cargando formulas..." : "Selecciona una formula"}</option>
            {templatesQuery.data?.map((template) => (
              <option key={`${template.codigo}::${template.version}`} value={`${template.codigo}::${template.version}`}>
                {template.nombre} · {template.codigo} · v{template.version}{template.activa ? " · Activa" : " · Inactiva"}
              </option>
            ))}
          </select>
          <button
            aria-label="Actualizar catalogo de formulas"
            className="formula-icon-button"
            disabled={templatesQuery.isFetching}
            onClick={() => void templatesQuery.refetch()}
            title="Actualizar catalogo"
            type="button"
          ><RefreshCw size={16} /></button>
        </div>
        <p aria-live="polite" className={`formula-template-message ${templatesQuery.isError || templateMessage.startsWith("No se pudo") ? "is-error" : ""}`}>
          {templateMessage || (templatesQuery.isError
            ? "No se pudo conectar al catalogo. Puedes reintentar con el boton de actualizar."
            : templatesQuery.data?.length
              ? `${templatesQuery.data.length} formulas disponibles como plantillas de solo lectura.`
              : templatesQuery.isLoading ? "Consultando el catalogo de formulas..." : "No hay formulas guardadas para usar como plantilla.")}
        </p>
        {selectedTemplate && (
          <p className="formula-template-description">
            <strong>Qué realiza:</strong> {selectedTemplate.descripcion?.trim() || "No hay una descripción disponible para esta fórmula."}
          </p>
        )}
      </section>

      {viewMode === "builder" && <nav aria-label="Panel de trabajo" className="formula-mobile-tabs">
        <button aria-pressed={mobileTab === "blocks"} className={mobileTab === "blocks" ? "is-active" : ""} onClick={() => setMobileTab("blocks")} type="button">Bloques</button>
        <button aria-pressed={mobileTab === "script"} className={mobileTab === "script" ? "is-active" : ""} onClick={() => setMobileTab("script")} type="button">{panelTab === "test" ? "Probar regla" : "AviatorScript"}</button>
      </nav>}

      {viewMode === "visualizer" ? <AviatorVisualizationWorkspace
        error={visualError}
        graph={visualGraph}
        loading={visualLoading}
        onApplyToBuilder={applyVisualCode}
        onBackToBuilder={() => setViewMode("builder")}
        onRetry={() => {
          setViewMode("builder");
          window.requestAnimationFrame(() => setViewMode("visualizer"));
        }}
        onSelectNode={selectFlowNode}
        onSelectRelated={selectRelatedFlowNode}
        onSourceChange={(value) => { setCodeDraft(value); setCodeIssue(""); setSaveMessage(""); }}
        selectedNodeId={selectedFlowNodeId}
        source={codeDraft}
      /> : <section className="formula-workbench">
        {maximizedPanel && <button aria-label="Cerrar panel maximizado" className="panel-maximize-backdrop" onClick={() => setMaximizedPanel(null)} tabIndex={-1} type="button" />}
        <div
          aria-label={maximizedPanel === "workspace" ? "Lienzo de bloques ampliado" : undefined}
          aria-modal={maximizedPanel === "workspace" ? true : undefined}
          className={`workspace-panel ${mobileTab === "blocks" ? "mobile-visible" : "mobile-hidden"} ${maximizedPanel === "workspace" ? "panel-maximized" : ""}`}
          data-maximized-panel={maximizedPanel === "workspace" ? "workspace" : undefined}
          role={maximizedPanel === "workspace" ? "dialog" : undefined}
          tabIndex={maximizedPanel === "workspace" ? -1 : undefined}
        >
          <div aria-label="Lienzo de bloques" className="block-workspace" ref={hostRef} />
          <button
            aria-label={maximizedPanel === "workspace" ? "Restaurar lienzo" : "Maximizar lienzo"}
            className="formula-icon-button panel-maximize-button"
            onClick={() => toggleMaximizedPanel("workspace")}
            title={maximizedPanel === "workspace" ? "Restaurar lienzo" : "Maximizar lienzo"}
            type="button"
          >{maximizedPanel === "workspace" ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
        </div>
        <aside
          aria-label={maximizedPanel === "script" ? (panelTab === "script" ? "AviatorScript ampliado" : "Prueba de regla ampliada") : undefined}
          aria-modal={maximizedPanel === "script" ? true : undefined}
          className={`script-panel ${panelTab === "test" ? "is-testing" : ""} ${mobileTab === "script" ? "mobile-visible" : "mobile-hidden"} ${maximizedPanel === "script" ? "panel-maximized" : ""}`}
          data-maximized-panel={maximizedPanel === "script" ? "script" : undefined}
          role={maximizedPanel === "script" ? "dialog" : undefined}
          tabIndex={maximizedPanel === "script" ? -1 : undefined}
        >
          <div className="script-panel-header">
            <div>
              <span className="formula-eyebrow">{panelTab === "script" ? "EXPRESION GENERADA" : "SANDBOX LOCAL"}</span>
              <h2 id="script-panel-title">{panelTab === "script" ? "AviatorScript" : "Probar regla"}</h2>
            </div>
            <div className="script-panel-header-actions">
              {panelTab === "script" && <button aria-label="Copiar formula" className="formula-icon-button" disabled={!script} onClick={() => void copyScript()} title="Copiar formula" type="button"><Clipboard size={17} /></button>}
              <button
                aria-label={maximizedPanel === "script" ? "Restaurar panel" : "Maximizar panel"}
                className="formula-icon-button"
                onClick={() => toggleMaximizedPanel("script")}
                title={maximizedPanel === "script" ? "Restaurar panel" : "Maximizar panel"}
                type="button"
              >{maximizedPanel === "script" ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
            </div>
          </div>
          <div aria-label="Pestañas del panel de fórmula" className="script-panel-tabs" role="tablist">
            <button aria-controls="formula-panel-content" aria-selected={panelTab === "script"} className={panelTab === "script" ? "is-active" : ""} id="aviatorscript-panel-tab" onClick={() => setPanelTab("script")} role="tab" type="button">AviatorScript</button>
            <button aria-controls="formula-panel-content" aria-selected={panelTab === "test"} className={panelTab === "test" ? "is-active" : ""} id="test-rule-panel-tab" onClick={() => setPanelTab("test")} role="tab" type="button">Probar regla</button>
          </div>
          <div aria-labelledby={panelTab === "script" ? "aviatorscript-panel-tab" : "test-rule-panel-tab"} className="formula-panel-content" id="formula-panel-content" role="tabpanel">
            {panelTab === "script" ? <>
              <textarea
                aria-label="Codigo AviatorScript editable"
                className={`script-editor ${codeIssue ? "has-error" : ""}`}
                onChange={(event) => { setCodeDraft(event.target.value); setCodeIssue(""); setSaveMessage(""); }}
                spellCheck={false}
                value={codeDraft}
              />
              <div className="script-editor-actions">
                <button className="formula-button" disabled={!codeDraft.trim() || codeDraft === script} onClick={discardCodeDraft} type="button">Descartar cambios</button>
                <button className="formula-button formula-button-primary" disabled={!codeDraft.trim() || codeDraft === script} onClick={applyCodeDraft} type="button">Aplicar al grafico</button>
              </div>
              {codeIssue && <div className="formula-issue script-editor-error"><AlertCircle size={15} /><span>{codeIssue}</span></div>}
              <div className="script-type-line"><span>Resultado</span><strong>{expression?.valueType ?? "pendiente"}</strong></div>
              <div className="formula-issues" aria-live="polite">
                {issues.length ? issues.map((issue) => (
                  <div className="formula-issue" key={`${issue.path}-${issue.message}`}><AlertCircle size={15} /><span>{issue.message}</span><code>{issue.path}</code></div>
                )) : <div className="formula-valid-note"><Check size={15} /> Los tipos de datos y las conexiones estan listos.</div>}
              </div>
              <p className="script-note">Edita el codigo y pulsa <strong>Aplicar al grafico</strong>. Solo se aceptan instrucciones que el editor visual puede representar.</p>
              {expression && <FormulaTestValues
                expression={expression}
                fields={fields}
                onOpenJson={() => setPanelTab("test")}
                onPayloadChange={(value) => { setTestPayload(value); setTestResult(null); setTestError(""); }}
                payload={testPayload}
              />}
            </> : <>
              <p className="test-drawer-copy">Ingresa los datos de contexto en JSON y ejecuta la fórmula actual.</p>
              <label className="test-payload-label" htmlFor="formula-test-payload">Datos de prueba (JSON)</label>
              <textarea className="test-payload" id="formula-test-payload" onChange={(event) => { setTestPayload(event.target.value); setTestResult(null); setTestError(""); }} spellCheck={false} value={testPayload} />
              <div className="test-drawer-actions">
                <button className="formula-button" onClick={() => { if (expression) setTestPayload(createFormulaTestPayload(expression, fields, undefined, false)); setTestError(""); setTestResult(null); }} type="button">Restaurar ejemplo</button>
                <button className="formula-button formula-button-primary" disabled={testBusy || issues.length > 0} onClick={() => void executeTest()} type="button">{testBusy ? "Calculando..." : "Ejecutar prueba"}</button>
              </div>
              {testError && <div className="test-result is-error"><AlertCircle size={18} /><span>{testError}</span></div>}
              {testResult && <div className="test-result is-success"><CheckCircle2 size={18} /><div><strong>Resultado (JSON)</strong><pre className="test-result-json">{JSON.stringify(testResult.value, null, 2) ?? "null"}</pre><small>{testResult.elapsed} ms · evaluador local</small></div></div>}
              {issues.length > 0 && <div className="test-result is-error"><AlertCircle size={18} /><span>Corrige las observaciones de la formula antes de probarla.</span></div>}
            </>}
          </div>
        </aside>
      </section>}

      <div className="formula-footer"><span>Contexto JVM</span><span>{fields.map((field) => field.label).join(" · ")}</span></div>
    </main>
  );
}
