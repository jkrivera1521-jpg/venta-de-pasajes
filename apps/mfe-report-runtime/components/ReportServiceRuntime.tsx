"use client";

import { basicSetup } from "codemirror";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  CloudOff,
  Download,
  FileArchive,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  Server,
  Terminal,
  Upload,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  defaultBatchData,
  buildExampleData,
  displayValue,
  formatBytes,
  formatDate,
  readableError,
  type ReportFormat,
  type ReportJob,
  type ReportTemplate,
  type ServiceStatus,
  type TemplateParameter,
  type TemplateVersion,
} from "../lib/contracts";

class ReportRequestError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

function proxyUrl(path: string) {
  return `/api/report/${path.replace(/^\/+/, "")}`;
}

function outputFormatFor(documentType?: string | null): ReportFormat {
  return documentType?.toUpperCase() === "DOCX" ? "DOCX" : "XLSX";
}

async function requestJson<T>(path: string, token: string | null, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(proxyUrl(path), { ...init, headers, cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new ReportRequestError(readableError(payload, `La solicitud fallo (${response.status}).`), response.status);
  return payload as T;
}

async function requestBinary(path: string, token: string | null, body: string) {
  const headers = new Headers({ "Content-Type": "application/json", Accept: "*/*" });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(proxyUrl(path), { body, cache: "no-store", headers, method: "POST" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ReportRequestError(readableError(payload, `No se pudo generar el documento (${response.status}).`), response.status);
  }
  return { blob: await response.blob(), fileName: fileNameFromHeader(response.headers.get("content-disposition")) };
}

async function requestBinaryGet(path: string, token: string | null) {
  const headers = new Headers({ Accept: "*/*" });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(proxyUrl(path), { cache: "no-store", headers, method: "GET" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ReportRequestError(readableError(payload, `No se pudo descargar la plantilla (${response.status}).`), response.status);
  }
  return { blob: await response.blob(), fileName: fileNameFromHeader(response.headers.get("content-disposition")) };
}

function fileNameFromHeader(value: string | null) {
  if (!value) return "reporte-generado";
  const match = value.match(/filename="?([^";]+)"?/i);
  return match?.[1] || "reporte-generado";
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function parseObjectJson(value: string) {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("El JSON debe ser un objeto.");
  return parsed as Record<string, unknown>;
}

type GenerateRequest = {
  data: Record<string, unknown>;
  fileName: string;
  outputFormat: ReportFormat;
  templateCode: string;
  templateVersion?: number;
};

function parseGenerateRequest(value: string): GenerateRequest {
  const request = parseObjectJson(value);
  const rawData = request.data ?? request.parameters;
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) throw new Error("El campo data debe ser un objeto JSON.");

  const templateCode = typeof request.templateCode === "string" ? request.templateCode.trim() : "";
  if (!templateCode) throw new Error("El campo templateCode es obligatorio.");

  const outputFormat = typeof request.outputFormat === "string" ? request.outputFormat.toUpperCase() : "";
  if (!["XLSX", "DOCX", "PDF"].includes(outputFormat)) throw new Error("El campo outputFormat debe ser XLSX, DOCX o PDF.");

  const rawVersion = request.templateVersion;
  const templateVersion = rawVersion === undefined || rawVersion === null || rawVersion === "" ? undefined : Number(rawVersion);
  if (templateVersion !== undefined && (!Number.isInteger(templateVersion) || templateVersion < 1)) throw new Error("El campo templateVersion debe ser un entero positivo.");

  return {
    data: rawData as Record<string, unknown>,
    fileName: typeof request.fileName === "string" && request.fileName.trim() ? request.fileName.trim() : `reporte.${outputFormat.toLowerCase()}`,
    outputFormat: outputFormat as ReportFormat,
    templateCode,
    templateVersion,
  };
}

function buildGenerateRequestJson(code: string, version: number | undefined, documentType: string | null | undefined, parameters: TemplateParameter[]) {
  const outputFormat = outputFormatFor(documentType);
  return JSON.stringify({
    data: buildExampleData(parameters),
    fileName: `reporte.${outputFormat.toLowerCase()}`,
    outputFormat,
    templateCode: code,
    templateVersion: version,
  }, null, 2);
}

function generateRequestStorageKey(code: string, version?: number) {
  return "venta-pasajes.report-runtime.generate-request.v1:" + encodeURIComponent(code) + ":" + (version ?? "active");
}

function readSavedGenerateRequest(code: string, version?: number) {
  if (typeof window === "undefined" || !code) return null;
  try {
    const saved = window.localStorage.getItem(generateRequestStorageKey(code, version));
    if (!saved) return null;
    parseGenerateRequest(saved);
    return saved;
  } catch {
    return null;
  }
}

function saveGenerateRequest(code: string, version: number | undefined, value: string) {
  if (typeof window === "undefined" || !code) throw new Error("No se pudo identificar la plantilla seleccionada.");
  const parsed = parseObjectJson(value);
  parseGenerateRequest(value);
  const normalized = JSON.stringify(parsed, null, 2);
  window.localStorage.setItem(generateRequestStorageKey(code, version), normalized);
  return normalized;
}

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Algunos navegadores bloquean Clipboard API dentro de iframes.
    }
  }

  const fallback = document.createElement("textarea");
  fallback.value = value;
  fallback.setAttribute("readonly", "true");
  fallback.style.position = "fixed";
  fallback.style.inset = "-9999px auto auto -9999px";
  document.body.appendChild(fallback);
  fallback.focus();
  fallback.select();
  fallback.setSelectionRange(0, fallback.value.length);
  const copied = document.execCommand("copy");
  fallback.remove();
  if (!copied) throw new Error("No se pudo copiar el texto.");
}

type CurlVariant = "powershell" | "cmd" | "posix" | "postman";

const curlVariantLabels: Record<CurlVariant, string> = {
  powershell: "Windows PowerShell",
  cmd: "Windows CMD",
  posix: "Linux/macOS",
  postman: "Postman",
};

