"use client";

import { useQuery } from "@tanstack/react-query";
import { Code2 } from "lucide-react";
import type { ChangeEvent, CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceSvg } from "blockly";
import { activateFormula, getCalculationEndpoint, getFormulaTemplates, getRuleSchema, publishFormula, saveFormulaToDatabase as persistFormulaTemplate, testAviatorSource, validateAviatorSource, visualizeAviatorSource } from "../lib/api";
import { buildFormulaFromWorkspace, compactPayrollGraph, createFormulaToolbox, createStarterFormula, decomposePayrollGraph, fitNestedBlockContainers, getUserVariableFields, isDecomposedPayrollWorkspaceState, loadFormulaExpression, refreshPayrollFormulaGraph, registerAviatorBlocks } from "../lib/blockly-editor";
import { compileFormula, type FormulaDocument, type FormulaIssue, type FormulaRoot, type FormulaTemplate, validateFormula } from "../lib/formula";
import { parseAviatorSource, schemaForTemplate, variablesForTemplate } from "../lib/formula-template";
import { parseAdvancedPayrollConfig, payrollProgramFromConfig } from "../lib/payroll-formula";
import { createFormulaTestPayload, createTemplateTestPayload, readTestPayload } from "../lib/test-payload";
import { CANONICAL_AVIATOR_SCHEMA } from "../lib/aviator-contract";
import { cacheTemplateCatalog, downloadFormula, makeFormulaDocument, readCachedTemplateCatalog, saveFormulaToBrowser } from "../lib/formula-persistence";
import type { SchemaField } from "../lib/types";
import { buildLocalAviatorFlow, type AviatorFlowGraph, type AviatorFlowNode } from "../lib/visualization";
import { FormulaTemplateCatalog } from "./FormulaTemplateCatalog";
import { FormulaToolbar } from "./FormulaToolbar";
import { FormulaScriptPanel, type FormulaTestResult } from "./FormulaScriptPanel";
import { FormulaWorkspacePanel } from "./FormulaWorkspacePanel";
import { usePanelResizers } from "../hooks/usePanelResizers";

const INITIAL_TEST_PAYLOAD = "{}";
type MobileTab = "blocks" | "script";
type PanelTab = "script" | "test" | "curl";
type MaximizedPanel = "workspace" | "script";
type ViewMode = "builder" | "visualizer" | "mermaid";
type WorkflowStatus = "BORRADOR" | "VALIDADA" | "VERSION_GUARDADA" | "PUBLICADA" | "ACTIVA";
type FormulaRepresentationMode = "visual" | "code";

const FORMULA_REPRESENTATION: Record<FormulaRepresentationMode, { label: string; description: string }> = {
  visual: {
    label: "Editable visualmente",
    description: "La fórmula está representada en bloques Blockly y puede editarse desde el constructor."
  },
  code: {
    label: "Solo código",
    description: "La fuente AviatorScript se conserva completa, pero contiene instrucciones que el constructor visual no puede representar sin perder semántica."
  }
};

export type VisualFormulaBuilderProps = {
  accessToken?: string | null;
  creator?: string;
  schema?: SchemaField[];
  onSave?: (formula: FormulaDocument) => void | Promise<void>;
};

function combineIssues(builtIssues: FormulaIssue[], expression?: FormulaRoot, fields: SchemaField[] = []) {
  return expression ? [...builtIssues, ...validateFormula(expression, fields)] : builtIssues;
}

function powerShellArgument(value: string) {
  return `"${value.replace(/"/g, "\\\"")}"`;
}

function buildCurlCommand(payload: string, endpoint: string) {
  let body = payload.trim() || "{}";
  try {
    body = JSON.stringify(JSON.parse(body));
  } catch {
    body = body.replace(/[\r\n]+/g, " ");
  }
  return `curl.exe --% --location --request POST ${powerShellArgument(endpoint)} --header ${powerShellArgument("Authorization: Bearer <ACCESS_TOKEN>")} --header ${powerShellArgument("Content-Type: application/json")} --data-raw ${powerShellArgument(body)} --write-out ${powerShellArgument("\\nHTTP status: %{http_code}\\n")}`;
}

