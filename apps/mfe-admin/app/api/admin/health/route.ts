import { applyCloudRunAuthorization } from "../../_lib/cloudRunAuth";

type HealthGroup = "backend" | "frontend";
type HealthStatus = "down" | "up";

type HealthTarget = {
  group: HealthGroup;
  id: string;
  name: string;
  url: string;
};

type HealthCheckResult = HealthTarget & {
  checked_at: string;
  http_status: number | null;
  latency_ms: number;
  message: string;
  payload: unknown;
  status: HealthStatus;
};

const fallbackTimeoutMs = 2500;

export const dynamic = "force-dynamic";

function envUrl(key: string, fallback: string) {
  return process.env[key] || fallback;
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function resolveTimeoutMs() {
  const configured = Number(process.env.ADMIN_HEALTH_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : fallbackTimeoutMs;
}

function defaultTargets(): HealthTarget[] {
  const adminBaseUrl = normalizeBaseUrl(
    process.env.NEXT_PUBLIC_MFE_PUBLIC_URL || "http://localhost:3005"
  );

  return [
    {
      group: "frontend",
      id: "frontend-shell",
      name: "Frontend Shell",
      url: envUrl("ADMIN_SHELL_HEALTH_URL", "http://localhost:3000/api/health")
    },
    {
      group: "frontend",
      id: "mfe-identity",
      name: "MFE Identity",
      url: envUrl("ADMIN_MFE_IDENTITY_HEALTH_URL", "http://localhost:3001/api/health")
    },
    {
      group: "frontend",
      id: "mfe-dispatch",
      name: "MFE Dispatch",
      url: envUrl("ADMIN_MFE_DISPATCH_HEALTH_URL", "http://localhost:3002/api/health")
    },
    {
      group: "frontend",
      id: "mfe-ticketing",
      name: "MFE Ticketing",
      url: envUrl("ADMIN_MFE_TICKETING_HEALTH_URL", "http://localhost:3003/api/health")
    },
    {
      group: "frontend",
      id: "mfe-reporting",
      name: "MFE Reporting",
      url: envUrl("ADMIN_MFE_REPORTING_HEALTH_URL", "http://localhost:3004/api/health")
    },
    {
      group: "frontend",
      id: "mfe-admin",
      name: "MFE Admin",
      url: envUrl("ADMIN_MFE_ADMIN_HEALTH_URL", `${adminBaseUrl}/api/health`)
    },
    {
      group: "backend",
      id: "identity-service",
      name: "Identity Service",
      url: envUrl("ADMIN_IDENTITY_HEALTH_URL", "http://localhost:8081/api/v1/identity/health")
    },
    {
      group: "backend",
      id: "dispatch-service",
      name: "Dispatch Service",
      url: envUrl("ADMIN_DISPATCH_HEALTH_URL", "http://localhost:8082/api/v1/dispatch/health")
    },
    {
      group: "backend",
      id: "ticketing-service",
      name: "Ticketing Service",
      url: envUrl("ADMIN_TICKETING_HEALTH_URL", "http://localhost:8083/api/v1/ticketing/health")
    },
    {
      group: "backend",
      id: "document-service",
      name: "Document Service",
      url: envUrl("ADMIN_DOCUMENT_HEALTH_URL", "http://localhost:8084/api/v1/document/health")
    },
    {
      group: "backend",
      id: "reporting-service",
      name: "Reporting Service",
      url: envUrl("ADMIN_REPORTING_HEALTH_URL", "http://localhost:8085/api/v1/reporting/health")
    },
    {
      group: "backend",
      id: "audit-service",
      name: "Audit Service",
      url: envUrl("ADMIN_AUDIT_HEALTH_URL", "http://localhost:8086/api/v1/audit/health")
    }
  ];
}

async function probeTarget(target: HealthTarget, timeoutMs: number): Promise<HealthCheckResult> {
  const checkedAt = new Date().toISOString();
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = new Headers();
    await applyCloudRunAuthorization(headers, new URL(target.url));

    const response = await fetch(target.url, {
      cache: "no-store",
      headers,
      signal: controller.signal
    });
    const text = await response.text();
    let payload: unknown = text;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text.slice(0, 180);
      }
    }

    return {
      ...target,
      checked_at: checkedAt,
      http_status: response.status,
      latency_ms: Math.round(performance.now() - startedAt),
      message: response.ok ? "Disponible" : `HTTP ${response.status}`,
      payload,
      status: response.ok ? "up" : "down"
    };
  } catch (error) {
    return {
      ...target,
      checked_at: checkedAt,
      http_status: null,
      latency_ms: Math.round(performance.now() - startedAt),
      message: error instanceof Error ? error.message : "No disponible",
      payload: null,
      status: "down"
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildTotals(checks: HealthCheckResult[]) {
  const frontend = checks.filter((check) => check.group === "frontend");
  const backend = checks.filter((check) => check.group === "backend");
  const up = checks.filter((check) => check.status === "up").length;

  return {
    backend_down: backend.filter((check) => check.status === "down").length,
    backend_total: backend.length,
    backend_up: backend.filter((check) => check.status === "up").length,
    down: checks.length - up,
    frontend_down: frontend.filter((check) => check.status === "down").length,
    frontend_total: frontend.length,
    frontend_up: frontend.filter((check) => check.status === "up").length,
    total: checks.length,
    up
  };
}

export async function GET() {
  const timeoutMs = resolveTimeoutMs();
  const checks = await Promise.all(defaultTargets().map((target) => probeTarget(target, timeoutMs)));
  const totals = buildTotals(checks);

  return Response.json({
    checks,
    generated_at: new Date().toISOString(),
    status: totals.down === 0 ? "up" : "degraded",
    timeout_ms: timeoutMs,
    totals
  });
}