function quotePosix(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function quotePowerShell(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function quoteCmd(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function normalizeCurlEndpoint(value: string) {
  const endpoint = value.trim();
  const markdownLink = endpoint.match(/^\[[^\]]+\]\(([^)]+)\)$/);
  return markdownLink?.[1]?.trim() || endpoint;
}

function safeOutputFileName(value: string, format: ReportFormat) {
  const fallback = "reporte." + format.toLowerCase();
  const fileName = (value || fallback).trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");
  return fileName || fallback;
}

function buildPowerShellCurlCommand({ endpoint, payload, fileName, headers }: { endpoint: string; payload: string; fileName: string; headers: string[] }) {
  const continuation = String.fromCharCode(96);
  return [
    "$reportPayloadFile = Join-Path $PWD '.report-request.json'",
    "$reportResponseFile = Join-Path $PWD '.report-response.bin'",
    "$reportOutputFile = " + quotePowerShell(fileName),
    "$reportPayload = @'",
    payload,
    "'@",
    "$reportUtf8 = New-Object System.Text.UTF8Encoding($false)",
    "[IO.File]::WriteAllText($reportPayloadFile, $reportPayload, $reportUtf8)",
    "curl.exe -sS --fail-with-body --request POST",
    "  " + quotePowerShell(endpoint) + " " + continuation,
    ...headers.map((header) => "  -H " + quotePowerShell(header) + " " + continuation),
    "  --data-binary \"@$reportPayloadFile\" " + continuation,
    "  --output $reportResponseFile " + continuation,
    "  --write-out \"HTTP_STATUS=%{http_code}" + continuation + "n\"",
    "$reportExitCode = $LASTEXITCODE",
    "if ($reportExitCode -ne 0) {",
    "  Write-Host \"No se pudo generar el reporte. Codigo cURL: $reportExitCode\"",
    "  if (Test-Path -LiteralPath $reportResponseFile) { Get-Content -LiteralPath $reportResponseFile -Raw }",
    "  Remove-Item -LiteralPath $reportPayloadFile, $reportResponseFile -Force -ErrorAction SilentlyContinue",
    "} elseif (!(Test-Path -LiteralPath $reportResponseFile) -or (Get-Item -LiteralPath $reportResponseFile).Length -eq 0) {",
    "  Write-Host \"La respuesta fue vacia; no se creo el archivo final.\"",
    "  Remove-Item -LiteralPath $reportPayloadFile, $reportResponseFile -Force -ErrorAction SilentlyContinue",
    "} else {",
    "  Move-Item -LiteralPath $reportResponseFile -Destination $reportOutputFile -Force",
    "  Remove-Item -LiteralPath $reportPayloadFile -Force -ErrorAction SilentlyContinue",
    "  Write-Host \"Reporte generado: $reportOutputFile\"",
    "}",
  ].join("\n");
}

function buildCmdCurlCommand({ endpoint, payload, fileName, headers }: { endpoint: string; payload: string; fileName: string; headers: string[] }) {
  const continuation = String.fromCharCode(94);
  return [
    'set "REPORT_RESPONSE_FILE=%TEMP%\\venta-pasajes-report-response.bin"',
    'set "REPORT_OUTPUT_FILE=' + fileName + '"',
    "curl.exe -sS --fail-with-body --request POST",
    "  " + quoteCmd(endpoint) + " " + continuation,
    ...headers.map((header) => "  -H " + quoteCmd(header) + " " + continuation),
    "  --data-raw " + quoteCmd(payload) + " " + continuation,
    '  --output "%REPORT_RESPONSE_FILE%"',
    "if errorlevel 1 (",
    "  echo No se pudo generar el reporte. cURL devolvio un error:",
    '  if exist "%REPORT_RESPONSE_FILE%" type "%REPORT_RESPONSE_FILE%"',
    '  del /q "%REPORT_RESPONSE_FILE%" 2>nul',
    ") else (",
    '  move /Y "%REPORT_RESPONSE_FILE%" "%REPORT_OUTPUT_FILE%" >nul',
    '  echo Reporte generado: %REPORT_OUTPUT_FILE%',
    ")",
  ].join("\n");
}

function buildPosixCurlCommand({ endpoint, payload, fileName, headers }: { endpoint: string; payload: string; fileName: string; headers: string[] }) {
  const continuation = String.fromCharCode(92);
  return [
    'REPORT_RESPONSE_FILE=".report-response.bin"',
    "REPORT_OUTPUT_FILE=" + quotePosix(fileName),
    "curl -sS --fail-with-body --request POST",
    "  " + quotePosix(endpoint) + " " + continuation,
    ...headers.map((header) => "  -H " + quotePosix(header) + " " + continuation),
    "  --data-raw " + quotePosix(payload) + " " + continuation,
    '  --output "$REPORT_RESPONSE_FILE"',
    "REPORT_EXIT_CODE=$?",
    "if [ \"$REPORT_EXIT_CODE\" -ne 0 ]; then",
    "  echo \"No se pudo generar el reporte. cURL devolvio un error:\"",
    '  [ -f "$REPORT_RESPONSE_FILE" ] && cat "$REPORT_RESPONSE_FILE"',
    '  rm -f "$REPORT_RESPONSE_FILE"',
    "elif [ ! -s \"$REPORT_RESPONSE_FILE\" ]; then",
    "  echo \"La respuesta fue vacia; no se creo el archivo final.\"",
    '  rm -f "$REPORT_RESPONSE_FILE"',
    "else",
    '  mv -f "$REPORT_RESPONSE_FILE" "$REPORT_OUTPUT_FILE"',
    '  echo "Reporte generado: $REPORT_OUTPUT_FILE"',
    "fi",
  ].join("\n");
}

function buildCurlCommands({
  accessToken,
  data,
  endpoint,
  fileName,
  format,
  templateCode,
  templateVersion,
}: {
  accessToken: string | null;
  data: Record<string, unknown>;
  endpoint: string;
  fileName: string;
  format: ReportFormat;
  templateCode: string;
  templateVersion?: number;
}) {
  const payload = JSON.stringify({
    data,
    fileName: fileName || `reporte.${format.toLowerCase()}`,
    outputFormat: format,
    templateCode: templateCode.trim(),
    templateVersion,
  });
  const safeEndpoint = normalizeCurlEndpoint(endpoint);
  const safeFileName = safeOutputFileName(fileName, format);
  const token = accessToken || "REEMPLAZA_CON_TU_TOKEN";
  const headers = ["Authorization: Bearer " + token, "Content-Type: application/json", "Accept: */*"];
  const posixArguments = [
    "curl -X POST",
    quotePosix(safeEndpoint),
    ...headers.map((header) => `-H ${quotePosix(header)}`),
    `--data-raw ${quotePosix(payload)}`,
  ];
  const posixCommand = buildPosixCurlCommand({ endpoint: safeEndpoint, payload, fileName: safeFileName, headers });
  const postmanCommand = posixArguments.join(" ");
  const powershellCommand = buildPowerShellCurlCommand({ endpoint: safeEndpoint, payload, fileName: safeFileName, headers });
  const cmdCommand = buildCmdCurlCommand({ endpoint: safeEndpoint, payload, fileName: safeFileName, headers });

  return { powershell: powershellCommand, cmd: cmdCommand, posix: posixCommand, postman: postmanCommand } satisfies Record<CurlVariant, string>;
}

function JsonCodeEditor({ value, onChange, ariaLabel, height = "280px" }: { value: string; onChange: (value: string) => void; ariaLabel: string; height?: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current) return;

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          json(),
          linter(jsonParseLinter(), { delay: 240 }),
          EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
          EditorView.theme({
            "&": { backgroundColor: "#132a41", color: "#d7e6f5", height: "100%" },
            ".cm-content": { caretColor: "#f6fbff", minHeight: "100%", padding: "12px" },
            ".cm-gutters": { backgroundColor: "#10243a", borderRight: "1px solid #25435d", color: "#7593af" },
            ".cm-activeLine": { backgroundColor: "rgba(37, 116, 207, .16)" },
            ".cm-activeLineGutter": { backgroundColor: "#1d3b59", color: "#f6fbff" },
            ".cm-selectionBackground, ::selection": { backgroundColor: "rgba(134, 183, 255, .35)" },
            ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", overflow: "auto" },
            ".cm-focused": { outline: "none" }
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          })
        ]
      })
    });

    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [ariaLabel]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }, [value]);

  return <div className="report-json-editor" style={{ height }}><div ref={hostRef} /></div>;
}

