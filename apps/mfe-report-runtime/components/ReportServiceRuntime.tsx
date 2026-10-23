"use client";

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
  Search,
  Send,
  Server,
  Settings2,
  Upload,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
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

type Tab = "catalog" | "upload" | "details" | "generate" | "jobs";

class ReportRequestError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

function proxyUrl(path: string) {
  return `/api/report/${path.replace(/^\/+/, "")}`;
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
  const [tab, setTab] = useState<Tab>("catalog");
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

  const [generateCode, setGenerateCode] = useState("");
  const [generateVersion, setGenerateVersion] = useState("");
  const [generateFormat, setGenerateFormat] = useState<ReportFormat>("XLSX");
  const [generateFileName, setGenerateFileName] = useState("reporte.xlsx");
  const [generateData, setGenerateData] = useState("{}");
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generatedFile, setGeneratedFile] = useState<{ blob: Blob; fileName: string } | null>(null);

  const [batchData, setBatchData] = useState(defaultBatchData);
  const [batchLoading, setBatchLoading] = useState(false);
  const [jobId, setJobId] = useState("");
  const [job, setJob] = useState<ReportJob | null>(null);
  const [jobLoading, setJobLoading] = useState(false);

  const visibleCatalog = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return query ? catalog.filter((item) => [item.code, item.name, item.documentType, item.status].some((value) => value?.toLowerCase().includes(query))) : catalog;
  }, [catalog, filter]);

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
      setGenerateCode(selectedCode);
      setGenerateVersion(String(selectedVersion.version));
    }).catch((error) => {
      if (!cancelled) setDetailsError(error instanceof Error ? error.message : "No se pudo cargar el detalle.");
    }).finally(() => { if (!cancelled) setDetailsLoading(false); });
    return () => { cancelled = true; };
  }, [accessToken, selectedCode]);

  useEffect(() => {
    setGenerateData(JSON.stringify(buildExampleData(parameters), null, 2));
  }, [details?.version, parameters, selectedCode]);

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
      setGenerateVersion(version);
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

  async function deleteTemplate() {
    if (!selectedCode || !window.confirm(`Eliminar logicamente la plantilla ${selectedCode}?`)) return;
    setActionMessage("");
    setActionError("");
    try {
      await requestJson<unknown>(`templates/${encodeURIComponent(selectedCode)}`, accessToken, { method: "DELETE" });
      setActionMessage(`La plantilla ${selectedCode} fue eliminada logicamente.`);
      setSelectedCode("");
      await loadCatalog();
      setTab("catalog");
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
      setTab("details");
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
      const data = parseObjectJson(generateData);
      const payload = { templateCode: generateCode.trim(), templateVersion: generateVersion ? Number(generateVersion) : undefined, outputFormat: generateFormat, fileName: generateFileName || undefined, data };
      const result = await requestBinary("reports/generate", accessToken, JSON.stringify(payload));
      setGeneratedFile({ blob: result.blob, fileName: result.fileName || generateFileName || `reporte.${generateFormat.toLowerCase()}` });
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

  const navItems: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "catalog", label: "Catalogo", icon: <Search size={16} aria-hidden="true" /> },
    { id: "upload", label: "Cargar plantilla", icon: <Upload size={16} aria-hidden="true" /> },
    { id: "details", label: "Versiones y parametros", icon: <Settings2 size={16} aria-hidden="true" /> },
    { id: "generate", label: "Generar documento", icon: <FileSpreadsheet size={16} aria-hidden="true" /> },
    { id: "jobs", label: "Lotes ZIP", icon: <FileArchive size={16} aria-hidden="true" /> },
  ];

  return <main className="report-shell">
    <header className="report-header">
      <div className="report-brand"><div className="report-brand-mark"><FileText size={23} aria-hidden="true" /></div><div><p className="report-eyebrow">REPORT SERVICE</p><h1>Consola de pruebas de reportes</h1><p className="report-subtitle">Prueba el catalogo, las plantillas versionadas y la generacion de documentos sin salir del navegador.</p></div></div>
      <div className="report-header-actions"><span className={`report-connection ${catalogLoading ? "report-connection-loading" : catalogError ? "report-connection-error" : "report-connection-ok"}`}>{catalogLoading ? <LoaderCircle className="report-spin" size={15} aria-hidden="true" /> : catalogError ? <CloudOff size={15} aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />}{catalogLoading ? "Comprobando" : catalogError ? "Desconectado" : "Conectado"}</span><button className="report-button report-button-secondary" type="button" onClick={() => void loadCatalog()} disabled={catalogLoading}><RefreshCw size={15} aria-hidden="true" /> Actualizar</button></div>
    </header>

    <div className="report-service-strip"><Server size={16} aria-hidden="true" /><span><strong>report-service</strong> · {health?.service || "Servicio Quarkus"}</span><span className="report-service-strip-meta">{health?.runtime || "Proxy server-side"}{health?.checkedAt ? ` · ${formatDate(health.checkedAt)}` : ""}</span></div>
    {actionMessage ? <div className="report-alert report-alert-success"><CheckCircle2 size={18} aria-hidden="true" /><p>{actionMessage}</p><button className="report-icon-button" type="button" title="Cerrar mensaje" aria-label="Cerrar mensaje" onClick={() => setActionMessage("")}><XCircle size={16} aria-hidden="true" /></button></div> : null}
    {actionError ? <ErrorBox message={actionError} onRetry={() => setActionError("")} /> : null}

    <nav className="report-tabs" aria-label="Operaciones de report-service">{navItems.map((item) => <button key={item.id} className={tab === item.id ? "report-tab report-tab-active" : "report-tab"} type="button" onClick={() => setTab(item.id)}>{item.icon}{item.label}</button>)}</nav>

    {tab === "catalog" ? <section className="report-panel"><PanelHeading eyebrow="CATALOGO" title="Plantillas disponibles" description="Consulta las plantillas y selecciona una para inspeccionar sus versiones y parametros." action={<span className="report-count">{visibleCatalog.length} de {catalog.length}</span>} />
      <div className="report-toolbar"><label className="report-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Buscar plantilla</span><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Buscar por codigo, nombre o estado" /></label><button className="report-button report-button-primary" type="button" onClick={() => setTab("upload")}><Upload size={15} aria-hidden="true" /> Cargar plantilla</button></div>
      {catalogError ? <ErrorBox message={catalogError} onRetry={() => void loadCatalog()} /> : catalogLoading ? <div className="report-loading"><LoaderCircle className="report-spin" size={24} aria-hidden="true" /> Cargando catalogo...</div> : visibleCatalog.length ? <div className="report-table-wrap report-catalog-table"><table><thead><tr><th scope="col">Codigo</th><th scope="col">Nombre</th><th scope="col">Tipo</th><th scope="col">Estado</th><th scope="col">Version activa</th><th scope="col"><span className="sr-only">Acciones</span></th></tr></thead><tbody>{visibleCatalog.map((item) => <tr key={item.code} className={selectedCode === item.code ? "report-row-selected" : undefined}><td><button className="report-link-button" type="button" onClick={() => { setSelectedCode(item.code); setTab("details"); }}>{item.code}</button></td><td><strong>{item.name}</strong><small>{item.description || "Sin descripcion"}</small></td><td><span className="report-type-tag">{item.documentType || "-"}</span></td><td><StatusBadge value={item.status} /></td><td>{item.activeVersion ? `v${item.activeVersion}` : "-"}</td><td><button className="report-button report-button-compact" type="button" onClick={() => { setSelectedCode(item.code); setTab("details"); }}>Ver detalle</button></td></tr>)}</tbody></table></div> : <div className="report-empty"><Search size={30} aria-hidden="true" /><strong>{catalog.length ? "No hay coincidencias" : "El catalogo esta vacio"}</strong><p>{catalog.length ? "Prueba otro texto de busqueda." : "Carga la primera plantilla para comenzar."}</p></div>}
    </section> : null}

    {tab === "upload" ? <section className="report-panel"><PanelHeading eyebrow="MULTIPART" title="Cargar plantilla" description="Crea una plantilla o agrega una nueva version conservando el historial." />
      <form className="report-form" onSubmit={uploadTemplate}><div className="report-form-grid"><label>Archivo de plantilla *<input type="file" accept=".xlsx,.docx" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} required /><small>{uploadFile ? `${uploadFile.name} · ${formatBytes(uploadFile.size)}` : "Formatos permitidos: XLSX y DOCX."}</small></label><label>Codigo *<input value={uploadCode} onChange={(event) => setUploadCode(event.target.value)} placeholder="VENTAS_MENSUALES" required /></label><label>Nombre *<input value={uploadName} onChange={(event) => setUploadName(event.target.value)} placeholder="Ventas mensuales" required /></label><label>Version<input type="number" min="1" value={uploadVersion} onChange={(event) => setUploadVersion(event.target.value)} /></label></div><label>Descripcion<textarea rows={2} value={uploadDescription} onChange={(event) => setUploadDescription(event.target.value)} placeholder="Descripcion visible en el catalogo" /></label><label className="report-check-row"><input type="checkbox" checked={uploadActivate} onChange={(event) => setUploadActivate(event.target.checked)} /> Activar esta version despues de cargarla</label><label>parameterSchema <span className="report-help">Arreglo JSON opcional para declarar parametros que el extractor no encuentre.</span><textarea className="report-code-area" rows={8} value={uploadSchema} onChange={(event) => setUploadSchema(event.target.value)} /></label><div className="report-form-actions"><button className="report-button report-button-secondary" type="button" onClick={() => setTab("catalog")}>Cancelar</button><button className="report-button report-button-primary" type="submit" disabled={uploadLoading}>{uploadLoading ? <LoaderCircle className="report-spin" size={16} aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}{uploadLoading ? "Cargando..." : "Cargar plantilla"}</button></div></form>
    </section> : null}

    {tab === "details" ? <section className="report-panel"><PanelHeading eyebrow="INSPECCION" title="Versiones y parametros" description="Consulta el contrato que report-service detecto o recibio para cada version." action={selectedCode ? <span className="report-selected-code">{selectedCode}</span> : null} />
      {!selectedCode ? <div className="report-empty"><Settings2 size={30} aria-hidden="true" /><strong>Selecciona una plantilla</strong><p>Vuelve al catalogo y elige una plantilla para consultar sus versiones.</p><button className="report-button report-button-primary" type="button" onClick={() => setTab("catalog")}>Abrir catalogo</button></div> : detailsLoading ? <div className="report-loading"><LoaderCircle className="report-spin" size={24} aria-hidden="true" /> Cargando detalle...</div> : detailsError ? <ErrorBox message={detailsError} onRetry={() => { setSelectedCode(selectedCode); void selectVersion(String(details?.version || 1)); }} /> : details ? <div className="report-details"><div className="report-detail-grid"><div><span>Archivo</span><strong>{details.fileName || "-"}</strong></div><div><span>Tipo</span><strong>{details.documentType || "-"}</strong></div><div><span>Estado</span><StatusBadge value={details.status} /></div><div><span>Tamano</span><strong>{formatBytes(details.fileSize)}</strong></div><div><span>Creado por</span><strong>{details.createdBy || "-"}</strong></div><div><span>Checksum</span><code>{details.checksumSha256 ? `${details.checksumSha256.slice(0, 18)}...` : "-"}</code></div></div><div className="report-version-toolbar"><label>Version consultada<select value={String(details.version)} onChange={(event) => void selectVersion(event.target.value)}>{versions.map((version) => <option key={version.version} value={version.version}>v{version.version} · {version.status}</option>)}</select></label><div className="report-inline-actions"><button className="report-button report-button-secondary" type="button" onClick={activateVersion} disabled={details.status === "ACTIVE"}><CheckCircle2 size={15} aria-hidden="true" /> Activar version</button><button className="report-button report-button-danger" type="button" onClick={() => void deleteTemplate()}><XCircle size={15} aria-hidden="true" /> Eliminar plantilla</button></div></div><div className="report-subpanel"><div className="report-subpanel-heading"><div><p className="report-eyebrow">CONTRATO</p><h3>Parametros de la version</h3></div><button className="report-icon-button" type="button" title="Copiar parametros JSON" aria-label="Copiar parametros JSON" onClick={() => void navigator.clipboard?.writeText(JSON.stringify(parameters, null, 2))}><Clipboard size={16} aria-hidden="true" /></button></div><ParameterTable parameters={parameters} /></div><div className="report-details-actions"><button className="report-button report-button-primary" type="button" onClick={() => { setGenerateCode(selectedCode); setTab("generate"); }}><Play size={15} aria-hidden="true" /> Probar generacion</button><span>Creada: {formatDate(details.createdAt)} · Activada: {formatDate(details.activatedAt)}</span></div></div> : null}
    </section> : null}

    {tab === "generate" ? <section className="report-panel"><PanelHeading eyebrow="GENERACION INDIVIDUAL" title="Generar documento" description="Ejecuta POST /api/v1/reports/generate y descarga la respuesta binaria." />
      <form className="report-form" onSubmit={generateReport}><div className="report-form-grid"><label>Codigo de plantilla *<select value={generateCode} onChange={(event) => { const code = event.target.value; setGenerateCode(code); setSelectedCode(code); }} required><option value="">Selecciona una plantilla</option>{catalog.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}</select></label><label>Version<input type="number" min="1" value={generateVersion} onChange={(event) => setGenerateVersion(event.target.value)} onBlur={(event) => { if (event.target.value) void selectVersion(event.target.value); }} placeholder="Activa" /></label><label>Formato<select value={generateFormat} onChange={(event) => { const next = event.target.value as ReportFormat; setGenerateFormat(next); setGenerateFileName(`reporte.${next.toLowerCase()}`); }}><option value="XLSX">XLSX</option><option value="DOCX">DOCX</option><option value="PDF">PDF</option></select></label><label>Nombre de archivo<input value={generateFileName} onChange={(event) => setGenerateFileName(event.target.value)} /></label></div><label>data / parameters <span className="report-help">Ejemplo generado desde {parameters.length} parametro{parameters.length === 1 ? "" : "s"} de la version seleccionada. Puedes editarlo antes de probar. El backend acepta `data`; `parameters` se mantiene como alias de compatibilidad.</span><textarea className="report-code-area" rows={16} value={generateData} onChange={(event) => setGenerateData(event.target.value)} /></label><div className="report-form-actions"><button className="report-button report-button-primary" type="submit" disabled={generateLoading || detailsLoading}>{generateLoading ? <LoaderCircle className="report-spin" size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}{generateLoading ? "Generando..." : detailsLoading ? "Cargando parametros..." : "Generar documento"}</button></div></form>{generatedFile ? <div className="report-download-result"><CheckCircle2 size={18} aria-hidden="true" /><div><strong>Documento listo</strong><p>{generatedFile.fileName}</p></div><button className="report-button report-button-secondary" type="button" onClick={() => downloadBlob(generatedFile.blob, generatedFile.fileName)}><Download size={15} aria-hidden="true" /> Descargar</button></div> : null}
    </section> : null}

    {tab === "jobs" ? <section className="report-panel"><PanelHeading eyebrow="PROCESAMIENTO ASINCRONO" title="Lotes de reportes" description="Crea un lote, consulta su estado, cancelalo o descarga el ZIP completado." />
      <form className="report-form" onSubmit={createJob}><label>Cuerpo de POST /api/v1/report-jobs<textarea className="report-code-area" rows={20} value={batchData} onChange={(event) => setBatchData(event.target.value)} /></label><div className="report-form-actions"><button className="report-button report-button-primary" type="submit" disabled={batchLoading}>{batchLoading ? <LoaderCircle className="report-spin" size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}{batchLoading ? "Creando lote..." : "Crear lote"}</button></div></form><div className="report-job-lookup"><label>Id del lote<input value={jobId} onChange={(event) => setJobId(event.target.value)} placeholder="UUID devuelto por el servicio" /></label><div className="report-inline-actions"><button className="report-button report-button-secondary" type="button" onClick={() => void refreshJob()} disabled={jobLoading || !jobId}><RefreshCw size={15} aria-hidden="true" /> Consultar estado</button><button className="report-button report-button-secondary" type="button" onClick={() => void downloadJob()} disabled={jobLoading || !jobId}><Download size={15} aria-hidden="true" /> Descargar ZIP</button><button className="report-button report-button-danger" type="button" onClick={() => void cancelJob()} disabled={jobLoading || !jobId}><XCircle size={15} aria-hidden="true" /> Cancelar</button></div></div>{job ? <div className="report-job-card"><div><span className="report-eyebrow">TRABAJO {job.id}</span><h3>{job.templateCode || "-"} · {job.outputFormat || "-"}</h3></div><StatusBadge value={job.status} /><div className="report-job-metrics"><div><span>Procesados</span><strong>{job.processedItems ?? 0} / {job.totalItems ?? 0}</strong></div><div><span>Exitosos</span><strong>{job.successfulItems ?? 0}</strong></div><div><span>Fallidos</span><strong>{job.failedItems ?? 0}</strong></div><div><span>Expira</span><strong>{formatDate(job.expiresAt)}</strong></div></div>{job.errorMessage ? <p className="report-job-error">{job.errorMessage}</p> : null}</div> : <div className="report-empty-small"><FileArchive size={18} aria-hidden="true" /> Crea un lote para consultar su progreso.</div>}
    </section> : null}

    <footer className="report-footer"><span><Server size={14} aria-hidden="true" /> Proxy autenticado del MFE</span><span>Las respuestas del motor son la fuente de verdad.</span></footer>
  </main>;
}
