"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef
} from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BookOpen,
  CircleCheck,
  CircleX,
  ClipboardList,
  Copy,
  Database,
  Download,
  FileSearch,
  HeartPulse,
  MonitorCog,
  RefreshCcw,
  Search,
  ServerCog,
  Settings,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type PageMeta = {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
};

type AuditEvent = {
  event_id: string;
  event_type: string;
  schema_version: number;
  occurred_at: string;
  ingested_at: string;
  source_service: string;
  correlation_id: string;
  actor_user_id?: string | null;
  action: string;
  resource_type?: string | null;
  resource_id?: string | null;
  idempotency_key?: string | null;
  payload: JsonValue;
};

type AuditPage = {
  data: AuditEvent[];
  meta: PageMeta;
};

type AuditOverview = {
  service: string;
  version: string;
  database: string;
  model: string;
  resources: string[];
};

type AdminView = "audit" | "config" | "diagnostic" | "health" | "production" | "runbook" | "startup";
type HealthStatus = "down" | "up";

type HealthCheckResult = {
  checked_at: string;
  group: "backend" | "frontend";
  http_status: number | null;
  id: string;
  latency_ms: number;
  message: string;
  name: string;
  payload: unknown;
  status: HealthStatus;
  url: string;
};

type HealthOverview = {
  checks: HealthCheckResult[];
  generated_at: string;
  status: "degraded" | "up";
  timeout_ms: number;
  totals: {
    backend_down: number;
    backend_total: number;
    backend_up: number;
    down: number;
    frontend_down: number;
    frontend_total: number;
    frontend_up: number;
    total: number;
    up: number;
  };
};

type RunbookCommand = {
  command: string;
  title: string;
};

type RunbookItem = {
  docs: string[];
  group: "backend" | "frontend";
  health_url: string;
  id: string;
  name: string;
  ports: number[];
  start_commands: RunbookCommand[];
  verify_commands: RunbookCommand[];
};

type RunbookResponse = {
  generated_at: string;
  items: RunbookItem[];
  total_items: number;
};

type StartupGroup = "backend" | "frontend" | "preflight";

type StartupStep = {
  commands: RunbookCommand[];
  description: string;
  docs: string[];
  group: StartupGroup;
  id: string;
  order: number;
  target_id: string | null;
  title: string;
  verify_commands: RunbookCommand[];
};

type StartupChecklistResponse = {
  generated_at: string;
  steps: StartupStep[];
  total_steps: number;
};

type StartupState = "manual" | "pending" | "ready" | "unknown";

type RuntimeConfigGroup = "admin" | "backend" | "frontend" | "proxy" | "timeout";

type RuntimeConfigItem = {
  commands: RunbookCommand[];
  default_value: string;
  description: string;
  docs: string[];
  env_key: string;
  group: RuntimeConfigGroup;
  id: string;
  restart_required: boolean;
  source: "default" | "env";
  value: string;
};

type RuntimeConfigResponse = {
  generated_at: string;
  items: RuntimeConfigItem[];
  summary: {
    defaults: number;
    from_env: number;
    total_items: number;
  };
};

type DiagnosticSection = {
  error: string | null;
  ok: boolean;
  path: string;
  payload: unknown;
  status: number | null;
};

type DiagnosticExportResponse = {
  generated_at: string;
  sections: Record<string, DiagnosticSection>;
  summary: {
    failed_sections: number;
    health_down: number | null;
    health_status: string | null;
    health_total: number | null;
    health_up: number | null;
    ok_sections: number;
    runbook_items: number | null;
    runtime_config_defaults: number | null;
    runtime_config_from_env: number | null;
    runtime_config_items: number | null;
    production_readiness_missing: number | null;
    production_readiness_ready: number | null;
    production_readiness_score: number | null;
    production_readiness_warning: number | null;
    startup_steps: number | null;
    total_sections: number;
  };
};

type DiagnosticHistorySummary = Partial<DiagnosticExportResponse["summary"]>;

type DiagnosticHistorySnapshot = {
  created_at: string;
  file_name: string;
  path: string;
  size_bytes: number;
  summary: DiagnosticHistorySummary;
};

type DiagnosticHistoryComparison = {
  baseline_file: string;
  current_file: string;
  deltas: {
    failed_sections: number | null;
    health_up: number | null;
    ok_sections: number | null;
    runbook_items: number | null;
    runtime_config_items: number | null;
    startup_steps: number | null;
    total_sections: number | null;
  };
};

type DiagnosticHistoryResponse = {
  comparison: DiagnosticHistoryComparison | null;
  directory: string;
  generated_at: string;
  latest: DiagnosticHistorySnapshot | null;
  previous: DiagnosticHistorySnapshot | null;
  snapshots: DiagnosticHistorySnapshot[];
  total_snapshots: number;
};

type DiagnosticHistoryCreateResponse = {
  created: DiagnosticHistorySnapshot | null;
  history: DiagnosticHistoryResponse;
};

type DiagnosticHistoryCleanupResponse = {
  candidate_count: number;
  deleted_count: number;
  directory: string;
  dry_run: boolean;
  generated_at: string;
  keep: number;
  remaining_count: number;
  snapshots: Array<DiagnosticHistorySnapshot & { deleted: boolean; error: string | null }>;
};

type ProductionReadinessStatus = "missing" | "ready" | "warning";

type ProductionReadinessCategory = {
  id: string;
  missing: number;
  ready: number;
  score_percent: number;
  status: ProductionReadinessStatus;
  title: string;
  total: number;
  warning: number;
};

type ProductionReadinessItem = {
  category: string;
  evidence: string[];
  id: string;
  missing: string[];
  recommendation: string;
  status: ProductionReadinessStatus;
  title: string;
};

type ProductionReadinessResponse = {
  categories: ProductionReadinessCategory[];
  generated_at: string;
  items: ProductionReadinessItem[];
  next_actions: Array<Pick<ProductionReadinessItem, "id" | "recommendation" | "status" | "title">>;
  project_root: string;
  score_percent: number;
  status: ProductionReadinessStatus;
  totals: {
    missing: number;
    ready: number;
    total: number;
    warning: number;
  };
};

function todayInputValue() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function toStartOfDayInstant(value: string) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toISOString();
}

function toEndOfDayInstant(value: string) {
  if (!value) return "";
  return new Date(`${value}T23:59:59`).toISOString();
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "short",
    timeStyle: "medium"
  }).format(date);
}

function compactJson(value: JsonValue) {
  if (value == null) return "-";
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  return serialized.length > 90 ? `${serialized.slice(0, 90)}...` : serialized;
}