function StatusBadge({ value }: { value?: string | null }) {
  const normalized = value?.toUpperCase() || "-";
  const positive = ["ACTIVE", "COMPLETED", "OK"].includes(normalized);
  const warning = ["DRAFT", "PENDING", "RUNNING"].includes(normalized);
  return <span className={`report-status ${positive ? "report-status-positive" : warning ? "report-status-warning" : "report-status-neutral"}`}>{normalized}</span>;
}

function PanelHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="report-panel-heading"><div><p className="report-eyebrow">{eyebrow}</p><h2>{title}</h2>{description ? <p className="report-panel-description">{description}</p> : null}</div>{action}</div>;
}

function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="report-alert report-alert-error"><AlertCircle size={18} aria-hidden="true" /><div><strong>No se pudo completar la operacion</strong><p>{message}</p></div>{onRetry ? <button className="report-button report-button-secondary" type="button" onClick={onRetry}><RefreshCw size={15} aria-hidden="true" /> Reintentar</button> : null}</div>;
}

function ParameterTable({ parameters }: { parameters: TemplateParameter[] }) {
  if (!parameters.length) return <div className="report-empty-small">No hay parametros declarados para esta version.</div>;
  return <div className="report-table-wrap"><table><thead><tr><th scope="col">Nombre</th><th scope="col">Ruta</th><th scope="col">Tipo</th><th scope="col">Reglas</th><th scope="col">Descripcion</th></tr></thead><tbody>{parameters.map((parameter) => <tr key={`${parameter.path}-${parameter.name}`}><td><strong>{parameter.name}</strong></td><td><code>{parameter.path}</code></td><td><span className="report-type-tag">{parameter.dataType}</span></td><td>{parameter.required ? "Obligatorio" : "Opcional"}{parameter.collection ? " · Coleccion" : ""}{parameter.repeated ? " · Repetible" : ""}</td><td>{parameter.description || "-"}</td></tr>)}</tbody></table></div>;
}