export function VisualFormulaBuilder({ accessToken = null, creator = "desconocido", schema: providedSchema, onSave }: VisualFormulaBuilderProps = {}) {
  const schemaQuery = useQuery({
    enabled: !providedSchema,
    initialData: providedSchema?.length ? providedSchema : undefined,
    queryFn: getRuleSchema,
    queryKey: ["aviatorscript", "schema"]
  });
  const templatesQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getFormulaTemplates(accessToken),
    queryKey: ["aviatorscript", "formula-templates", accessToken ? "authenticated" : "anonymous"],
    refetchOnWindowFocus: false,
    staleTime: 30_000
  });
  const calculationEndpointQuery = useQuery({
    queryFn: getCalculationEndpoint,
    queryKey: ["aviatorscript", "calculation-endpoint"],
    refetchOnWindowFocus: false,
    staleTime: Infinity
  });
  const baseFields = schemaQuery.data?.length ? schemaQuery.data : providedSchema?.length ? providedSchema : CANONICAL_AVIATOR_SCHEMA;
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
  const [visualSource, setVisualSource] = useState("");
  const [codeIssue, setCodeIssue] = useState("");
  const [issues, setIssues] = useState<FormulaIssue[]>([]);
  const [hasValidated, setHasValidated] = useState(false);
  const [formulaName, setFormulaName] = useState("Fórmula de negocio");
  const [formulaCode, setFormulaCode] = useState("FORMULA-NUEVA-001");
  const [formulaDescription, setFormulaDescription] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>("BORRADOR");
  const [persistedFormulaId, setPersistedFormulaId] = useState<number | null>(null);
  const [persistedFormula, setPersistedFormula] = useState<FormulaTemplate | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [sourceOnlyTemplateId, setSourceOnlyTemplateId] = useState<string | null>(null);
  const sourceOnlyTemplateRef = useRef<string | null>(null);
  const [templateMessage, setTemplateMessage] = useState("");
  const [offlineTemplateCatalog, setOfflineTemplateCatalog] = useState<FormulaTemplate[]>([]);
  const [copiedCopyId, setCopiedCopyId] = useState<string | null>(null);
  const [templateInfoOpen, setTemplateInfoOpen] = useState(false);
  const [templateInfoMaximized, setTemplateInfoMaximized] = useState(false);
  const [templateVariableFields, setTemplateVariableFields] = useState<SchemaField[]>([]);
  const [representationMode, setRepresentationMode] = useState<FormulaRepresentationMode>("visual");
  const [mobileTab, setMobileTab] = useState<MobileTab>("blocks");
  const [panelTab, setPanelTab] = useState<PanelTab>("script");
  const [testPayload, setTestPayload] = useState(INITIAL_TEST_PAYLOAD);
  const [testResult, setTestResult] = useState<FormulaTestResult | null>(null);
  const [testError, setTestError] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [validationBusy, setValidationBusy] = useState(false);
  const [databaseSaveBusy, setDatabaseSaveBusy] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [blocklyReady, setBlocklyReady] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [payrollLayout, setPayrollLayout] = useState<"compact" | "decomposed">("compact");
  const [maximizedPanel, setMaximizedPanel] = useState<MaximizedPanel | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("builder");
  const [visualGraph, setVisualGraph] = useState<AviatorFlowGraph | null>(null);
  const [visualError, setVisualError] = useState("");
  const [visualLoading, setVisualLoading] = useState(false);
  const [selectedFlowNodeId, setSelectedFlowNodeId] = useState<string>();
  const [flowFocusRequest, setFlowFocusRequest] = useState<{ nodeId: string; requestId: number }>();
  const flowFocusRequestId = useRef(0);
  const {
    workbenchRef,
    scriptPanelRef,
    scriptPanelWidth,
    testPayloadHeight,
    startWorkbenchResize,
    resizeWorkbenchWithKeyboard,
    startTestPanelResize,
    resizeTestPanelWithKeyboard
  } = usePanelResizers();
  const maximizeReturnFocusRef = useRef<HTMLElement | null>(null);
  const copiedFeedbackTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (templatesQuery.data === undefined) return;
    cacheTemplateCatalog(templatesQuery.data);
  }, [templatesQuery.data]);

  useEffect(() => {
    if (!templatesQuery.isError || templatesQuery.data !== undefined) return;
    setOfflineTemplateCatalog(readCachedTemplateCatalog());
  }, [templatesQuery.data, templatesQuery.isError]);

  const catalogSource = templatesQuery.isError && templatesQuery.data === undefined
    ? offlineTemplateCatalog
    : templatesQuery.data ?? [];
  const formulaTemplates = useMemo(
    () => [...catalogSource].sort((left, right) => left.id - right.id),
    [catalogSource]
  );
  const templateCatalogState = templatesQuery.isLoading
    ? "loading"
    : templatesQuery.isError
      ? formulaTemplates.length ? "offline" : "error"
      : formulaTemplates.length ? "ready" : "empty";
  const selectedTemplate = formulaTemplates.find((item) => `${item.codigo}::${item.version}` === selectedTemplateId);
  // Las plantillas del catalogo siempre se editan como copias; solo una version
  // guardada desde este editor puede avanzar en el ciclo de publicacion.
  const lifecycleTemplate = persistedFormula;
  const representationInfo = FORMULA_REPRESENTATION[representationMode];
  const representationActionsDisabledReason = representationMode === "code"
    ? "Esta fórmula está en modo solo código. Corrige o convierte el código desde el editor para habilitar el constructor, Guardar y Probar fórmula."
    : !isHydrated
      ? "El editor aun se esta inicializando."
      : !blocklyReady
        ? "El constructor visual aun se esta cargando."
        : "";
  const actionButtonsDisabled = !isHydrated || !blocklyReady || representationMode === "code" || sourceOnlyTemplateId !== null;
  const hasBlockingIssues = issues.some((issue) => issue.severity === "error");
  const databaseSaveDisabled = actionButtonsDisabled || databaseSaveBusy || !formulaCode.trim() || !hasValidated || hasBlockingIssues;
  const canPublish = Boolean(lifecycleTemplate?.id && lifecycleTemplate.estado === "BORRADOR");
  const canActivate = Boolean(lifecycleTemplate?.id && lifecycleTemplate.estado === "PUBLICADA" && !lifecycleTemplate.activa);
  const calculationEndpoint = calculationEndpointQuery.data?.executionUrl ?? "";
  const curlCommand = useMemo(() => calculationEndpoint ? buildCurlCommand(testPayload, calculationEndpoint) : "", [calculationEndpoint, testPayload]);

  fieldsRef.current = fields;
  staticFieldsRef.current = templateFields ?? baseFields;

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    return () => {
      if (copiedFeedbackTimerRef.current !== null) {
        window.clearTimeout(copiedFeedbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const source = visualSource.trim();
    if (!source) {
      setVisualGraph(null);
      setVisualError("No hay código para analizar.");
      setVisualLoading(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      let localError = "";
      try {
        const parsed = parseAviatorSource(source, fieldsRef.current);
        const localGraph = buildLocalAviatorFlow(source, parsed);
        if (active) {
          setVisualGraph(localGraph);
          setVisualError("");
          setSelectedFlowNodeId(undefined);
        }
      } catch (error) {
        localError = error instanceof Error ? error.message : "No se pudo analizar el código AviatorScript.";
        if (active) {
          setVisualGraph(null);
          setVisualError(localError);
          setSelectedFlowNodeId(undefined);
        }
      }

      setVisualLoading(true);
      void visualizeAviatorSource(source, accessToken).then((remoteGraph) => {
        if (!active || !remoteGraph?.nodes?.length) return;
        setVisualGraph(remoteGraph);
        setVisualError("");
      }).catch(() => {
        if (active) setVisualError(localError || "El servicio remoto no está disponible para analizar esta fórmula.");
      }).finally(() => {
        if (active) setVisualLoading(false);
      });
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [accessToken, fieldsKey, visualSource]);

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
    if (sourceOnlyTemplateRef.current !== null) return;
    const workspace = workspaceRef.current;
    if (!workspace) return;
    setPersistedFormulaId(null);
    setPersistedFormula(null);
    setWorkflowStatus("BORRADOR");
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
    setVisualSource(nextScript);
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
    setFormulaName("Nueva fórmula");
    setFormulaCode("FORMULA-NUEVA-001");
    setFormulaDescription("");
    setSaveMessage("");
    setWorkflowStatus("BORRADOR");
    setPersistedFormulaId(null);
    setPersistedFormula(null);
    setSelectedTemplateId("");
    sourceOnlyTemplateRef.current = null;
    setSourceOnlyTemplateId(null);
    setRepresentationMode("visual");
    setTemplateMessage("");
    setTemplateInfoOpen(false);
    setTemplateInfoMaximized(false);
    setTemplateVariableFields([]);
    setPayrollLayout("compact");
    setMobileTab("blocks");
    setPanelTab("script");
    refreshFormula();
  }

  function useFormulaTemplate(template: FormulaTemplate) {
    const Blockly = blocklyRef.current;
    const workspace = workspaceRef.current;
    if (!Blockly || !workspace) return;
    const previousFields = fieldsRef.current;
    const previousTemplateFields = templateFields;
    const previousTemplateVariableFields = templateVariableFields;
    const previousUserFields = userFields;
    try {
      const payrollConfig = parseAdvancedPayrollConfig(template.expresion);
      const parsed = payrollConfig
        ? payrollProgramFromConfig(payrollConfig)
        : parseAviatorSource(template.expresion, baseFields);
      const expandedFields = schemaForTemplate(parsed, baseFields);
      const usedVariableFields = variablesForTemplate(parsed, baseFields);
      fieldsRef.current = expandedFields;
      staticFieldsRef.current = expandedFields;
      setTemplateFields(expandedFields);
      setTemplateVariableFields(usedVariableFields);
      setUserFields([]);
      loadFormulaExpression(Blockly, workspace, parsed);
      const shouldDecomposePayroll = parsed.kind === "payroll";
      setFormulaName(`Nueva - ${template.nombre}`.slice(0, 100));
      setFormulaCode(template.codigo);
      setFormulaDescription(template.descripcion ?? "");
      setWorkflowStatus("BORRADOR");
      setPersistedFormulaId(null);
      setPersistedFormula(null);
      setSelectedTemplateId(`${template.codigo}::${template.version}`);
      sourceOnlyTemplateRef.current = null;
      setSourceOnlyTemplateId(null);
      setRepresentationMode("visual");
      setTemplateMessage(`Plantilla ${template.codigo} v${template.version} cargada como una fórmula nueva. La fórmula guardada no se modifica.`);
      setPayrollLayout(shouldDecomposePayroll ? "decomposed" : "compact");
      const fallbackPayload = createFormulaTestPayload(parsed, expandedFields, undefined, false, { codigoFormula: template.codigo });
      const templateTestPayload = createTemplateTestPayload(template.ejemplo, fallbackPayload, { codigoFormula: template.codigo });
      setTestResult(null);
      setTestError("");
      setSaveMessage("");
      setCodeIssue("");
      setHasValidated(false);
      setMobileTab("blocks");
      setPanelTab("script");
      refreshFormula();
      setTestPayload(templateTestPayload);
    } catch (error) {
      fieldsRef.current = previousFields;
      staticFieldsRef.current = previousTemplateFields ?? baseFields;
      setTemplateFields(previousTemplateFields);
      setTemplateVariableFields(previousTemplateVariableFields);
      setUserFields(previousUserFields);
      const templateId = `${template.codigo}::${template.version}`;
      sourceOnlyTemplateRef.current = templateId;
      setSourceOnlyTemplateId(templateId);
      setRepresentationMode("code");
      setFormulaName(`Nueva - ${template.nombre}`.slice(0, 100));
      setFormulaCode(template.codigo);
      setFormulaDescription(template.descripcion ?? "");
      setWorkflowStatus("BORRADOR");
      setPersistedFormulaId(null);
      setPersistedFormula(null);
      setSelectedTemplateId(templateId);
      setTemplateVariableFields([]);
      setTemplateMessage(`Plantilla ${template.codigo} cargada en modo solo código. Sus instrucciones avanzadas no se representan como bloques; el lienzo anterior se conserva y la fórmula completa queda disponible para visualización.`);
      setScript(template.expresion);
      setCodeDraft(template.expresion);
      setVisualSource(template.expresion);
      setCodeIssue("");
      setExpression(null);
      setIssues([]);
      setHasValidated(false);
      setTestPayload(createTemplateTestPayload(template.ejemplo, INITIAL_TEST_PAYLOAD, { codigoFormula: template.codigo }));
      setTestResult(null);
      setTestError("");
      setSaveMessage(error instanceof Error ? error.message : "La plantilla se cargó en modo solo código para visualización.");
      setPanelTab("script");
      setMobileTab("script");
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
      setSaveMessage("Fórmula enviada al proceso de guardado.");
    } else {
      saveFormulaToBrowser(formula);
      downloadFormula(formula);
      setSaveMessage("Guardada en este navegador y descargada como archivo JSON.");
    }
  }

  async function saveFormulaToDatabase() {
    const workspace = workspaceRef.current;
    const codigo = formulaCode.trim();
    if (!workspace || !expression || !codigo) return;

    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(codigo)) {
      setSaveMessage("El código solo puede contener letras, números, punto, guion y guion bajo.");
      return;
    }

    const built = buildFormulaFromWorkspace(workspace, fieldsRef.current);
    const currentIssues = combineIssues(built.issues, built.expression, fieldsRef.current);
    setIssues(currentIssues);
    setHasValidated(true);
    if (currentIssues.some((issue) => issue.severity === "error") || !built.expression) {
      setSaveMessage("Completa los bloques marcados antes de guardar en la base de datos.");
      return;
    }

    const parsedPayload = readTestPayload(testPayload);
    if (!parsedPayload) {
      setPanelTab("test");
      setSaveMessage("Corrige el JSON de prueba antes de guardar en la base de datos.");
      return;
    }

    const example = { ...parsedPayload, codigoFormula: codigo } as Record<string, unknown>;
    setDatabaseSaveBusy(true);
    try {
      const saved = await persistFormulaTemplate({
        codigo,
        descripcion: formulaDescription.trim() || null,
        ejemplo: example,
        expresion: compileFormula(built.expression),
        nombre: formulaName.trim() || "Fórmula sin título"
      }, accessToken);
      setFormulaCode(saved.codigo);
      setPersistedFormulaId(saved.id);
      setPersistedFormula(saved);
      setWorkflowStatus("VERSION_GUARDADA");
      setSelectedTemplateId(`${saved.codigo}::${saved.version}`);
      setTestPayload(JSON.stringify(example, null, 2));
      setSaveMessage(`Guardada en la base de datos como ${saved.codigo} v${saved.version}.`);
      void templatesQuery.refetch();
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "No se pudo guardar la fórmula en la base de datos.");
    } finally {
      setDatabaseSaveBusy(false);
    }
  }

  function createNewVersionFromTemplate(template: FormulaTemplate) {
    useFormulaTemplate(template);
    setSelectedTemplateId("");
    setTemplateInfoOpen(false);
    setWorkflowStatus("BORRADOR");
    setPersistedFormulaId(null);
    setPersistedFormula(null);
    setSaveMessage(`Nueva versión de ${template.codigo} preparada como borrador.`);
  }

  async function publishCurrentFormula() {
    const target = persistedFormula ?? selectedTemplate;
    if (!target || !canPublish || lifecycleBusy) return;
    setLifecycleBusy(true);
    try {
      const updated = await publishFormula(target.id, accessToken);
      setPersistedFormulaId(updated.id);
      setPersistedFormula(updated);
      setWorkflowStatus(updated.activa ? "ACTIVA" : "PUBLICADA");
      setSaveMessage(`Versión ${updated.codigo} v${updated.version} publicada.`);
      setTemplateMessage(`Publicada por ${updated.publicadoPor ?? creator}.`);
      void templatesQuery.refetch();
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "No se pudo publicar la versión.");
    } finally {
      setLifecycleBusy(false);
    }
  }

  async function activateCurrentFormula() {
    const target = persistedFormula ?? selectedTemplate;
    if (!target || !canActivate || lifecycleBusy) return;
    setLifecycleBusy(true);
    try {
      const updated = await activateFormula(target.id, accessToken);
      setPersistedFormulaId(updated.id);
      setPersistedFormula(updated);
      setWorkflowStatus("ACTIVA");
      setSaveMessage(`Versión ${updated.codigo} v${updated.version} activada.`);
      setTemplateMessage(`Activa por ${updated.activadoPor ?? creator}.`);
      void templatesQuery.refetch();
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "No se pudo activar la versión.");
    } finally {
      setLifecycleBusy(false);
    }
  }

  async function openFormula(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    const workspace = workspaceRef.current;
    const Blockly = blocklyRef.current;
    event.target.value = "";
    if (!selectedFile || !workspace || !Blockly) return;
    if (selectedFile.size > 1024 * 1024) {
      setSaveMessage("El archivo supera el límite de 1 MB.");
      return;
    }
    try {
      const parsed = JSON.parse(await selectedFile.text()) as Partial<FormulaDocument>;
      if (parsed.format !== "aviatorscript-formula" || parsed.version !== 1 || !parsed.workspace || !parsed.expression || typeof parsed.name !== "string") {
        throw new Error("El archivo no tiene el formato de fórmula esperado.");
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
      setFormulaCode("FORMULA-LOCAL-001");
      setFormulaDescription("");
      setWorkflowStatus("BORRADOR");
      setPersistedFormulaId(null);
      setPersistedFormula(null);
      setSelectedTemplateId("");
      sourceOnlyTemplateRef.current = null;
      setSourceOnlyTemplateId(null);
      setRepresentationMode("visual");
      setTemplateMessage("");
      setTemplateInfoOpen(false);
      setTemplateInfoMaximized(false);
      setTemplateVariableFields([]);
      setSaveMessage("Fórmula abierta correctamente.");
      setPanelTab("script");
      setTestPayload(createFormulaTestPayload(openedExpression, openedFields, undefined, false));
      refreshFormula();
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "No se pudo abrir el archivo.");
    }
  }

  async function validateCurrentFormula() {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const built = buildFormulaFromWorkspace(workspace, fieldsRef.current);
    const localIssues = combineIssues(built.issues, built.expression, fieldsRef.current);
    const currentIssues = localIssues.map((issue) => built.issues.includes(issue)
      ? issue
      : { ...issue, severity: "warning" as const });
    setExpression(built.expression ?? null);
    const nextScript = built.expression ? compileFormula(built.expression) : "";
    setScript(nextScript);
    setCodeDraft(nextScript);
    setCodeIssue("");
    setIssues(currentIssues);
    if (currentIssues.some((issue) => issue.severity === "error") || !nextScript) {
      setHasValidated(false);
      setWorkflowStatus("BORRADOR");
      setSaveMessage("Revisa las observaciones antes de usar la fórmula.");
      return;
    }

    setValidationBusy(true);
    try {
      const response = await validateAviatorSource(nextScript, accessToken);
      const engineIssues: FormulaIssue[] = (response.diagnostics ?? []).map((diagnostic) => ({
        message: diagnostic.line
          ? diagnostic.message + " (línea " + diagnostic.line + (diagnostic.column ? ", columna " + diagnostic.column : "") + ")"
          : diagnostic.message,
        path: diagnostic.line ? "source.line." + diagnostic.line : "source",
        severity: diagnostic.severity
      }));
      const allIssues = [...currentIssues, ...engineIssues];
      setIssues(allIssues);
      const valid = response.valid && allIssues.every((issue) => issue.severity !== "error");
      setHasValidated(valid);
      setWorkflowStatus(valid ? persistedFormulaId ? "VERSION_GUARDADA" : "VALIDADA" : "BORRADOR");
      setSaveMessage(valid ? "La fórmula compila con el motor AviatorScript y está lista para probarse." : "El motor AviatorScript encontró observaciones en la fórmula.");
    } catch (error) {
      setHasValidated(false);
      setWorkflowStatus("BORRADOR");
      setIssues([{ message: error instanceof Error ? error.message : "No se pudo validar con el motor AviatorScript.", path: "source", severity: "error" }]);
      setSaveMessage("No se pudo validar la fórmula con el motor AviatorScript.");
    } finally {
      setValidationBusy(false);
    }
  }

  function showCopiedFeedback(copyId: string) {
    setCopiedCopyId(copyId);
    if (copiedFeedbackTimerRef.current !== null) {
      window.clearTimeout(copiedFeedbackTimerRef.current);
    }
    copiedFeedbackTimerRef.current = window.setTimeout(() => {
      copiedFeedbackTimerRef.current = null;
      setCopiedCopyId(null);
    }, 1400);
  }

  async function copyScript() {
    if (!codeDraft) return;
    await navigator.clipboard.writeText(codeDraft);
    showCopiedFeedback("generated-script");
    setSaveMessage("Fórmula copiada al portapapeles.");
  }

  async function copyCurl() {
    if (!curlCommand) return;
    await navigator.clipboard.writeText(curlCommand);
    showCopiedFeedback("curl-command");
    setSaveMessage("Comando cURL copiado al portapapeles.");
  }

  async function copyTestPayload() {
    if (!testPayload) return;
    await navigator.clipboard.writeText(testPayload);
    showCopiedFeedback("test-payload");
    setSaveMessage("JSON de prueba copiado al portapapeles.");
  }

  async function copyTestResult() {
    if (!testResult) return;
    await navigator.clipboard.writeText(JSON.stringify(testResult.value, null, 2));
    showCopiedFeedback("test-result-json");
    setSaveMessage("Resultado JSON copiado al portapapeles.");
  }

  async function copyTemplateExpression() {
    if (!selectedTemplate?.expresion) return;
    try {
      await navigator.clipboard.writeText(selectedTemplate.expresion);
      showCopiedFeedback("template-expression");
      setTemplateMessage("Expresión copiada al portapapeles.");
    } catch {
      setTemplateMessage("No se pudo copiar la expresión al portapapeles.");
    }
  }

  async function copyTemplateValue(value: string, label: string, copyId: string) {
    if (!value || value === "No disponible") return;
    try {
      await navigator.clipboard.writeText(value);
      showCopiedFeedback(copyId);
      setTemplateMessage(`${label} copiado al portapapeles.`);
    } catch {
      setTemplateMessage(`No se pudo copiar ${label.toLowerCase()} al portapapeles.`);
    }
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
      refreshFormula();
      setPayrollLayout("compact");
      setSelectedTemplateId("");
      sourceOnlyTemplateRef.current = null;
      setSourceOnlyTemplateId(null);
      setRepresentationMode("visual");
      setTemplateMessage("");
      setCodeIssue("");
      setIssues(parsedIssues);
      setHasValidated(false);
      setTestResult(null);
      setTestError("");
      setSaveMessage(parsedIssues.length ? "Código cargado, pero debes corregir las observaciones visuales." : "Código aplicado al lienzo visual.");
      setMobileTab("blocks");
    } catch (error) {
      setCodeIssue(error instanceof Error ? error.message : "No se pudo interpretar el codigo AviatorScript.");
      if (sourceOnlyTemplateId !== null) {
        setScript(codeDraft);
        setVisualSource(codeDraft);
    setSaveMessage("La fórmula sigue en modo solo código; se actualizó su visualización sin modificar el lienzo.");
      } else {
        setSaveMessage("Corrige el código y vuelve a aplicarlo al lienzo.");
      }
    }
  }

  function discardCodeDraft() {
    setCodeDraft(script);
    setCodeIssue("");
      setSaveMessage("Cambios de código descartados.");
  }

  function decomposeCurrentFormula() {
    const Blockly = blocklyRef.current;
    const workspace = workspaceRef.current;
    if (!Blockly || !workspace || expression?.kind !== "payroll") return;
    if (decomposePayrollGraph(Blockly, workspace)) {
      setPayrollLayout("decomposed");
      setSaveMessage("Fórmula descompuesta: cada parámetro, validación y sentencia se puede mover y revisar por separado.");
      refreshFormula();
    }
  }

  function compactCurrentFormula() {
    const Blockly = blocklyRef.current;
    const workspace = workspaceRef.current;
    if (!Blockly || !workspace || expression?.kind !== "payroll") return;
    if (compactPayrollGraph(Blockly, workspace)) {
      setPayrollLayout("compact");
      setSaveMessage("Fórmula compactada en un solo bloque de nómina avanzada.");
      refreshFormula();
    }
  }

  async function executeTest() {
    if (!script || !hasValidated || hasBlockingIssues) return;
    setTestBusy(true);
    setTestError("");
    setTestResult(null);
    try {
      const payload = readTestPayload(testPayload);
      if (!payload) throw new Error("El JSON debe ser una solicitud con parametros validos.");
      const response = await testAviatorSource(script, payload.parametros, accessToken);
      if (!response.success) throw new Error(response.error || "No se pudo ejecutar la prueba con AviatorScript.");
      setTestResult({ value: response.result, elapsed: response.executionTimeMs, engine: response.engine || "Motor AviatorScript" });
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

  function selectFlowNode(node: AviatorFlowNode | undefined) {
    setSelectedFlowNodeId(node?.id);
  }

  function selectRelatedFlowNode(nodeId: string) {
    setSelectedFlowNodeId(nodeId);
  }

  function focusFlowLine(line: number) {
    const candidates = (visualGraph?.nodes ?? [])
      .filter((node) => node.data.source.startLine <= line && node.data.source.endLine >= line)
      .sort((left, right) => {
        const leftSpan = left.data.source.endLine - left.data.source.startLine;
        const rightSpan = right.data.source.endLine - right.data.source.startLine;
        return leftSpan - rightSpan || Math.abs(left.data.source.startLine - line) - Math.abs(right.data.source.startLine - line);
      });
    const target = candidates.find((node) => node.data.kind !== "start" && node.data.kind !== "end") ?? candidates[0];
    if (!target) return;
    flowFocusRequestId.current += 1;
    setSelectedFlowNodeId(target.id);
    setViewMode("visualizer");
    setMobileTab("blocks");
    setFlowFocusRequest({ nodeId: target.id, requestId: flowFocusRequestId.current });
  }

  const validationLabel = issues.length
    ? `${issues.length} observación${issues.length === 1 ? "" : "es"}`
    : sourceOnlyTemplateId ? "Plantilla avanzada en modo solo código"
    : hasValidated ? "Fórmula válida" : "Edición en curso";
  const validationState = hasBlockingIssues ? "is-invalid" : hasValidated ? "is-valid" : "is-pending";
  const workflowStatusLabel = workflowStatus === "VERSION_GUARDADA" ? "Versión guardada" : workflowStatus.charAt(0) + workflowStatus.slice(1).toLowerCase();

  return (
    <main className="formula-app">
      <FormulaToolbar
        actionButtonsDisabled={actionButtonsDisabled}
        canActivate={canActivate}
        canPublish={canPublish}
        databaseSaveBusy={databaseSaveBusy}
        databaseSaveDisabled={databaseSaveDisabled}
        expression={expression}
        fieldsLength={fields.length}
        fileInputRef={fileInputRef}
        formulaCode={formulaCode}
        formulaName={formulaName}
        issues={issues}
        lifecycleBusy={lifecycleBusy}
        onActivate={() => void activateCurrentFormula()}
        onCompact={compactCurrentFormula}
        onDecompose={decomposeCurrentFormula}
        onFormulaCodeChange={(value) => { setFormulaCode(value); setSaveMessage(""); }}
        onFormulaNameChange={(value) => { setFormulaName(value); setSaveMessage(""); }}
        onNew={startNewFormula}
        onNewVersion={createNewVersionFromTemplate}
        onOpen={openFormula}
        onPublish={() => void publishCurrentFormula()}
        onSave={() => void saveFormula()}
        onSaveVersion={() => void saveFormulaToDatabase()}
        onTest={openTestTab}
        onValidate={() => void validateCurrentFormula()}
        payrollLayout={payrollLayout}
        representationActionsDisabledReason={representationActionsDisabledReason}
        representationInfo={representationInfo}
        representationMode={representationMode}
        saveMessage={saveMessage}
        schemaIsError={Boolean(schemaQuery.isError)}
        selectedTemplate={selectedTemplate}
        templateContent={
          <FormulaTemplateCatalog
            catalogState={templateCatalogState}
            copiedCopyId={copiedCopyId}
            formulaTemplates={formulaTemplates}
            isFetching={templatesQuery.isFetching}
            isLoading={templatesQuery.isLoading}
            onCloseInfo={() => { setTemplateInfoOpen(false); setTemplateInfoMaximized(false); }}
            onCopyExpression={() => void copyTemplateExpression()}
            onCopyValue={(value, label, copyId) => void copyTemplateValue(value, label, copyId)}
            onRefresh={() => void templatesQuery.refetch()}
            onSelectTemplate={(value) => {
              const selected = formulaTemplates.find((item) => `${item.codigo}::${item.version}` === value);
              setSelectedTemplateId(value);
              setTemplateMessage("");
              setTemplateInfoOpen(Boolean(selected));
              setTemplateInfoMaximized(false);
              if (selected) useFormulaTemplate(selected);
            }}
            onToggleInfoMaximized={() => setTemplateInfoMaximized((current) => !current)}
            selectedTemplate={selectedTemplate}
            selectedTemplateId={selectedTemplateId}
            templateInfoMaximized={templateInfoMaximized}
            templateInfoOpen={templateInfoOpen}
            templateMessage={templateMessage}
            templateVariableFields={templateVariableFields}
          />
        }
        validationBusy={validationBusy}
        validationLabel={validationLabel}
        validationState={validationState}
        workflowStatus={workflowStatus}
        workflowStatusLabel={workflowStatusLabel}
      />

      {representationMode === "code" && (
        <div className="formula-representation-banner" role="status">
          <Code2 size={16} />
          <div>
            <strong>La plantilla se cargo en modo solo codigo.</strong>
            <span>{representationInfo.description} Puedes revisar o editar la fuente y volver a aplicar cuando el codigo sea representable. Mientras tanto, las acciones visuales, Guardar, Validar y Probar permanecen deshabilitadas para no perder la formula.</span>
          </div>
        </div>
      )}

      <nav aria-label="Panel de trabajo movil" className="formula-mobile-tabs">
        <button aria-pressed={mobileTab === "blocks"} className={mobileTab === "blocks" ? "is-active" : ""} onClick={() => setMobileTab("blocks")} title="Mostrar el lienzo de bloques y las vistas del flujo" type="button">Bloques</button>
        <button aria-pressed={mobileTab === "script"} className={mobileTab === "script" ? "is-active" : ""} onClick={() => setMobileTab("script")} title="Mostrar el código, la prueba o el comando cURL" type="button">{panelTab === "test" ? "Probar fórmula" : panelTab === "curl" ? "cURL" : "AviatorScript"}</button>
      </nav>

      <section
        className="formula-workbench"
        ref={workbenchRef}
        style={scriptPanelWidth === null ? undefined : { "--formula-script-width": `${scriptPanelWidth}px` } as CSSProperties}
      >
        {maximizedPanel && <button aria-label="Cerrar panel maximizado" className="panel-maximize-backdrop" onClick={() => setMaximizedPanel(null)} tabIndex={-1} title="Cerrar el panel maximizado" type="button" />}
        <FormulaWorkspacePanel
          flowFocusRequest={flowFocusRequest}
          hostRef={hostRef}
          maximized={maximizedPanel === "workspace"}
          mobileVisible={mobileTab === "blocks"}
          onSelectNode={selectFlowNode}
          onSelectRelated={selectRelatedFlowNode}
          onToggleMaximize={() => toggleMaximizedPanel("workspace")}
          onViewModeChange={(mode) => { setViewMode(mode); setMobileTab("blocks"); }}
          selectedFlowNodeId={selectedFlowNodeId}
          viewMode={viewMode}
          visualError={visualError}
          visualGraph={visualGraph}
          visualLoading={visualLoading}
        />
        <div
          aria-label="Ajustar ancho de los paneles"
          aria-orientation="vertical"
          className="formula-workbench-resizer"
          onKeyDown={resizeWorkbenchWithKeyboard}
          onPointerDown={startWorkbenchResize}
          role="separator"
          tabIndex={0}
          title="Arrastra para ajustar el ancho de los paneles"
        />
        <FormulaScriptPanel
          calculationEndpoint={calculationEndpoint}
          calculationEndpointError={calculationEndpointQuery.isError}
          calculationEndpointLoading={calculationEndpointQuery.isLoading}
          codeDraft={codeDraft}
          codeIssue={codeIssue}
          copiedCopyId={copiedCopyId}
          curlCommand={curlCommand}
          expression={expression}
          fields={fields}
          hasBlockingIssues={hasBlockingIssues}
          hasValidated={hasValidated}
          issues={issues}
          maximized={maximizedPanel === "script"}
          mobileVisible={mobileTab === "script"}
          onApplyCodeDraft={applyCodeDraft}
          onCodeDraftChange={(value) => { setCodeDraft(value); setCodeIssue(""); setSaveMessage(""); }}
          onCopyCurl={() => void copyCurl()}
          onCopyPayload={() => void copyTestPayload()}
          onCopyResult={() => void copyTestResult()}
          onCopyScript={() => void copyScript()}
          onDiscardCodeDraft={discardCodeDraft}
          onExecuteTest={() => void executeTest()}
          onLineClick={focusFlowLine}
          onOpenJson={() => setPanelTab("test")}
          onPanelTabChange={setPanelTab}
          onPayloadChange={(value) => { setTestPayload(value); setTestResult(null); setTestError(""); }}
          onRestorePayload={() => { if (expression) setTestPayload(createFormulaTestPayload(expression, fields, undefined, false)); setTestError(""); setTestResult(null); }}
          onTestPanelResizeKeyDown={resizeTestPanelWithKeyboard}
          onTestPanelResizePointerDown={startTestPanelResize}
          onToggleMaximize={() => toggleMaximizedPanel("script")}
          panelTab={panelTab}
          representationLabel={representationInfo.label}
          representationMode={representationMode}
          script={script}
          scriptPanelRef={scriptPanelRef}
          selectedFlowNodeId={selectedFlowNodeId}
          testBusy={testBusy}
          testError={testError}
          testPayload={testPayload}
          testPayloadHeight={testPayloadHeight}
          testResult={testResult}
          visualGraph={visualGraph}
        />
      </section>

      <div className="formula-footer"><span>Contexto JVM</span><span>{fields.map((field) => field.label).join(" · ")}</span></div>
    </main>
  );
}