function summarizePayload(value: unknown) {
  if (value == null) return "-";
  if (typeof value === "string") return value.length > 110 ? `${value.slice(0, 110)}...` : value;
  if (typeof value !== "object" || Array.isArray(value)) return String(value);

  const payload = value as Record<string, unknown>;
  const preferredKeys = ["service", "status", "health_status", "database", "runtime"];
  const summary = preferredKeys
    .filter((key) => payload[key] != null)
    .map((key) => `${key}: ${String(payload[key])}`)
    .join(" | ");

  if (summary) return summary;

  const serialized = JSON.stringify(value);
  return serialized.length > 110 ? `${serialized.slice(0, 110)}...` : serialized;
}

function buildAuditQuery(filters: {
  action: string;
  from: string;
  page: number;
  pageSize: number;
  resourceType: string;
  to: string;
}) {
  const params = new URLSearchParams();
  if (filters.from) params.set("occurred_from", toStartOfDayInstant(filters.from));
  if (filters.to) params.set("occurred_to", toEndOfDayInstant(filters.to));
  if (filters.action) params.set("action", filters.action);
  if (filters.resourceType) params.set("resource_type", filters.resourceType);
  params.set("page", String(filters.page));
  params.set("page_size", String(filters.pageSize));
  return params.toString();
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      "content-type": "application/json"
    }
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return jsonRequest<T>(`/api/audit${path}`, init);
}