export default function ReportServiceRuntime({ accessToken }: { accessToken: string | null }) {
  const [catalog, setCatalog] = useState<ReportTemplate[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [health, setHealth] = useState<ServiceStatus | null>(null);
  const [filter, setFilter] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
  const [details, setDetails] = useState<TemplateVersion | null>(null);
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [parameters, setParameters] = useState<TemplateParameter[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [templateDownloadLoading, setTemplateDownloadLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCode, setUploadCode] = useState("");
  const [uploadName, setUploadName] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadVersion, setUploadVersion] = useState("1");
  const [uploadActivate, setUploadActivate] = useState(true);
  const [uploadSchema, setUploadSchema] = useState("[]");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  const [generateData, setGenerateData] = useState("{}");
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generatedFile, setGeneratedFile] = useState<{ blob: Blob; fileName: string } | null>(null);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [generateRequestFeedback, setGenerateRequestFeedback] = useState<{ message: string; error: boolean }>({ message: "", error: false });

  const [batchData, setBatchData] = useState(defaultBatchData);
  const [batchLoading, setBatchLoading] = useState(false);
  const [jobId, setJobId] = useState("");
  const [job, setJob] = useState<ReportJob | null>(null);
  const [jobLoading, setJobLoading] = useState(false);
  const [jobsModalOpen, setJobsModalOpen] = useState(false);
  const [curlModalOpen, setCurlModalOpen] = useState(false);
  const [curlVariant, setCurlVariant] = useState<CurlVariant>("powershell");
  const [curlCopied, setCurlCopied] = useState(false);

  const visibleCatalog = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return query ? catalog.filter((item) => [item.code, item.name, item.documentType, item.status].some((value) => value?.toLowerCase().includes(query))) : catalog;
  }, [catalog, filter]);

  const generateRequest = useMemo(() => {
    try {
      return parseGenerateRequest(generateData);
    } catch {
      return null;
    }
  }, [generateData]);
  const curlCommands = useMemo(() => {
    const request = generateRequest || {
      data: {},
      fileName: "reporte.xlsx",
      outputFormat: "XLSX" as ReportFormat,
      templateCode: "",
      templateVersion: undefined,
    };
    const endpoint = typeof window === "undefined"
      ? "http://localhost:3008/api/report/reports/generate"
      : `${window.location.origin}/api/report/reports/generate`;
    return buildCurlCommands({ accessToken, data: request.data, endpoint, fileName: request.fileName, format: request.outputFormat, templateCode: request.templateCode, templateVersion: request.templateVersion });
  }, [accessToken, generateRequest]);
  const curlCommand = curlCommands[curlVariant];

  useEffect(() => {
    if (!uploadModalOpen && !detailsModalOpen && !generateModalOpen && !jobsModalOpen && !curlModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || uploadLoading || generateLoading || batchLoading || jobLoading) return;
      setUploadModalOpen(false);
      setDetailsModalOpen(false);
      setGenerateModalOpen(false);
      setJobsModalOpen(false);
      setCurlModalOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [batchLoading, curlModalOpen, detailsModalOpen, generateLoading, generateModalOpen, jobLoading, jobsModalOpen, uploadLoading, uploadModalOpen]);

  async function loadCatalog() {
    setCatalogLoading(true);
    setCatalogError("");
    setActionError("");
    try {
      const [items, status] = await Promise.all([
        requestJson<ReportTemplate[]>("templates", accessToken),
        requestJson<ServiceStatus>("report/health", accessToken),
      ]);
      setCatalog(items);
      setHealth(status);
      setSelectedCode((current) => current && items.some((item) => item.code === current) ? current : items[0]?.code || "");
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : "El servicio de reportes no esta disponible.");
      setHealth(null);
    } finally {
      setCatalogLoading(false);
    }
  }

  useEffect(() => { void loadCatalog(); }, [accessToken]);

  useEffect(() => {
    if (!selectedCode) {
      setDetails(null);
      setVersions([]);
      setParameters([]);
      return;
    }
    let cancelled = false;
    setDetailsLoading(true);
    setDetailsError("");
    setDetails(null);
    setVersions([]);
    setParameters([]);
    requestJson<TemplateVersion[]>(`templates/${encodeURIComponent(selectedCode)}/versions`, accessToken).then(async (versionList) => {
      const version = versionList.find((item) => item.status === "ACTIVE") || versionList[0];
      if (!version) throw new Error("No hay versiones disponibles para la plantilla.");
      const [selectedVersion, selectedParameters] = await Promise.all([
        requestJson<TemplateVersion>(`templates/${encodeURIComponent(selectedCode)}/versions/${version.version}`, accessToken),
        requestJson<TemplateParameter[]>(`templates/${encodeURIComponent(selectedCode)}/versions/${version.version}/parameters`, accessToken),
      ]);
      if (cancelled) return;
      setDetails(selectedVersion);
      setVersions(versionList);
      setParameters(selectedParameters);
    }).catch((error) => {
      if (!cancelled) setDetailsError(error instanceof Error ? error.message : "No se pudo cargar el detalle.");
    }).finally(() => { if (!cancelled) setDetailsLoading(false); });
    return () => { cancelled = true; };
  }, [accessToken, selectedCode]);

  useEffect(() => {
    const defaultRequest = buildGenerateRequestJson(selectedCode, details?.version, details?.documentType, parameters);
    setGenerateData(readSavedGenerateRequest(selectedCode, details?.version) || defaultRequest);
  }, [details?.documentType, details?.version, parameters, selectedCode]);

  async function selectVersion(version: string) {
    if (!selectedCode || !version) return;
    setDetailsLoading(true);
    setDetailsError("");
    try {
      const [selectedVersion, selectedParameters] = await Promise.all([
        requestJson<TemplateVersion>(`templates/${encodeURIComponent(selectedCode)}/versions/${version}`, accessToken),
        requestJson<TemplateParameter[]>(`templates/${encodeURIComponent(selectedCode)}/versions/${version}/parameters`, accessToken),
      ]);
      setDetails(selectedVersion);
      setParameters(selectedParameters);
    } catch (error) {
      setDetailsError(error instanceof Error ? error.message : "No se pudo cargar la version.");
    } finally {
      setDetailsLoading(false);
    }
  }

  async function activateVersion() {
    if (!selectedCode || !details) return;
    setActionMessage("");
    setActionError("");
    try {
      await requestJson<unknown>(`templates/${encodeURIComponent(selectedCode)}/versions/${details.version}/activate`, accessToken, { method: "POST" });
      setActionMessage(`La version ${details.version} de ${selectedCode} quedo activa.`);
      await loadCatalog();
      await selectVersion(String(details.version));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo activar la version.");
    }
  }

  async function downloadOriginalTemplate() {
    if (!selectedCode || !details) return;
    setTemplateDownloadLoading(true);
    setActionMessage("");
    setActionError("");
    try {
      const result = await requestBinaryGet(`templates/${encodeURIComponent(selectedCode)}/versions/${details.version}/download`, accessToken);
      downloadBlob(result.blob, result.fileName || details.fileName || `plantilla-${selectedCode.toLowerCase()}-v${details.version}`);
      setActionMessage(`Plantilla original ${result.fileName || details.fileName || ""} descargada correctamente.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo descargar la plantilla original.");
    } finally {
      setTemplateDownloadLoading(false);
    }
  }

  async function deleteTemplate() {
    if (!selectedCode || !window.confirm(`Eliminar logicamente la plantilla ${selectedCode}?`)) return;
    setActionMessage("");
    setActionError("");
    try {
      await requestJson<unknown>(`templates/${encodeURIComponent(selectedCode)}`, accessToken, { method: "DELETE" });
      setActionMessage(`La plantilla ${selectedCode} fue eliminada logicamente.`);
      setSelectedCode("");
      await loadCatalog();
      setDetailsModalOpen(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo eliminar la plantilla.");
    }
  }

  async function uploadTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uploadFile || !uploadCode.trim() || !uploadName.trim()) {
      setActionError("Selecciona un archivo e ingresa el codigo y nombre de la plantilla.");
      return;
    }
    setUploadLoading(true);
    setActionError("");
    setActionMessage("");
    try {
      const form = new FormData();
      form.set("file", uploadFile);
      form.set("code", uploadCode.trim());
      form.set("name", uploadName.trim());
      form.set("description", uploadDescription);
      form.set("version", uploadVersion || "1");
      form.set("activate", String(uploadActivate));
      if (uploadSchema.trim() && uploadSchema.trim() !== "[]") form.set("parameterSchema", uploadSchema);
      await requestJson<TemplateVersion>("templates", accessToken, { body: form, method: "POST" });
      setSelectedCode(uploadCode.trim().toUpperCase());
      setActionMessage(`Plantilla ${uploadCode.trim().toUpperCase()} cargada correctamente.`);
      await loadCatalog();
      setUploadModalOpen(false);
      setDetailsModalOpen(true);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo cargar la plantilla.");
    } finally {
      setUploadLoading(false);
    }
  }

  async function generateReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGenerateLoading(true);
    setActionError("");
    try {
      const payload = parseGenerateRequest(generateData);
      const template = catalog.find((item) => item.code === payload.templateCode);
      const availableFormats = template?.documentType?.toUpperCase() === "DOCX" ? ["DOCX", "PDF"] : ["XLSX"];
      if (!availableFormats.includes(payload.outputFormat)) {
        throw new Error(`El formato ${payload.outputFormat} no es compatible con la plantilla seleccionada.`);
      }
      const result = await requestBinary("reports/generate", accessToken, JSON.stringify(payload));
      const fileName = result.fileName || payload.fileName;
      setGeneratedFile({ blob: result.blob, fileName });
      downloadBlob(result.blob, fileName);
      setActionMessage("Documento generado por report-service.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "El JSON de entrada no es valido.");
    } finally {
      setGenerateLoading(false);
    }
  }

  async function createJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBatchLoading(true);
    setActionError("");
    try {
      const payload = parseObjectJson(batchData);
      const result = await requestJson<ReportJob>("report-jobs", accessToken, { body: JSON.stringify(payload), headers: { "Content-Type": "application/json" }, method: "POST" });
      setJob(result);
      setJobId(result.id);
      setActionMessage(`Lote creado: ${result.id}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "El JSON del lote no es valido.");
    } finally {
      setBatchLoading(false);
    }
  }

  async function refreshJob() {
    if (!jobId.trim()) return;
    setJobLoading(true);
    setActionError("");
    try {
      setJob(await requestJson<ReportJob>(`report-jobs/${encodeURIComponent(jobId.trim())}`, accessToken));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo consultar el lote.");
    } finally {
      setJobLoading(false);
    }
  }

  async function cancelJob() {
    if (!jobId.trim()) return;
    setJobLoading(true);
    setActionError("");
    try {
      await requestJson<unknown>(`report-jobs/${encodeURIComponent(jobId.trim())}/cancel`, accessToken, { method: "POST" });
      setActionMessage("Solicitud de cancelacion enviada.");
      await refreshJob();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo cancelar el lote.");
    } finally {
      setJobLoading(false);
    }
  }

  async function downloadJob() {
    if (!jobId.trim()) return;
    setJobLoading(true);
    setActionError("");
    try {
      const headers = new Headers();
      if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
      const response = await fetch(proxyUrl(`report-jobs/${encodeURIComponent(jobId.trim())}/download`), { headers, cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new ReportRequestError(readableError(payload, `No se pudo descargar el lote (${response.status}).`), response.status);
      }
      downloadBlob(await response.blob(), fileNameFromHeader(response.headers.get("content-disposition")) || job?.zipFileName || "reportes.zip");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo descargar el lote.");
    } finally {
      setJobLoading(false);
    }
  }

  function openGenerateModal(code: string) {
    setSelectedCode(code);
    setGeneratedFile(null);
    setGenerateRequestFeedback({ message: "", error: false });
    setGenerateModalOpen(true);
  }

  function saveGenerateRequestDraft() {
    try {
      const normalized = saveGenerateRequest(selectedCode, details?.version, generateData);
      setGenerateData(normalized);
      setGenerateRequestFeedback({ message: "Solicitud JSON guardada para esta plantilla y version.", error: false });
    } catch (error) {
      setGenerateRequestFeedback({ message: error instanceof Error ? error.message : "La solicitud JSON no es valida.", error: true });
    }
  }

  function resetGenerateRequestDraft() {
    const saved = readSavedGenerateRequest(selectedCode, details?.version);
    if (!saved) {
      setGenerateRequestFeedback({ message: "No existe una solicitud guardada para esta plantilla y version.", error: true });
      return;
    }
    setGenerateData(saved);
    setGenerateRequestFeedback({ message: "Se restauro la solicitud JSON guardada.", error: false });
  }

  function openJobsModal(code: string) {
    setSelectedCode(code);
    setBatchData((current) => {
      try {
        return JSON.stringify({ ...parseObjectJson(current), templateCode: code }, null, 2);
      } catch {
        return current;
      }
    });
    setJob(null);
    setJobId("");
    setActionError("");
    setJobsModalOpen(true);
  }

  function openCurlModal(code: string) {
    setSelectedCode(code);
    setCurlVariant("powershell");
    setCurlCopied(false);
    setCurlModalOpen(true);
  }

  async function copyCurlCommand() {
    try {
      await copyTextToClipboard(curlCommand);
      setActionError("");
      setCurlCopied(true);
    } catch {
      setActionError("No se pudo copiar el cURL al portapapeles.");
    }
  }

  return <main className="report-shell">
    <header className="report-header">
      <div className="report-brand"><div className="report-brand-mark"><FileText size={23} aria-hidden="true" /></div><div><p className="report-eyebrow">REPORT SERVICE</p><h1>Consola de pruebas de reportes</h1><p className="report-subtitle">Prueba el catalogo, las plantillas versionadas y la generacion de documentos sin salir del navegador.</p></div></div>
      <div className="report-header-actions"><span className={`report-connection ${catalogLoading ? "report-connection-loading" : catalogError ? "report-connection-error" : "report-connection-ok"}`}>{catalogLoading ? <LoaderCircle className="report-spin" size={15} aria-hidden="true" /> : catalogError ? <CloudOff size={15} aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />}{catalogLoading ? "Comprobando" : catalogError ? "Desconectado" : "Conectado"}</span><button className="report-button report-button-secondary" type="button" onClick={() => void loadCatalog()} disabled={catalogLoading}><RefreshCw size={15} aria-hidden="true" /> Actualizar</button></div>
    </header>

    <div className="report-service-strip"><Server size={16} aria-hidden="true" /><span><strong>report-service</strong> · {health?.service || "Servicio Quarkus"}</span><span className="report-service-strip-meta">{health?.runtime || "Proxy server-side"}{health?.checkedAt ? ` · ${formatDate(health.checkedAt)}` : ""}</span></div>
    {actionMessage ? <div className="report-alert report-alert-success"><CheckCircle2 size={18} aria-hidden="true" /><p>{actionMessage}</p><button className="report-icon-button" type="button" title="Cerrar mensaje" aria-label="Cerrar mensaje" onClick={() => setActionMessage("")}><XCircle size={16} aria-hidden="true" /></button></div> : null}
    {actionError ? <ErrorBox message={actionError} onRetry={() => setActionError("")} /> : null}

    <section className="report-panel"><PanelHeading eyebrow="CATALOGO" title="Plantillas disponibles" description="Consulta las plantillas y selecciona una para inspeccionar sus versiones y parametros." action={<span className="report-count">{visibleCatalog.length} de {catalog.length}</span>} />
      <div className="report-toolbar"><label className="report-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Buscar plantilla</span><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Buscar por codigo, nombre o estado" /></label><button className="report-button report-button-primary" type="button" onClick={() => setUploadModalOpen(true)}><Upload size={15} aria-hidden="true" /> Cargar plantilla</button></div>
      {catalogError ? <ErrorBox message={catalogError} onRetry={() => void loadCatalog()} /> : catalogLoading ? <div className="report-loading"><LoaderCircle className="report-spin" size={24} aria-hidden="true" /> Cargando catalogo...</div> : visibleCatalog.length ? <div className="report-table-wrap report-catalog-table"><table><thead><tr><th scope="col">Codigo</th><th scope="col">Nombre</th><th scope="col">Tipo</th><th scope="col">Estado</th><th scope="col">Version activa</th><th scope="col"><span className="sr-only">Acciones</span></th></tr></thead><tbody>{visibleCatalog.map((item) => <tr key={item.code} className={selectedCode === item.code ? "report-row-selected" : undefined}><td><button className="report-link-button" type="button" onClick={() => { setSelectedCode(item.code); setDetailsModalOpen(true); }}>{item.code}</button></td><td><strong>{item.name}</strong><small>{item.description || "Sin descripcion"}</small></td><td><span className="report-type-tag">{item.documentType || "-"}</span></td><td><StatusBadge value={item.status} /></td><td>{item.activeVersion ? `v${item.activeVersion}` : "-"}</td><td><div className="report-row-actions"><button className="report-button report-button-compact" type="button" onClick={() => openGenerateModal(item.code)}><FileSpreadsheet size={14} aria-hidden="true" /> Generar documento</button><button className="report-button report-button-compact" type="button" onClick={() => openJobsModal(item.code)}><FileArchive size={14} aria-hidden="true" /> Lotes ZIP</button><button className="report-button report-button-compact" type="button" onClick={() => openCurlModal(item.code)}><Terminal size={14} aria-hidden="true" /> cURL</button></div></td></tr>)}</tbody></table></div> : <div className="report-empty"><Search size={30} aria-hidden="true" /><strong>{catalog.length ? "No hay coincidencias" : "El catalogo esta vacio"}</strong><p>{catalog.length ? "Prueba otro texto de busqueda." : "Carga la primera plantilla para comenzar."}</p></div>}
    </section>

    {uploadModalOpen ? <div className="report-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !uploadLoading) setUploadModalOpen(false); }}>
      <section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="upload-template-title">
        <div className="report-modal-header"><div><p className="report-eyebrow">MULTIPART</p><h2 id="upload-template-title">Cargar plantilla</h2><p className="report-panel-description">Crea una plantilla o agrega una nueva version conservando el historial.</p></div><button className="report-icon-button" type="button" title="Cerrar carga de plantilla" aria-label="Cerrar carga de plantilla" onClick={() => setUploadModalOpen(false)} disabled={uploadLoading}><XCircle size={17} aria-hidden="true" /></button></div>
        <form className="report-form report-modal-form" onSubmit={uploadTemplate}><div className="report-form-grid"><label>Archivo de plantilla *<input type="file" accept=".xlsx,.docx" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} required /><small>{uploadFile ? `${uploadFile.name} · ${formatBytes(uploadFile.size)}` : "Formatos permitidos: XLSX y DOCX."}</small></label><label>Codigo *<input value={uploadCode} onChange={(event) => setUploadCode(event.target.value)} placeholder="VENTAS_MENSUALES" required /></label><label>Nombre *<input value={uploadName} onChange={(event) => setUploadName(event.target.value)} placeholder="Ventas mensuales" required /></label><label>Version<input type="number" min="1" value={uploadVersion} onChange={(event) => setUploadVersion(event.target.value)} /></label></div><label>Descripcion<textarea rows={2} value={uploadDescription} onChange={(event) => setUploadDescription(event.target.value)} placeholder="Descripcion visible en el catalogo" /></label><label className="report-check-row"><input type="checkbox" checked={uploadActivate} onChange={(event) => setUploadActivate(event.target.checked)} /> Activar esta version despues de cargarla</label><label>parameterSchema <span className="report-help">Arreglo JSON opcional para declarar parametros que el extractor no encuentre.</span><JsonCodeEditor ariaLabel="parameterSchema JSON" height="190px" onChange={setUploadSchema} value={uploadSchema} /></label><div className="report-form-actions"><button className="report-button report-button-secondary" type="button" onClick={() => setUploadModalOpen(false)} disabled={uploadLoading}>Cancelar</button><button className="report-button report-button-primary" type="submit" disabled={uploadLoading}>{uploadLoading ? <LoaderCircle className="report-spin" size={16} aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}{uploadLoading ? "Cargando..." : "Cargar plantilla"}</button></div></form>
      </section>
    </div> : null}

    {detailsModalOpen ? <div className="report-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailsModalOpen(false); }}>
      <section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="details-modal-title">
        <div className="report-modal-header"><div><p className="report-eyebrow">INSPECCION</p><h2 id="details-modal-title">Versiones y parametros</h2><p className="report-panel-description">Consulta el contrato que report-service detecto o recibio para cada version.</p></div><div className="report-modal-header-actions">{selectedCode ? <span className="report-selected-code">{selectedCode}</span> : null}<button className="report-icon-button" type="button" title="Cerrar detalle" aria-label="Cerrar detalle" onClick={() => setDetailsModalOpen(false)}><XCircle size={17} aria-hidden="true" /></button></div></div>
        {!selectedCode ? <div className="report-empty"><strong>Selecciona una plantilla</strong><p>Vuelve al catalogo y elige una plantilla para consultar sus versiones.</p></div> : detailsLoading ? <div className="report-loading"><LoaderCircle className="report-spin" size={24} aria-hidden="true" /> Cargando detalle...</div> : detailsError ? <ErrorBox message={detailsError} onRetry={() => void selectVersion(String(details?.version || 1))} /> : details ? <div className="report-details report-modal-details"><div className="report-detail-grid"><div><span>Archivo</span><strong>{details.fileName || "-"}</strong></div><div><span>Tipo</span><strong>{details.documentType || "-"}</strong></div><div><span>Estado</span><StatusBadge value={details.status} /></div><div><span>Tamano</span><strong>{formatBytes(details.fileSize)}</strong></div><div><span>Creado por</span><strong>{details.createdBy || "-"}</strong></div><div><span>Checksum</span><code>{details.checksumSha256 ? `${details.checksumSha256.slice(0, 18)}...` : "-"}</code></div></div><div className="report-version-toolbar"><label>Version consultada<select value={String(details.version)} onChange={(event) => void selectVersion(event.target.value)}>{versions.map((version) => <option key={version.version} value={version.version}>v{version.version} · {version.status}</option>)}</select></label><div className="report-inline-actions"><button className="report-button report-button-secondary" type="button" onClick={() => void downloadOriginalTemplate()} disabled={templateDownloadLoading}><Download size={15} aria-hidden="true" /> {templateDownloadLoading ? "Descargando..." : "Descargar plantilla original"}</button><button className="report-button report-button-secondary" type="button" onClick={activateVersion} disabled={details.status === "ACTIVE"}><CheckCircle2 size={15} aria-hidden="true" /> Activar version</button><button className="report-button report-button-danger" type="button" onClick={() => void deleteTemplate()}><XCircle size={15} aria-hidden="true" /> Eliminar plantilla</button></div></div><div className="report-subpanel"><div className="report-subpanel-heading"><div><p className="report-eyebrow">CONTRATO</p><h3>Parametros de la version</h3></div><button className="report-icon-button" type="button" title="Copiar parametros JSON" aria-label="Copiar parametros JSON" onClick={() => void navigator.clipboard?.writeText(JSON.stringify(parameters, null, 2))}><Clipboard size={16} aria-hidden="true" /></button></div><ParameterTable parameters={parameters} /></div><div className="report-details-actions"><button className="report-button report-button-primary" type="button" onClick={() => { setDetailsModalOpen(false); openGenerateModal(selectedCode); }}><Play size={15} aria-hidden="true" /> Probar generacion</button><span>Creada: {formatDate(details.createdAt)} · Activada: {formatDate(details.activatedAt)}</span></div></div> : null}
      </section>
    </div> : null}

    {generateModalOpen ? <div className="report-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !generateLoading) setGenerateModalOpen(false); }}>
      <section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="generate-modal-title">
        <div className="report-modal-header"><div><p className="report-eyebrow">GENERACION INDIVIDUAL</p><h2 id="generate-modal-title">Generar documento</h2><p className="report-panel-description">Ejecuta POST /api/v1/reports/generate y descarga la respuesta binaria.</p></div><button className="report-icon-button" type="button" title="Cerrar generacion" aria-label="Cerrar generacion" onClick={() => setGenerateModalOpen(false)} disabled={generateLoading}><XCircle size={17} aria-hidden="true" /></button></div>
        <form className="report-form report-modal-form" onSubmit={generateReport}><label>Solicitud JSON <span className="report-help">Edita directamente los datos y las opciones de generacion: <code>data</code>, <code>fileName</code>, <code>outputFormat</code>, <code>templateCode</code> y <code>templateVersion</code>.</span><JsonCodeEditor ariaLabel="Solicitud JSON completa para generar el documento" height="430px" onChange={setGenerateData} value={generateData} /></label>{generateRequestFeedback.message ? <p className={generateRequestFeedback.error ? "report-help report-form-feedback report-form-feedback-error" : "report-help report-form-feedback"}>{generateRequestFeedback.message}</p> : null}<div className="report-form-actions"><button className="report-button report-button-secondary" type="button" onClick={saveGenerateRequestDraft} disabled={generateLoading || detailsLoading}><Save size={16} aria-hidden="true" /> Guardar</button><button className="report-button report-button-secondary" type="button" onClick={resetGenerateRequestDraft} disabled={generateLoading || detailsLoading}><RotateCcw size={16} aria-hidden="true" /> Reset</button><button className="report-button report-button-secondary" type="button" onClick={() => setGenerateModalOpen(false)} disabled={generateLoading}>Cancelar</button><button className="report-button report-button-primary" type="submit" disabled={generateLoading || detailsLoading}>{generateLoading ? <LoaderCircle className="report-spin" size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}{generateLoading ? "Generando..." : detailsLoading ? "Cargando parametros..." : "Generar documento"}</button></div></form>{generatedFile ? <div className="report-download-result"><CheckCircle2 size={18} aria-hidden="true" /><div><strong>Documento listo</strong><p>{generatedFile.fileName}</p></div><button className="report-button report-button-secondary" type="button" onClick={() => downloadBlob(generatedFile.blob, generatedFile.fileName)}><Download size={15} aria-hidden="true" /> Descargar</button></div> : null}
      </section>
    </div> : null}

    {jobsModalOpen ? <div className="report-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !batchLoading && !jobLoading) setJobsModalOpen(false); }}>
      <section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="jobs-modal-title">
        <div className="report-modal-header"><div><p className="report-eyebrow">PROCESAMIENTO ASINCRONO</p><h2 id="jobs-modal-title">Lotes ZIP</h2><p className="report-panel-description">Crea un lote, consulta su estado, cancelalo o descarga el ZIP completado.</p></div><button className="report-icon-button" type="button" title="Cerrar lotes ZIP" aria-label="Cerrar lotes ZIP" onClick={() => setJobsModalOpen(false)} disabled={batchLoading || jobLoading}><XCircle size={17} aria-hidden="true" /></button></div>
        <form className="report-form report-modal-form" onSubmit={createJob}><label>Cuerpo de POST /api/v1/report-jobs<JsonCodeEditor ariaLabel="Cuerpo JSON de report jobs" height="360px" onChange={setBatchData} value={batchData} /></label><div className="report-form-actions"><button className="report-button report-button-secondary" type="button" onClick={() => setJobsModalOpen(false)} disabled={batchLoading || jobLoading}>Cancelar</button><button className="report-button report-button-primary" type="submit" disabled={batchLoading}>{batchLoading ? <LoaderCircle className="report-spin" size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}{batchLoading ? "Creando lote..." : "Crear lote"}</button></div></form><div className="report-job-lookup"><label>Id del lote<input value={jobId} onChange={(event) => setJobId(event.target.value)} placeholder="UUID devuelto por el servicio" /></label><div className="report-inline-actions"><button className="report-button report-button-secondary" type="button" onClick={() => void refreshJob()} disabled={jobLoading || !jobId}><RefreshCw size={15} aria-hidden="true" /> Consultar estado</button><button className="report-button report-button-secondary" type="button" onClick={() => void downloadJob()} disabled={jobLoading || !jobId}><Download size={15} aria-hidden="true" /> Descargar ZIP</button><button className="report-button report-button-danger" type="button" onClick={() => void cancelJob()} disabled={jobLoading || !jobId}><XCircle size={15} aria-hidden="true" /> Cancelar</button></div></div>{job ? <div className="report-job-card"><div><span className="report-eyebrow">TRABAJO {job.id}</span><h3>{job.templateCode || "-"} · {job.outputFormat || "-"}</h3></div><StatusBadge value={job.status} /><div className="report-job-metrics"><div><span>Procesados</span><strong>{job.processedItems ?? 0} / {job.totalItems ?? 0}</strong></div><div><span>Exitosos</span><strong>{job.successfulItems ?? 0}</strong></div><div><span>Fallidos</span><strong>{job.failedItems ?? 0}</strong></div><div><span>Expira</span><strong>{formatDate(job.expiresAt)}</strong></div></div>{job.errorMessage ? <p className="report-job-error">{job.errorMessage}</p> : null}</div> : <div className="report-empty-small"><FileArchive size={18} aria-hidden="true" /> Crea un lote para consultar su progreso.</div>}
      </section>
    </div> : null}

    {curlModalOpen ? <div className="report-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !detailsLoading) setCurlModalOpen(false); }}>
      <section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="curl-modal-title">
        <div className="report-curl-content"><div className="report-curl-meta"><span><strong>Plantilla:</strong> {generateRequest?.templateCode || "-"}</span><span><strong>Formato:</strong> {generateRequest?.outputFormat || "-"}</span><span><strong>Archivo:</strong> {generateRequest?.fileName || "-"}</span></div><div className="report-curl-variants" role="tablist" aria-label="Formato del comando cURL">{(Object.keys(curlVariantLabels) as CurlVariant[]).map((variant) => <button className={`report-curl-variant${curlVariant === variant ? " report-curl-variant-active" : ""}`} key={variant} type="button" role="tab" aria-selected={curlVariant === variant} onClick={() => { setCurlVariant(variant); setCurlCopied(false); }}>{curlVariantLabels[variant]}</button>)}</div><label className="report-curl-label">{curlVariantLabels[curlVariant]} listo para copiar<textarea className="report-curl-output" rows={8} readOnly value={curlCommand} onFocus={(event) => event.currentTarget.select()} aria-label={`${curlVariantLabels[curlVariant]} para generar el reporte`} /></label><p className="report-help">En Postman copia la variante <strong>Postman</strong> y usa <strong>Importar &gt; Raw text</strong>. El comando usa el token actual; si no aparece, reemplaza <code>REEMPLAZA_CON_TU_TOKEN</code>.</p><div className="report-form-actions"><button className="report-button report-button-secondary" type="button" onClick={() => setCurlModalOpen(false)}>Cerrar</button><button className="report-button report-button-primary" type="button" onClick={() => void copyCurlCommand()}><Clipboard size={16} aria-hidden="true" /> {curlCopied ? "Copiado" : "Copiar cURL"}</button></div></div>
      </section>
    </div> : null}

    <footer className="report-footer"><span><Server size={14} aria-hidden="true" /> Proxy autenticado del MFE</span><span>Las respuestas del motor son la fuente de verdad.</span></footer>
  </main>;
}
