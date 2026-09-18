type DiagnosticSection = {
  error: string | null;
  ok: boolean;
  path: string;
  payload: unknown;
  status: number | null;
};

const sections = [
  { id: "manifest", path: "/mfe/manifest" },
  { id: "health", path: "/api/admin/health" },
  { id: "runbook", path: "/api/admin/runbook" },
  { id: "startup_checklist", path: "/api/admin/startup-checklist" },
  { id: "runtime_config", path: "/api/admin/runtime-config" },
  { id: "production_readiness", path: "/api/admin/production-readiness" }
] as const;

export const dynamic = "force-dynamic";

async function readSection(requestUrl: string, path: string): Promise<DiagnosticSection> {
  const targetUrl = new URL(path, requestUrl);

  try {
    const response = await fetch(targetUrl, { cache: "no-store" });
    const text = await response.text();
    let payload: unknown = text;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text.slice(0, 500);
      }
    }

    return {
      error: response.ok ? null : `HTTP ${response.status}`,
      ok: response.ok,
      path,
      payload,
      status: response.status
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo consultar la seccion.",
      ok: false,
      path,
      payload: null,
      status: null
    };
  }
}

function buildSummary(results: Record<string, DiagnosticSection>) {
  const values = Object.values(results);
  const health = results.health.payload as
    | {
        status?: string;
        totals?: {
          down?: number;
          total?: number;
          up?: number;
        };
      }
    | null;
  const runbook = results.runbook.payload as { total_items?: number } | null;
  const startupChecklist = results.startup_checklist.payload as { total_steps?: number } | null;
  const runtimeConfig = results.runtime_config.payload as
    | {
        summary?: {
          defaults?: number;
          from_env?: number;
          total_items?: number;
        };
      }
    | null;
  const productionReadiness = results.production_readiness.payload as
    | {
        score_percent?: number;
        totals?: {
          missing?: number;
          ready?: number;
          warning?: number;
        };
      }
    | null;

  return {
    failed_sections: values.filter((section) => !section.ok).length,
    health_down: health?.totals?.down ?? null,
    health_status: health?.status ?? null,
    health_total: health?.totals?.total ?? null,
    health_up: health?.totals?.up ?? null,
    ok_sections: values.filter((section) => section.ok).length,
    runbook_items: runbook?.total_items ?? null,
    runtime_config_defaults: runtimeConfig?.summary?.defaults ?? null,
    runtime_config_from_env: runtimeConfig?.summary?.from_env ?? null,
    runtime_config_items: runtimeConfig?.summary?.total_items ?? null,
    production_readiness_missing: productionReadiness?.totals?.missing ?? null,
    production_readiness_ready: productionReadiness?.totals?.ready ?? null,
    production_readiness_score: productionReadiness?.score_percent ?? null,
    production_readiness_warning: productionReadiness?.totals?.warning ?? null,
    startup_steps: startupChecklist?.total_steps ?? null,
    total_sections: values.length
  };
}

export async function GET(request: Request) {
  const entries = await Promise.all(
    sections.map(async (section) => [section.id, await readSection(request.url, section.path)] as const)
  );
  const results = Object.fromEntries(entries);
  const payload = {
    generated_at: new Date().toISOString(),
    sections: results,
    summary: buildSummary(results)
  };

  return Response.json(payload, {
    headers: {
      "content-disposition": "attachment; filename=venta-pasajes-admin-diagnostic.json"
    }
  });
}