function EmptyState({ message }: Readonly<{ message: string }>) {
  return (
    <div className="empty-state">
      <FileSearch size={22} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

function HealthState({ status }: Readonly<{ status: HealthStatus }>) {
  const Icon = status === "up" ? CircleCheck : CircleX;
  return (
    <span className={`health-state health-state-${status}`}>
      <Icon size={14} aria-hidden="true" />
      {status === "up" ? "Activo" : "Caido"}
    </span>
  );
}

function HealthTable({ data }: Readonly<{ data: HealthCheckResult[] }>) {
  const columns = useMemo<ColumnDef<HealthCheckResult>[]>(
    () => [
      {
        cell: ({ row }) => (
          <div className="component-cell">
            <strong>{row.original.name}</strong>
            <span>{row.original.group === "frontend" ? "Frontend" : "Backend"}</span>
          </div>
        ),
        header: "Componente"
      },
      {
        cell: ({ row }) => <HealthState status={row.original.status} />,
        header: "Estado"
      },
      {
        cell: ({ row }) => row.original.http_status ?? "-",
        header: "HTTP"
      },
      {
        cell: ({ row }) => `${row.original.latency_ms} ms`,
        header: "Latencia"
      },
      {
        cell: ({ row }) => <span className="url-cell">{row.original.url}</span>,
        header: "URL"
      },
      {
        cell: ({ row }) => summarizePayload(row.original.payload) || row.original.message,
        header: "Respuesta"
      }
    ],
    []
  );

  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel()
  });

  if (data.length === 0) {
    return <EmptyState message="No hay resultados de salud disponibles." />;
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CommandList({
  copiedCommand,
  commands,
  onCopy
}: Readonly<{
  copiedCommand: string;
  commands: RunbookCommand[];
  onCopy: (command: string) => void;
}>) {
  return (
    <div className="command-list">
      {commands.map((item) => (
        <div className="command-row" key={`${item.title}-${item.command}`}>
          <div>
            <span>{item.title}</span>
            <code>{item.command}</code>
          </div>
          <button
            type="button"
            className="copy-button"
            onClick={() => onCopy(item.command)}
            title="Copiar comando"
          >
            <Copy size={14} aria-hidden="true" />
            {copiedCommand === item.command ? "Copiado" : "Copiar"}
          </button>
        </div>
      ))}
    </div>
  );
}

function RunbookPanel({
  copiedCommand,
  data,
  onCopy
}: Readonly<{
  copiedCommand: string;
  data: RunbookItem[];
  onCopy: (command: string) => void;
}>) {
  if (data.length === 0) {
    return <EmptyState message="No hay guias operativas disponibles." />;
  }

  return (
    <div className="runbook-grid">
      {data.map((item) => (
        <article className="runbook-card" key={item.id}>
          <div className="runbook-card-header">
            <div>
              <span>{item.group === "frontend" ? "Frontend" : "Backend"}</span>
              <h3>{item.name}</h3>
            </div>
            <strong>{item.ports.join(", ")}</strong>
          </div>
          <dl className="runbook-meta">
            <div>
              <dt>Health</dt>
              <dd>{item.health_url}</dd>
            </div>
            <div>
              <dt>Docs</dt>
              <dd>{item.docs.join(" | ")}</dd>
            </div>
          </dl>
          <div className="runbook-section">
            <h4>Verificar</h4>
            <CommandList commands={item.verify_commands} copiedCommand={copiedCommand} onCopy={onCopy} />
          </div>
          <div className="runbook-section">
            <h4>Levantar o diagnosticar</h4>
            <CommandList commands={item.start_commands} copiedCommand={copiedCommand} onCopy={onCopy} />
          </div>
        </article>
      ))}
    </div>
  );
}

function startupGroupLabel(group: StartupGroup) {
  if (group === "backend") return "Backend";
  if (group === "frontend") return "Frontend";
  return "Preflight";
}

function startupState(step: StartupStep, healthById: Map<string, HealthCheckResult>): StartupState {
  if (!step.target_id) return "manual";

  const health = healthById.get(step.target_id);
  if (!health) return "unknown";

  return health.status === "up" ? "ready" : "pending";
}

function startupStateLabel(state: StartupState) {
  if (state === "ready") return "Listo";
  if (state === "pending") return "Pendiente";
  if (state === "unknown") return "Sin datos";
  return "Manual";
}

function StartupPanel({
  copiedCommand,
  healthById,
  onCopy,
  steps
}: Readonly<{
  copiedCommand: string;
  healthById: Map<string, HealthCheckResult>;
  onCopy: (command: string) => void;
  steps: StartupStep[];
}>) {
  if (steps.length === 0) {
    return <EmptyState message="No hay pasos de arranque configurados." />;
  }

  return (
    <div className="startup-list">
      {steps.map((step) => {
        const state = startupState(step, healthById);

        return (
          <article className={`startup-step startup-step-${state}`} key={step.id}>
            <div className="startup-step-order">{step.order}</div>
            <div className="startup-step-body">
              <div className="startup-step-header">
                <div>
                  <span>{startupGroupLabel(step.group)}</span>
                  <h3>{step.title}</h3>
                </div>
                <strong className={`startup-state startup-state-${state}`}>
                  {startupStateLabel(state)}
                </strong>
              </div>
              <p>{step.description}</p>
              <dl className="runbook-meta">
                <div>
                  <dt>Target</dt>
                  <dd>{step.target_id ?? "Validacion manual"}</dd>
                </div>
                <div>
                  <dt>Docs</dt>
                  <dd>{step.docs.join(" | ")}</dd>
                </div>
              </dl>
              <div className="runbook-section">
                <h4>Ejecutar</h4>
                <CommandList commands={step.commands} copiedCommand={copiedCommand} onCopy={onCopy} />
              </div>
              <div className="runbook-section">
                <h4>Validar</h4>
                <CommandList commands={step.verify_commands} copiedCommand={copiedCommand} onCopy={onCopy} />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function runtimeGroupLabel(group: RuntimeConfigGroup) {
  if (group === "admin") return "Admin";
  if (group === "backend") return "Backend";
  if (group === "frontend") return "Frontend";
  if (group === "proxy") return "Proxy";
  return "Timeout";
}

function RuntimeConfigPanel({
  copiedCommand,
  items,
  onCopy
}: Readonly<{
  copiedCommand: string;
  items: RuntimeConfigItem[];
  onCopy: (command: string) => void;
}>) {
  if (items.length === 0) {
    return <EmptyState message="No hay parametros operativos disponibles." />;
  }

  return (
    <div className="config-grid">
      {items.map((item) => (
        <article className="config-card" key={item.id}>
          <div className="config-card-header">
            <div>
              <span>{runtimeGroupLabel(item.group)}</span>
              <h3>{item.env_key}</h3>
            </div>
            <strong className={`config-source config-source-${item.source}`}>
              {item.source === "env" ? "env" : "default"}
            </strong>
          </div>
          <p>{item.description}</p>
          <dl className="runbook-meta">
            <div>
              <dt>Valor efectivo</dt>
              <dd>{item.value}</dd>
            </div>
            <div>
              <dt>Default</dt>
              <dd>{item.default_value}</dd>
            </div>
            <div>
              <dt>Docs</dt>
              <dd>{item.docs.join(" | ")}</dd>
            </div>
            <div>
              <dt>Reinicio</dt>
              <dd>{item.restart_required ? "Requiere reiniciar mfe-admin" : "No requiere reinicio"}</dd>
            </div>
          </dl>
          <div className="runbook-section">
            <h4>Comandos</h4>
            <CommandList commands={item.commands} copiedCommand={copiedCommand} onCopy={onCopy} />
          </div>
        </article>
      ))}
    </div>
  );
}

function DiagnosticPanel({
  cleanupResult,
  cleaningHistory,
  copiedCommand,
  data,
  history,
  onCleanupHistory,
  onCopy,
  onPreviewCleanup,
  onSaveSnapshot,
  savingSnapshot
}: Readonly<{
  cleanupResult: DiagnosticHistoryCleanupResponse | undefined;
  cleaningHistory: boolean;
  copiedCommand: string;
  data: DiagnosticExportResponse | undefined;
  history: DiagnosticHistoryResponse | undefined;
  onCleanupHistory: () => void;
  onCopy: (command: string) => void;
  onPreviewCleanup: () => void;
  onSaveSnapshot: () => void;
  savingSnapshot: boolean;
}>) {
  const commands: RunbookCommand[] = [
    {
      command: "curl.exe -s http://localhost:3005/api/admin/diagnostic-export",
      title: "Ver JSON"
    },
    {
      command: "curl.exe -s http://localhost:3005/api/admin/diagnostic-export -o .\\logs\\admin-diagnostic.json",
      title: "Guardar JSON"
    }
  ];
  const historyCommands: RunbookCommand[] = [
    {
      command: "curl.exe -s http://localhost:3005/api/admin/diagnostic-history",
      title: "Ver historial"
    },
    {
      command: "curl.exe -X POST http://localhost:3005/api/admin/diagnostic-history",
      title: "Guardar snapshot historico"
    },
    {
      command: "curl.exe -X DELETE \"http://localhost:3005/api/admin/diagnostic-history?keep=20&dry_run=true\"",
      title: "Simular limpieza"
    },
    {
      command: "curl.exe -X DELETE \"http://localhost:3005/api/admin/diagnostic-history?keep=20&dry_run=false\"",
      title: "Limpiar antiguos"
    }
  ];
  const latestSnapshot = history?.latest;
  const previousSnapshot = history?.previous;
  const failedDelta = history?.comparison?.deltas.failed_sections;
  const visibleSnapshots = history?.snapshots.slice(0, 4) ?? [];

  if (!data) {
    return (
      <div className="diagnostic-grid">
        <article className="diagnostic-card">
          <div className="diagnostic-card-header">
            <div>
              <span>Exportacion</span>
              <h3>Diagnostico administrativo</h3>
            </div>
            <strong className="diagnostic-state diagnostic-state-pending">Pendiente</strong>
          </div>
          <CommandList commands={commands} copiedCommand={copiedCommand} onCopy={onCopy} />
          <div className="diagnostic-actions">
            <button
              type="button"
              className="copy-button"
              disabled={savingSnapshot || cleaningHistory}
              onClick={onSaveSnapshot}
            >
              <Download size={14} aria-hidden="true" />
              {savingSnapshot ? "Guardando" : "Guardar snapshot"}
            </button>
            <button
              type="button"
              className="copy-button"
              disabled={savingSnapshot || cleaningHistory}
              onClick={onPreviewCleanup}
            >
              <FileSearch size={14} aria-hidden="true" />
              Simular limpieza
            </button>
          </div>
          <CommandList commands={historyCommands} copiedCommand={copiedCommand} onCopy={onCopy} />
        </article>
      </div>
    );
  }

  return (
    <div className="diagnostic-grid">
      <article className="diagnostic-card diagnostic-card-wide">
        <div className="diagnostic-card-header">
          <div>
            <span>Snapshot</span>
            <h3>Diagnostico administrativo</h3>
          </div>
          <strong className={data.summary.failed_sections === 0 ? "diagnostic-state diagnostic-state-ok" : "diagnostic-state diagnostic-state-error"}>
            {data.summary.failed_sections === 0 ? "Completo" : "Con errores"}
          </strong>
        </div>
        <dl className="runbook-meta">
          <div>
            <dt>Generado</dt>
            <dd>{formatDateTime(data.generated_at)}</dd>
          </div>
          <div>
            <dt>Health</dt>
            <dd>
              {data.summary.health_status ?? "-"} | {data.summary.health_up ?? "-"} activos / {data.summary.health_total ?? "-"} total
            </dd>
          </div>
          <div>
            <dt>Runbook</dt>
            <dd>{data.summary.runbook_items ?? "-"} guias</dd>
          </div>
          <div>
            <dt>Parametros</dt>
            <dd>
              {data.summary.runtime_config_items ?? "-"} variables | {data.summary.runtime_config_from_env ?? "-"} env
            </dd>
          </div>
        </dl>
        <CommandList commands={commands} copiedCommand={copiedCommand} onCopy={onCopy} />
      </article>

      <article className="diagnostic-card diagnostic-card-wide">
        <div className="diagnostic-card-header">
          <div>
            <span>Historico local</span>
            <h3>Snapshots guardados</h3>
          </div>
          <strong className={history?.total_snapshots ? "diagnostic-state diagnostic-state-ok" : "diagnostic-state diagnostic-state-pending"}>
            {history?.total_snapshots ?? 0} archivos
          </strong>
        </div>
        <dl className="runbook-meta">
          <div>
            <dt>Carpeta</dt>
            <dd>{history?.directory ?? "logs\\admin-diagnostics"}</dd>
          </div>
          <div>
            <dt>Ultimo</dt>
            <dd>{latestSnapshot ? formatDateTime(latestSnapshot.created_at) : "-"}</dd>
          </div>
          <div>
            <dt>Anterior</dt>
            <dd>{previousSnapshot ? formatDateTime(previousSnapshot.created_at) : "-"}</dd>
          </div>
          <div>
            <dt>Delta errores</dt>
            <dd>{typeof failedDelta === "number" ? failedDelta : "-"}</dd>
          </div>
        </dl>
        <div className="diagnostic-actions">
          <button
            type="button"
            className="copy-button"
            disabled={savingSnapshot || cleaningHistory}
            onClick={onSaveSnapshot}
          >
            <Download size={14} aria-hidden="true" />
            {savingSnapshot ? "Guardando" : "Guardar snapshot"}
          </button>
          <button
            type="button"
            className="copy-button"
            disabled={savingSnapshot || cleaningHistory}
            onClick={onPreviewCleanup}
          >
            <FileSearch size={14} aria-hidden="true" />
            Simular limpieza
          </button>
          <button
            type="button"
            className="copy-button"
            disabled={savingSnapshot || cleaningHistory || (history?.total_snapshots ?? 0) <= 20}
            onClick={onCleanupHistory}
          >
            <CircleX size={14} aria-hidden="true" />
            {cleaningHistory ? "Limpiando" : "Limpiar antiguos"}
          </button>
        </div>
        {cleanupResult ? (
          <dl className="runbook-meta">
            <div>
              <dt>Retencion</dt>
              <dd>Conservar {cleanupResult.keep}</dd>
            </div>
            <div>
              <dt>Candidatos</dt>
              <dd>{cleanupResult.candidate_count}</dd>
            </div>
            <div>
              <dt>Eliminados</dt>
              <dd>{cleanupResult.deleted_count}</dd>
            </div>
            <div>
              <dt>Modo</dt>
              <dd>{cleanupResult.dry_run ? "Simulacion" : "Aplicado"}</dd>
            </div>
          </dl>
        ) : null}
        <CommandList commands={historyCommands} copiedCommand={copiedCommand} onCopy={onCopy} />
      </article>

      {visibleSnapshots.map((snapshot) => (
        <article className="diagnostic-card" key={snapshot.file_name}>
          <div className="diagnostic-card-header">
            <div>
              <span>{snapshot.file_name}</span>
              <h3>{formatDateTime(snapshot.created_at)}</h3>
            </div>
            <strong className={snapshot.summary.failed_sections ? "diagnostic-state diagnostic-state-error" : "diagnostic-state diagnostic-state-ok"}>
              {snapshot.summary.failed_sections ? "Con errores" : "OK"}
            </strong>
          </div>
          <dl className="runbook-meta">
            <div>
              <dt>Secciones</dt>
              <dd>
                {snapshot.summary.ok_sections ?? "-"} OK / {snapshot.summary.total_sections ?? "-"} total
              </dd>
            </div>
            <div>
              <dt>Health</dt>
              <dd>{snapshot.summary.health_status ?? "-"}</dd>
            </div>
            <div>
              <dt>Tamano</dt>
              <dd>{snapshot.size_bytes} bytes</dd>
            </div>
            <div>
              <dt>Archivo</dt>
              <dd>{snapshot.path}</dd>
            </div>
          </dl>
        </article>
      ))}

      {Object.entries(data.sections).map(([id, section]) => (
        <article className="diagnostic-card" key={id}>
          <div className="diagnostic-card-header">
            <div>
              <span>{section.path}</span>
              <h3>{id}</h3>
            </div>
            <strong className={section.ok ? "diagnostic-state diagnostic-state-ok" : "diagnostic-state diagnostic-state-error"}>
              {section.ok ? "OK" : "Error"}
            </strong>
          </div>
          <dl className="runbook-meta">
            <div>
              <dt>HTTP</dt>
              <dd>{section.status ?? "-"}</dd>
            </div>
            <div>
              <dt>Error</dt>
              <dd>{section.error ?? "-"}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function readinessStateClass(status: ProductionReadinessStatus) {
  if (status === "ready") return "diagnostic-state diagnostic-state-ok";
  if (status === "warning") return "diagnostic-state diagnostic-state-pending";
  return "diagnostic-state diagnostic-state-error";
}

function readinessStateLabel(status: ProductionReadinessStatus) {
  if (status === "ready") return "Listo";
  if (status === "warning") return "Atencion";
  return "Falta";
}

function ProductionReadinessPanel({ data }: Readonly<{ data: ProductionReadinessResponse | undefined }>) {
  if (!data) {
    return (
      <div className="diagnostic-grid">
        <article className="diagnostic-card">
          <div className="diagnostic-card-header">
            <div>
              <span>Produccion</span>
              <h3>Matriz de preparacion</h3>
            </div>
            <strong className="diagnostic-state diagnostic-state-pending">Pendiente</strong>
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="diagnostic-grid">
      <article className="diagnostic-card diagnostic-card-wide">
        <div className="diagnostic-card-header">
          <div>
            <span>Score operativo</span>
            <h3>Preparacion para produccion</h3>
          </div>
          <strong className={readinessStateClass(data.status)}>{data.score_percent}%</strong>
        </div>
        <dl className="runbook-meta">
          <div>
            <dt>Proyecto</dt>
            <dd>{data.project_root}</dd>
          </div>
          <div>
            <dt>Listos</dt>
            <dd>{data.totals.ready}</dd>
          </div>
          <div>
            <dt>Atencion</dt>
            <dd>{data.totals.warning}</dd>
          </div>
          <div>
            <dt>Faltan</dt>
            <dd>{data.totals.missing}</dd>
          </div>
        </dl>
      </article>

      {data.categories.map((category) => (
        <article className="diagnostic-card" key={category.id}>
          <div className="diagnostic-card-header">
            <div>
              <span>{category.id}</span>
              <h3>{category.title}</h3>
            </div>
            <strong className={readinessStateClass(category.status)}>{category.score_percent}%</strong>
          </div>
          <dl className="runbook-meta">
            <div>
              <dt>Listos</dt>
              <dd>{category.ready}</dd>
            </div>
            <div>
              <dt>Atencion</dt>
              <dd>{category.warning}</dd>
            </div>
            <div>
              <dt>Faltan</dt>
              <dd>{category.missing}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{category.total}</dd>
            </div>
          </dl>
        </article>
      ))}

      {data.items.map((item) => (
        <article className="diagnostic-card" key={item.id}>
          <div className="diagnostic-card-header">
            <div>
              <span>{item.category}</span>
              <h3>{item.title}</h3>
            </div>
            <strong className={readinessStateClass(item.status)}>{readinessStateLabel(item.status)}</strong>
          </div>
          <dl className="runbook-meta">
            <div>
              <dt>Evidencia</dt>
              <dd>{item.evidence.length ? item.evidence.join(" | ") : "-"}</dd>
            </div>
            <div>
              <dt>Falta</dt>
              <dd>{item.missing.length ? item.missing.join(" | ") : "-"}</dd>
            </div>
            <div>
              <dt>Recomendacion</dt>
              <dd>{item.recommendation}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function AuditTable({ data }: Readonly<{ data: AuditEvent[] }>) {
  const columns = useMemo<ColumnDef<AuditEvent>[]>(
    () => [
      { accessorKey: "action", header: "Accion" },
      { accessorKey: "source_service", header: "Servicio" },
      { accessorKey: "event_type", header: "Evento" },
      { accessorKey: "resource_type", header: "Recurso" },
      { accessorKey: "resource_id", header: "ID recurso" },
      {
        cell: ({ row }) => formatDateTime(row.original.occurred_at),
        header: "Ocurrio"
      },
      {
        cell: ({ row }) => compactJson(row.original.payload),
        header: "Payload"
      }
    ],
    []
  );

  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel()
  });

  if (data.length === 0) {
    return <EmptyState message="No hay eventos auditables para los filtros seleccionados." />;
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminEmbeddedPage() {
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<AdminView>("health");
  const [copiedCommand, setCopiedCommand] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    const today = todayInputValue();
    setFrom(today);
    setTo(today);
  }, []);

  useEffect(() => {
    const publishHeight = () => {
      window.parent.postMessage(
        {
          height: document.body.scrollHeight,
          name: "mfe-admin",
          type: "mfe:height"
        },
        "*"
      );
    };

    publishHeight();
    const observer = new ResizeObserver(publishHeight);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  const healthOverview = useQuery({
    queryFn: () => jsonRequest<HealthOverview>("/api/admin/health"),
    queryKey: ["admin", "health"],
    refetchInterval: 30000
  });

  const runbook = useQuery({
    enabled: activeView === "runbook",
    queryFn: () => jsonRequest<RunbookResponse>("/api/admin/runbook"),
    queryKey: ["admin", "runbook"],
    staleTime: 5 * 60 * 1000
  });

  const startupChecklist = useQuery({
    enabled: activeView === "startup",
    queryFn: () => jsonRequest<StartupChecklistResponse>("/api/admin/startup-checklist"),
    queryKey: ["admin", "startup-checklist"],
    staleTime: 5 * 60 * 1000
  });

  const runtimeConfig = useQuery({
    enabled: activeView === "config",
    queryFn: () => jsonRequest<RuntimeConfigResponse>("/api/admin/runtime-config"),
    queryKey: ["admin", "runtime-config"],
    staleTime: 60 * 1000
  });

  const diagnosticExport = useQuery({
    enabled: activeView === "diagnostic",
    queryFn: () => jsonRequest<DiagnosticExportResponse>("/api/admin/diagnostic-export"),
    queryKey: ["admin", "diagnostic-export"],
    staleTime: 30 * 1000
  });

  const diagnosticHistory = useQuery({
    enabled: activeView === "diagnostic",
    queryFn: () => jsonRequest<DiagnosticHistoryResponse>("/api/admin/diagnostic-history"),
    queryKey: ["admin", "diagnostic-history"],
    staleTime: 30 * 1000
  });

  const productionReadiness = useQuery({
    enabled: activeView === "production",
    queryFn: () => jsonRequest<ProductionReadinessResponse>("/api/admin/production-readiness"),
    queryKey: ["admin", "production-readiness"],
    staleTime: 60 * 1000
  });

  const overview = useQuery({
    enabled: activeView === "audit",
    queryFn: () => apiRequest<AuditOverview>(""),
    queryKey: ["admin", "audit", "overview"]
  });

  const auditQuery = buildAuditQuery({
    action,
    from,
    page,
    pageSize,
    resourceType,
    to
  });

  const auditEvents = useQuery({
    enabled: activeView === "audit",
    queryFn: () => apiRequest<AuditPage>(`/audit-events?${auditQuery}`),
    queryKey: ["admin", "audit-events", auditQuery]
  });

  const createSampleEvent = useMutation({
    mutationFn: () => {
      const eventId = crypto.randomUUID();
      return apiRequest("/audit-events", {
        body: JSON.stringify({
          action: "admin.sample_event",
          actor_user_id: crypto.randomUUID(),
          correlation_id: crypto.randomUUID(),
          event_id: eventId,
          event_type: "AdminSampleEvent",
          occurred_at: new Date().toISOString(),
          payload: {
            created_from: "mfe-admin",
            note: "Evento de validacion administrativa"
          },
          resource_id: eventId,
          resource_type: "admin",
          schema_version: 1,
          source_service: "mfe-admin"
        }),
        headers: {
          "idempotency-key": `mfe-admin-${eventId}`
        },
        method: "POST"
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "audit-events"] });
    }
  });

  const saveDiagnosticSnapshot = useMutation({
    mutationFn: () => jsonRequest<DiagnosticHistoryCreateResponse>("/api/admin/diagnostic-history", { method: "POST" }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "diagnostic-export"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "diagnostic-history"] })
      ]);
    }
  });

  const previewDiagnosticCleanup = useMutation({
    mutationFn: () =>
      jsonRequest<DiagnosticHistoryCleanupResponse>("/api/admin/diagnostic-history?keep=20&dry_run=true", { method: "DELETE" })
  });

  const cleanupDiagnosticHistory = useMutation({
    mutationFn: () =>
      jsonRequest<DiagnosticHistoryCleanupResponse>("/api/admin/diagnostic-history?keep=20&dry_run=false", { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "diagnostic-history"] });
    }
  });

  const totalItems = auditEvents.data?.meta.total_items ?? 0;
  const totalPages = auditEvents.data?.meta.total_pages ?? 0;
  const visibleRows = auditEvents.data?.data.length ?? 0;
  const backendAvailable = !overview.error && !auditEvents.error;
  const healthTotals = healthOverview.data?.totals;
  const healthChecks = healthOverview.data?.checks ?? [];
  const healthStatus = healthOverview.error
    ? "Sin datos"
    : healthOverview.data?.status === "up"
      ? "Operativo"
      : "Degradado";
  const runbookItems = runbook.data?.items ?? [];
  const runbookFrontendItems = runbookItems.filter((item) => item.group === "frontend");
  const runbookBackendItems = runbookItems.filter((item) => item.group === "backend");
  const startupSteps = startupChecklist.data?.steps ?? [];
  const healthById = useMemo(
    () => new Map(healthChecks.map((check) => [check.id, check])),
    [healthChecks]
  );
  const startupLinkedSteps = startupSteps.filter((step) => step.target_id).length;
  const startupReadySteps = startupSteps.filter(
    (step) => step.target_id && healthById.get(step.target_id)?.status === "up"
  ).length;
  const startupPendingSteps = Math.max(0, startupLinkedSteps - startupReadySteps);
  const runtimeConfigItems = runtimeConfig.data?.items ?? [];
  const runtimeEnvItems = runtimeConfigItems.filter((item) => item.source === "env").length;
  const runtimeDefaultItems = runtimeConfigItems.length - runtimeEnvItems;
  const runtimeRestartItems = runtimeConfigItems.filter((item) => item.restart_required).length;
  const diagnosticSummary = diagnosticExport.data?.summary;
  const diagnosticCleanupResult = cleanupDiagnosticHistory.data ?? previewDiagnosticCleanup.data;
  const diagnosticCleanupPending = cleanupDiagnosticHistory.isPending || previewDiagnosticCleanup.isPending;

  const copyCommand = (command: string) => {
    void navigator.clipboard.writeText(command).then(() => {
      setCopiedCommand(command);
      window.setTimeout(() => setCopiedCommand(""), 1600);
    });
  };

  return (
    <main className="admin-shell">
      <section className="toolbar">
        <div>
          <p className="eyebrow">MFE ADMIN</p>
          <h1>Administracion y salud</h1>
        </div>
        <div className="toolbar-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              if (activeView === "health") {
                void healthOverview.refetch();
              } else if (activeView === "startup") {
                void healthOverview.refetch();
                void startupChecklist.refetch();
              } else if (activeView === "runbook") {
                void runbook.refetch();
              } else if (activeView === "config") {
                void runtimeConfig.refetch();
              } else if (activeView === "diagnostic") {
                void diagnosticExport.refetch();
                void diagnosticHistory.refetch();
              } else if (activeView === "production") {
                void productionReadiness.refetch();
              } else {
                void overview.refetch();
                void auditEvents.refetch();
              }
            }}
          >
            <RefreshCcw size={16} aria-hidden="true" />
            Actualizar
          </button>
          {activeView === "audit" ? (
            <button
              type="button"
              className="primary-button"
              disabled={createSampleEvent.isPending}
              onClick={() => createSampleEvent.mutate()}
            >
              <Sparkles size={16} aria-hidden="true" />
              Evento prueba
            </button>
          ) : activeView === "health" ? (
            <button
              type="button"
              className="primary-button"
              disabled={healthOverview.isFetching}
              onClick={() => void healthOverview.refetch()}
            >
              <HeartPulse size={16} aria-hidden="true" />
              Verificar
            </button>
          ) : activeView === "startup" ? (
            <button
              type="button"
              className="primary-button"
              disabled={healthOverview.isFetching || startupChecklist.isFetching}
              onClick={() => {
                void healthOverview.refetch();
                void startupChecklist.refetch();
              }}
            >
              <ServerCog size={16} aria-hidden="true" />
              Revalidar
            </button>
          ) : activeView === "config" ? (
            <button
              type="button"
              className="primary-button"
              disabled={runtimeConfig.isFetching}
              onClick={() => void runtimeConfig.refetch()}
            >
              <Settings size={16} aria-hidden="true" />
              Recargar
            </button>
          ) : activeView === "diagnostic" ? (
            <button
              type="button"
              className="primary-button"
              disabled={diagnosticExport.isFetching}
              onClick={() => window.open("/api/admin/diagnostic-export", "_blank")}
            >
              <Download size={16} aria-hidden="true" />
              Exportar
            </button>
          ) : activeView === "production" ? (
            <button
              type="button"
              className="primary-button"
              disabled={productionReadiness.isFetching}
              onClick={() => void productionReadiness.refetch()}
            >
              <ShieldCheck size={16} aria-hidden="true" />
              Evaluar
            </button>
          ) : null}
        </div>
      </section>

      <section className="view-tabs" aria-label="Vistas administrativas">
        <button
          type="button"
          className={activeView === "health" ? "view-tab view-tab-active" : "view-tab"}
          onClick={() => setActiveView("health")}
        >
          <HeartPulse size={16} aria-hidden="true" />
          Salud
        </button>
        <button
          type="button"
          className={activeView === "startup" ? "view-tab view-tab-active" : "view-tab"}
          onClick={() => setActiveView("startup")}
        >
          <ServerCog size={16} aria-hidden="true" />
          Arranque
        </button>
        <button
          type="button"
          className={activeView === "runbook" ? "view-tab view-tab-active" : "view-tab"}
          onClick={() => setActiveView("runbook")}
        >
          <BookOpen size={16} aria-hidden="true" />
          Runbook
        </button>
        <button
          type="button"
          className={activeView === "config" ? "view-tab view-tab-active" : "view-tab"}
          onClick={() => setActiveView("config")}
        >
          <Settings size={16} aria-hidden="true" />
          Parametros
        </button>
        <button
          type="button"
          className={activeView === "diagnostic" ? "view-tab view-tab-active" : "view-tab"}
          onClick={() => setActiveView("diagnostic")}
        >
          <Download size={16} aria-hidden="true" />
          Diagnostico
        </button>
        <button
          type="button"
          className={activeView === "production" ? "view-tab view-tab-active" : "view-tab"}
          onClick={() => setActiveView("production")}
        >
          <ShieldCheck size={16} aria-hidden="true" />
          Produccion
        </button>
        <button
          type="button"
          className={activeView === "audit" ? "view-tab view-tab-active" : "view-tab"}
          onClick={() => setActiveView("audit")}
        >
          <ClipboardList size={16} aria-hidden="true" />
          Auditoria
        </button>
      </section>

      <section className="status-grid" aria-label="Estado administrativo">
        {activeView === "health" ? (
          <>
            <article className="status-card">
              <HeartPulse size={18} aria-hidden="true" />
              <span>Estado general</span>
              <strong>{healthOverview.isFetching ? "Consultando" : healthStatus}</strong>
            </article>
            <article className="status-card">
              <MonitorCog size={18} aria-hidden="true" />
              <span>Frontends</span>
              <strong>{healthTotals ? `${healthTotals.frontend_up}/${healthTotals.frontend_total}` : "0/0"}</strong>
            </article>
            <article className="status-card">
              <ServerCog size={18} aria-hidden="true" />
              <span>Backends</span>
              <strong>{healthTotals ? `${healthTotals.backend_up}/${healthTotals.backend_total}` : "0/0"}</strong>
            </article>
            <article className="status-card">
              <Activity size={18} aria-hidden="true" />
              <span>Ultima consulta</span>
              <strong>{formatDateTime(healthOverview.data?.generated_at)}</strong>
            </article>
          </>
        ) : activeView === "startup" ? (
          <>
            <article className="status-card">
              <ClipboardList size={18} aria-hidden="true" />
              <span>Pasos</span>
              <strong>{startupChecklist.data?.total_steps ?? startupSteps.length}</strong>
            </article>
            <article className="status-card">
              <CircleCheck size={18} aria-hidden="true" />
              <span>Listos</span>
              <strong>{startupReadySteps}</strong>
            </article>
            <article className="status-card">
              <CircleX size={18} aria-hidden="true" />
              <span>Pendientes</span>
              <strong>{startupPendingSteps}</strong>
            </article>
            <article className="status-card">
              <Activity size={18} aria-hidden="true" />
              <span>Actualizado</span>
              <strong>{formatDateTime(startupChecklist.data?.generated_at)}</strong>
            </article>
          </>
        ) : activeView === "runbook" ? (
          <>
            <article className="status-card">
              <BookOpen size={18} aria-hidden="true" />
              <span>Guias</span>
              <strong>{runbook.data?.total_items ?? runbookItems.length}</strong>
            </article>
            <article className="status-card">
              <MonitorCog size={18} aria-hidden="true" />
              <span>Frontends</span>
              <strong>{runbookFrontendItems.length}</strong>
            </article>
            <article className="status-card">
              <ServerCog size={18} aria-hidden="true" />
              <span>Backends</span>
              <strong>{runbookBackendItems.length}</strong>
            </article>
            <article className="status-card">
              <Activity size={18} aria-hidden="true" />
              <span>Actualizado</span>
              <strong>{formatDateTime(runbook.data?.generated_at)}</strong>
            </article>
          </>
        ) : activeView === "config" ? (
          <>
            <article className="status-card">
              <Settings size={18} aria-hidden="true" />
              <span>Parametros</span>
              <strong>{runtimeConfig.data?.summary.total_items ?? runtimeConfigItems.length}</strong>
            </article>
            <article className="status-card">
              <Database size={18} aria-hidden="true" />
              <span>Desde env</span>
              <strong>{runtimeConfig.data?.summary.from_env ?? runtimeEnvItems}</strong>
            </article>
            <article className="status-card">
              <MonitorCog size={18} aria-hidden="true" />
              <span>Default</span>
              <strong>{runtimeConfig.data?.summary.defaults ?? runtimeDefaultItems}</strong>
            </article>
            <article className="status-card">
              <Activity size={18} aria-hidden="true" />
              <span>Reinicio</span>
              <strong>{runtimeRestartItems}</strong>
            </article>
          </>
        ) : activeView === "diagnostic" ? (
          <>
            <article className="status-card">
              <Download size={18} aria-hidden="true" />
              <span>Secciones</span>
              <strong>{diagnosticSummary?.total_sections ?? 0}</strong>
            </article>
            <article className="status-card">
              <CircleCheck size={18} aria-hidden="true" />
              <span>OK</span>
              <strong>{diagnosticSummary?.ok_sections ?? 0}</strong>
            </article>
            <article className="status-card">
              <CircleX size={18} aria-hidden="true" />
              <span>Errores</span>
              <strong>{diagnosticSummary?.failed_sections ?? 0}</strong>
            </article>
            <article className="status-card">
              <FileSearch size={18} aria-hidden="true" />
              <span>Historial</span>
              <strong>{diagnosticHistory.data?.total_snapshots ?? 0}</strong>
            </article>
          </>
        ) : activeView === "production" ? (
          <>
            <article className="status-card">
              <ShieldCheck size={18} aria-hidden="true" />
              <span>Score</span>
              <strong>{productionReadiness.data ? `${productionReadiness.data.score_percent}%` : "0%"}</strong>
            </article>
            <article className="status-card">
              <CircleCheck size={18} aria-hidden="true" />
              <span>Listos</span>
              <strong>{productionReadiness.data?.totals.ready ?? 0}</strong>
            </article>
            <article className="status-card">
              <Activity size={18} aria-hidden="true" />
              <span>Atencion</span>
              <strong>{productionReadiness.data?.totals.warning ?? 0}</strong>
            </article>
            <article className="status-card">
              <CircleX size={18} aria-hidden="true" />
              <span>Faltan</span>
              <strong>{productionReadiness.data?.totals.missing ?? 0}</strong>
            </article>
          </>
        ) : (
          <>
            <article className="status-card">
              <ShieldCheck size={18} aria-hidden="true" />
              <span>Servicio</span>
              <strong>{overview.data?.service ?? "audit-service"}</strong>
            </article>
            <article className="status-card">
              <Database size={18} aria-hidden="true" />
              <span>Modelo</span>
              <strong>{overview.data?.model ?? "append-only"}</strong>
            </article>
            <article className="status-card">
              <Activity size={18} aria-hidden="true" />
              <span>Eventos</span>
              <strong>{totalItems}</strong>
            </article>
            <article className="status-card">
              <ServerCog size={18} aria-hidden="true" />
              <span>Estado</span>
              <strong>{backendAvailable ? "Operativo" : "Sin backend"}</strong>
            </article>
          </>
        )}
      </section>

      {activeView === "audit" ? (
        <section className="filters" aria-label="Filtros de auditoria">
          <label>
            <span>Desde</span>
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>
            <span>Hasta</span>
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          <label>
            <span>Accion</span>
            <input
              type="search"
              value={action}
              placeholder="ticket.cancelled"
              onChange={(event) => {
                setAction(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            <span>Recurso</span>
            <input
              type="search"
              value={resourceType}
              placeholder="ticket, admin, bus"
              onChange={(event) => {
                setResourceType(event.target.value);
                setPage(1);
              }}
            />
          </label>
        </section>
      ) : null}

      {activeView === "health" ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Salud de componentes</h2>
              <p>
                <Search size={14} aria-hidden="true" />
                {healthTotals ? `${healthTotals.up} activos / ${healthTotals.total} total` : "Sin resultados"}
              </p>
            </div>
            <span className={healthOverview.isFetching ? "status loading" : "status"}>
              {healthOverview.isFetching ? "Consultando" : "Listo"}
            </span>
          </div>

          {healthOverview.error ? (
            <div className="error-box">
              No se pudo ejecutar el visor de salud administrativo.
            </div>
          ) : null}

          <HealthTable data={healthChecks} />
        </section>
      ) : activeView === "startup" ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Arranque guiado</h2>
              <p>
                <Search size={14} aria-hidden="true" />
                {startupReadySteps} listos / {startupLinkedSteps} verificables por health
              </p>
            </div>
            <span className={startupChecklist.isFetching || healthOverview.isFetching ? "status loading" : "status"}>
              {startupChecklist.isFetching || healthOverview.isFetching ? "Consultando" : "Listo"}
            </span>
          </div>

          {startupChecklist.error ? (
            <div className="error-box">
              No se pudo cargar el checklist de arranque administrativo.
            </div>
          ) : null}

          {healthOverview.error ? (
            <div className="error-box">
              No se pudo refrescar el estado health. Los pasos se muestran sin estado automatico.
            </div>
          ) : null}

          <StartupPanel
            steps={startupSteps}
            healthById={healthById}
            copiedCommand={copiedCommand}
            onCopy={copyCommand}
          />
        </section>
      ) : activeView === "runbook" ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Runbook operativo</h2>
              <p>
                <Search size={14} aria-hidden="true" />
                {runbookItems.length} guias listas para copiar
              </p>
            </div>
            <span className={runbook.isFetching ? "status loading" : "status"}>
              {runbook.isFetching ? "Consultando" : "Listo"}
            </span>
          </div>

          {runbook.error ? (
            <div className="error-box">
              No se pudo cargar el runbook administrativo.
            </div>
          ) : null}

          <RunbookPanel data={runbookItems} copiedCommand={copiedCommand} onCopy={copyCommand} />
        </section>
      ) : activeView === "config" ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Parametros operativos</h2>
              <p>
                <Search size={14} aria-hidden="true" />
                {runtimeConfigItems.length} variables disponibles
              </p>
            </div>
            <span className={runtimeConfig.isFetching ? "status loading" : "status"}>
              {runtimeConfig.isFetching ? "Consultando" : "Listo"}
            </span>
          </div>

          {runtimeConfig.error ? (
            <div className="error-box">
              No se pudo cargar la configuracion runtime administrativa.
            </div>
          ) : null}

          <RuntimeConfigPanel
            items={runtimeConfigItems}
            copiedCommand={copiedCommand}
            onCopy={copyCommand}
          />
        </section>
      ) : activeView === "diagnostic" ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Diagnostico administrativo</h2>
              <p>
                <Search size={14} aria-hidden="true" />
                {diagnosticSummary ? `${diagnosticSummary.ok_sections} OK / ${diagnosticSummary.total_sections} secciones` : "Sin snapshot"}
              </p>
            </div>
            <span className={diagnosticExport.isFetching || diagnosticHistory.isFetching || diagnosticCleanupPending ? "status loading" : "status"}>
              {diagnosticExport.isFetching || diagnosticHistory.isFetching || diagnosticCleanupPending ? "Consultando" : "Listo"}
            </span>
          </div>

          {diagnosticExport.error ? (
            <div className="error-box">
              No se pudo generar el diagnostico administrativo.
            </div>
          ) : null}

          {diagnosticHistory.error ? (
            <div className="error-box">
              No se pudo cargar el historico local de diagnosticos.
            </div>
          ) : null}

          <DiagnosticPanel
            cleanupResult={diagnosticCleanupResult}
            cleaningHistory={diagnosticCleanupPending}
            data={diagnosticExport.data}
            history={diagnosticHistory.data}
            copiedCommand={copiedCommand}
            onCleanupHistory={() => {
              if (window.confirm("Eliminar snapshots antiguos y conservar los ultimos 20?")) {
                cleanupDiagnosticHistory.mutate();
              }
            }}
            onCopy={copyCommand}
            onPreviewCleanup={() => previewDiagnosticCleanup.mutate()}
            onSaveSnapshot={() => saveDiagnosticSnapshot.mutate()}
            savingSnapshot={saveDiagnosticSnapshot.isPending}
          />
        </section>
      ) : activeView === "production" ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Preparacion para produccion</h2>
              <p>
                <Search size={14} aria-hidden="true" />
                {productionReadiness.data
                  ? `${productionReadiness.data.totals.ready} listos / ${productionReadiness.data.totals.total} evaluaciones`
                  : "Sin evaluacion"}
              </p>
            </div>
            <span className={productionReadiness.isFetching ? "status loading" : "status"}>
              {productionReadiness.isFetching ? "Consultando" : "Listo"}
            </span>
          </div>

          {productionReadiness.error ? (
            <div className="error-box">
              No se pudo generar la matriz de preparacion para produccion.
            </div>
          ) : null}

          <ProductionReadinessPanel data={productionReadiness.data} />
        </section>
      ) : (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Eventos auditables</h2>
              <p>
                <Search size={14} aria-hidden="true" />
                {visibleRows} visibles / {totalItems} total
              </p>
            </div>
            <span className={auditEvents.isFetching ? "status loading" : "status"}>
              {auditEvents.isFetching ? "Consultando" : "Listo"}
            </span>
          </div>

          {overview.error || auditEvents.error ? (
            <div className="error-box">
              No se pudo consultar audit-service. Valida que este activo en
              http://localhost:8086/api/v1/audit o arranca el frontend con -AuditApiUrl.
            </div>
          ) : null}

          {createSampleEvent.error ? (
            <div className="error-box">
              No se pudo registrar el evento de prueba. Revisa la disponibilidad de audit-service.
            </div>
          ) : null}

          <AuditTable data={auditEvents.data?.data ?? []} />

          <div className="pager">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              Anterior
            </button>
            <span>
              Pagina {page} de {totalPages || 1}
            </span>
            <button type="button" disabled={totalPages === 0 || page >= totalPages} onClick={() => setPage((value) => value + 1)}>
              Siguiente
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
