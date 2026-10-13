import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

type DiagnosticSummary = {
  failed_sections?: number | null;
  health_status?: string | null;
  health_total?: number | null;
  health_up?: number | null;
  ok_sections?: number | null;
  runbook_items?: number | null;
  runtime_config_items?: number | null;
  startup_steps?: number | null;
  total_sections?: number | null;
};

type DiagnosticPayload = {
  generated_at?: string;
  sections?: unknown;
  summary?: DiagnosticSummary;
};

type DiagnosticSnapshot = {
  created_at: string;
  file_name: string;
  path: string;
  size_bytes: number;
  summary: DiagnosticSummary;
};

const filePrefix = "admin-diagnostic-";
const fileSuffix = ".json";
const defaultRetentionKeep = 20;

export const dynamic = "force-dynamic";

function resolveProjectRoot() {
  const cwd = process.cwd();
  const mfeAdminPath = path.join("apps", "mfe-admin");

  if (cwd.endsWith(mfeAdminPath)) {
    return path.resolve(cwd, "..", "..");
  }

  return cwd;
}

function resolveDiagnosticDirectory() {
  return process.env.ADMIN_DIAGNOSTIC_DIR || path.join(resolveProjectRoot(), "logs", "admin-diagnostics");
}

function toFileTimestamp(value?: string) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().replace(/[:.]/g, "-");
  }

  return date.toISOString().replace(/[:.]/g, "-");
}

function numberDelta(current?: number | null, previous?: number | null) {
  if (typeof current !== "number" || typeof previous !== "number") return null;
  return current - previous;
}

function parseKeep(value: string | null) {
  const parsed = Number(value ?? defaultRetentionKeep);

  if (!Number.isFinite(parsed)) return defaultRetentionKeep;

  return Math.min(100, Math.max(1, Math.trunc(parsed)));
}

function parseDryRun(value: string | null) {
  return value !== "false";
}

function compareSnapshots(current: DiagnosticSnapshot | null, previous: DiagnosticSnapshot | null) {
  if (!current || !previous) return null;

  return {
    baseline_file: previous.file_name,
    current_file: current.file_name,
    deltas: {
      failed_sections: numberDelta(current.summary.failed_sections, previous.summary.failed_sections),
      health_up: numberDelta(current.summary.health_up, previous.summary.health_up),
      ok_sections: numberDelta(current.summary.ok_sections, previous.summary.ok_sections),
      runbook_items: numberDelta(current.summary.runbook_items, previous.summary.runbook_items),
      runtime_config_items: numberDelta(current.summary.runtime_config_items, previous.summary.runtime_config_items),
      startup_steps: numberDelta(current.summary.startup_steps, previous.summary.startup_steps),
      total_sections: numberDelta(current.summary.total_sections, previous.summary.total_sections)
    }
  };
}

async function ensureDiagnosticDirectory() {
  const directory = resolveDiagnosticDirectory();
  await mkdir(directory, { recursive: true });
  return directory;
}

async function readSnapshot(directory: string, fileName: string): Promise<DiagnosticSnapshot | null> {
  const fullPath = path.join(directory, fileName);

  try {
    const [metadata, raw] = await Promise.all([stat(fullPath), readFile(fullPath, "utf8")]);
    const payload = JSON.parse(raw) as DiagnosticPayload;

    return {
      created_at: payload.generated_at || metadata.mtime.toISOString(),
      file_name: fileName,
      path: fullPath,
      size_bytes: metadata.size,
      summary: payload.summary || {}
    };
  } catch {
    return null;
  }
}

async function listSnapshots() {
  const directory = await ensureDiagnosticDirectory();
  const entries = await readdir(/* turbopackIgnore: true */ directory);
  const files = entries.filter((entry) => entry.startsWith(filePrefix) && entry.endsWith(fileSuffix));
  const snapshots = (await Promise.all(files.map((fileName) => readSnapshot(directory, fileName))))
    .filter((snapshot): snapshot is DiagnosticSnapshot => Boolean(snapshot))
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
  const latest = snapshots[0] ?? null;
  const previous = snapshots[1] ?? null;

  return {
    comparison: compareSnapshots(latest, previous),
    directory,
    generated_at: new Date().toISOString(),
    latest,
    previous,
    snapshots,
    total_snapshots: snapshots.length
  };
}

export async function GET() {
  return Response.json(await listSnapshots());
}

export async function POST(request: Request) {
  const diagnosticUrl = new URL("/api/admin/diagnostic-export", request.url);
  const response = await fetch(diagnosticUrl, { cache: "no-store" });

  if (!response.ok) {
    return Response.json(
      {
        error: "No se pudo generar el diagnostico base.",
        status: response.status
      },
      { status: 502 }
    );
  }

  const payload = (await response.json()) as DiagnosticPayload;
  const directory = await ensureDiagnosticDirectory();
  const fileName = `${filePrefix}${toFileTimestamp(payload.generated_at)}${fileSuffix}`;
  const fullPath = path.join(directory, fileName);

  await writeFile(fullPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  return Response.json(
    {
      created: await readSnapshot(directory, fileName),
      history: await listSnapshots()
    },
    { status: 201 }
  );
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const keep = parseKeep(url.searchParams.get("keep"));
  const dryRun = parseDryRun(url.searchParams.get("dry_run"));
  const history = await listSnapshots();
  const candidates = history.snapshots.slice(keep);
  const results = await Promise.all(
    candidates.map(async (snapshot) => {
      if (dryRun) {
        return {
          ...snapshot,
          deleted: false as const,
          error: null
        };
      }

      try {
        await unlink(/* turbopackIgnore: true */ snapshot.path);
        return {
          ...snapshot,
          deleted: true as const,
          error: null
        };
      } catch (error) {
        return {
          ...snapshot,
          deleted: false as const,
          error: error instanceof Error ? error.message : "No se pudo eliminar el snapshot."
        };
      }
    })
  );
  const updatedHistory = dryRun ? history : await listSnapshots();

  return Response.json({
    candidate_count: candidates.length,
    deleted_count: results.filter((result) => result.deleted).length,
    directory: history.directory,
    dry_run: dryRun,
    generated_at: new Date().toISOString(),
    keep,
    remaining_count: updatedHistory.total_snapshots,
    snapshots: results
  });
}
