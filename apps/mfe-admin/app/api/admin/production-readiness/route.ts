import { readdir, stat } from "node:fs/promises";
import path from "node:path";

type ReadinessStatus = "missing" | "ready" | "warning";

type ReadinessItem = {
  category: "calidad" | "datos" | "funcional" | "infraestructura" | "operacion" | "seguridad";
  evidence: string[];
  id: string;
  missing: string[];
  recommendation: string;
  status: ReadinessStatus;
  title: string;
};

type ReadinessCategory = {
  id: ReadinessItem["category"];
  missing: number;
  ready: number;
  score_percent: number;
  status: ReadinessStatus;
  title: string;
  total: number;
  warning: number;
};

const categoryTitles: Record<ReadinessItem["category"], string> = {
  calidad: "Calidad y pruebas",
  datos: "Datos y respaldo",
  funcional: "Funcionalidad",
  infraestructura: "Infraestructura",
  operacion: "Operacion",
  seguridad: "Seguridad"
};

const requiredApps = [
  "frontend-shell",
  "mfe-admin",
  "mfe-dispatch",
  "mfe-identity",
  "mfe-reporting",
  "mfe-ticketing"
];

const requiredServices = [
  "audit-service",
  "dispatch-service",
  "document-service",
  "identity-service",
  "reporting-service",
  "ticketing-service"
];

export const dynamic = "force-dynamic";

function resolveProjectRoot() {
  const cwd = process.cwd();
  const mfeAdminPath = path.join("apps", "mfe-admin");

  if (cwd.endsWith(mfeAdminPath)) {
    return path.resolve(cwd, "..", "..");
  }

  return cwd;
}

function itemScore(status: ReadinessStatus) {
  if (status === "ready") return 1;
  if (status === "warning") return 0.5;
  return 0;
}

function statusFromScore(score: number): ReadinessStatus {
  if (score >= 85) return "ready";
  if (score >= 60) return "warning";
  return "missing";
}

async function exists(projectRoot: string, relativePath: string) {
  try {
    await stat(path.join(projectRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function countFiles(projectRoot: string, relativePath: string, predicate: (fileName: string) => boolean) {
  const basePath = path.join(projectRoot, relativePath);

  async function walk(currentPath: string): Promise<number> {
    let entries;

    try {
      entries = await readdir(/* turbopackIgnore: true */ currentPath, { withFileTypes: true });
    } catch {
      return 0;
    }

    const counts = await Promise.all(
      entries
        .filter((entry) => ![".next", "node_modules", "target"].includes(entry.name))
        .map(async (entry) => {
          const entryPath = path.join(currentPath, entry.name);

          if (entry.isDirectory()) {
            return walk(entryPath);
          }

          return predicate(entry.name) ? 1 : 0;
        })
    );

    return counts.reduce((total, count) => total + count, 0);
  }

  return walk(basePath);
}

async function countMeaningfulFiles(projectRoot: string, relativePath: string) {
  return countFiles(projectRoot, relativePath, (fileName) => fileName !== ".gitkeep");
}

function buildCategorySummary(items: ReadinessItem[]): ReadinessCategory[] {
  return Object.entries(categoryTitles).map(([id, title]) => {
    const categoryItems = items.filter((item) => item.category === id);
    const ready = categoryItems.filter((item) => item.status === "ready").length;
    const warning = categoryItems.filter((item) => item.status === "warning").length;
    const missing = categoryItems.filter((item) => item.status === "missing").length;
    const score = categoryItems.length
      ? Math.round((categoryItems.reduce((total, item) => total + itemScore(item.status), 0) / categoryItems.length) * 100)
      : 0;

    return {
      id: id as ReadinessItem["category"],
      missing,
      ready,
      score_percent: score,
      status: statusFromScore(score),
      title,
      total: categoryItems.length,
      warning
    };
  });
}

async function buildReadiness(projectRoot: string): Promise<ReadinessItem[]> {
  const appResults = await Promise.all(
    requiredApps.map(async (app) => ({
      app,
      appDir: await exists(projectRoot, path.join("apps", app, "app")),
      packageJson: await exists(projectRoot, path.join("apps", app, "package.json"))
    }))
  );
  const serviceResults = await Promise.all(
    requiredServices.map(async (service) => ({
      migrations: await countFiles(projectRoot, path.join("services", service, "src", "main", "resources", "db", "migration"), (fileName) =>
        fileName.endsWith(".sql")
      ),
      pom: await exists(projectRoot, path.join("services", service, "pom.xml")),
      service
    }))
  );
  const backendTestCount = await Promise.all(
    requiredServices.map((service) => countFiles(projectRoot, path.join("services", service, "src", "test"), (fileName) => fileName.endsWith("Test.java")))
  );
  const frontendTestCount = await Promise.all(
    requiredApps.map((app) =>
      countFiles(projectRoot, path.join("apps", app), (fileName) => /\.(spec|test)\.(ts|tsx)$/.test(fileName))
    )
  );
  const frontendScripts = ["start-frontend-dev.ps1", "stop-frontend-dev.ps1"];
  const verificationScripts = [
    "verify-audit-service-local.ps1",
    "verify-document-service-local.ps1",
    "verify-reporting-service-local.ps1",
    "verify-ticketing-document-integration.ps1"
  ];
  const nativeBuildScripts = [
    "build-dispatch-service-native.ps1",
    "build-identity-service-native.ps1",
    "build-ticketing-service-native.ps1"
  ];
  const adminRoutes = [
    "health",
    "runbook",
    "startup-checklist",
    "runtime-config",
    "diagnostic-export",
    "diagnostic-history"
  ];
  const cloudRunFiles = await countMeaningfulFiles(projectRoot, "infra/cloudrun");
  const cloudBuildFiles = await countMeaningfulFiles(projectRoot, "infra/cloudbuild");
  const terraformFiles = await countMeaningfulFiles(projectRoot, "infra/terraform");
  const githubWorkflows = await countMeaningfulFiles(projectRoot, ".github/workflows");
  const frontendArtifactWorkflow = await exists(projectRoot, path.join(".github", "workflows", "frontend-artifacts.yml"));
  const frontendArtifactScript = await exists(projectRoot, path.join("scripts", "build-frontend-artifacts.ps1"));
  const gitlabCi = await exists(projectRoot, ".gitlab-ci.yml");
  const scriptsReady = await Promise.all(
    [...frontendScripts, ...verificationScripts].map((script) => exists(projectRoot, path.join("scripts", script)))
  );
  const nativeReady = await Promise.all(nativeBuildScripts.map((script) => exists(projectRoot, path.join("scripts", script))));
  const adminRoutesReady = await Promise.all(
    adminRoutes.map((route) => exists(projectRoot, path.join("apps", "mfe-admin", "app", "api", "admin", route, "route.ts")))
  );
  const identitySecurityFiles = await Promise.all([
    exists(projectRoot, path.join("services", "identity-service", "src", "main", "java", "com", "ventapasajes", "identity", "auth", "JwtService.java")),
    exists(projectRoot, path.join("services", "identity-service", "src", "main", "java", "com", "ventapasajes", "identity", "auth", "BearerAuthFilter.java"))
  ]);
  const secretExamples = await Promise.all([
    exists(projectRoot, path.join("infra", "gcloud", "secrets-dev.json")),
    exists(projectRoot, path.join("infra", "env", "identity-service.gcp.env.example"))
  ]);
  const dbBackupFiles = await countFiles(projectRoot, "scripts", (fileName) => /backup|dump|restore/i.test(fileName));

  return [
    {
      category: "funcional",
      evidence: appResults.filter((result) => result.appDir && result.packageJson).map((result) => result.app),
      id: "frontend-mfes",
      missing: appResults.filter((result) => !result.appDir || !result.packageJson).map((result) => result.app),
      recommendation: "Completar cualquier MFE faltante antes de pruebas integrales.",
      status: appResults.every((result) => result.appDir && result.packageJson) ? "ready" : "missing",
      title: "Microfrontends principales"
    },
    {
      category: "funcional",
      evidence: serviceResults.filter((result) => result.pom).map((result) => result.service),
      id: "backend-services",
      missing: serviceResults.filter((result) => !result.pom).map((result) => result.service),
      recommendation: "Completar servicios backend faltantes o retirarlos del alcance productivo.",
      status: serviceResults.every((result) => result.pom) ? "ready" : "missing",
      title: "Servicios backend principales"
    },
    {
      category: "datos",
      evidence: serviceResults.map((result) => `${result.service}: ${result.migrations} migraciones`),
      id: "db-migrations",
      missing: serviceResults.filter((result) => result.migrations === 0).map((result) => result.service),
      recommendation: "Asegurar migraciones Flyway por cada base operativa.",
      status: serviceResults.every((result) => result.migrations > 0) ? "ready" : "warning",
      title: "Migraciones de base de datos"
    },
    {
      category: "calidad",
      evidence: [`Backend tests detectados: ${backendTestCount.reduce((total, count) => total + count, 0)}`],
      id: "backend-tests",
      missing: [],
      recommendation: "Mantener pruebas unitarias e integracion por flujo critico.",
      status: backendTestCount.some((count) => count > 0) ? "ready" : "missing",
      title: "Pruebas backend"
    },
    {
      category: "calidad",
      evidence: [`Frontend tests detectados: ${frontendTestCount.reduce((total, count) => total + count, 0)}`],
      id: "frontend-tests",
      missing: frontendTestCount.some((count) => count > 0) ? [] : ["Pruebas UI/E2E versionadas"],
      recommendation: "Agregar pruebas de componentes y E2E para venta, despacho, identidad, reporting y admin.",
      status: frontendTestCount.some((count) => count > 0) ? "warning" : "missing",
      title: "Pruebas frontend y E2E"
    },
    {
      category: "operacion",
      evidence: scriptsReady.filter(Boolean).length ? [`Scripts verificados: ${scriptsReady.filter(Boolean).length}`] : [],
      id: "runbooks-scripts",
      missing: scriptsReady.every(Boolean) ? [] : ["Scripts de verificacion operativa completos"],
      recommendation: "Mantener scripts de arranque, parada y verificacion para soporte.",
      status: scriptsReady.every(Boolean) ? "ready" : "warning",
      title: "Scripts operativos"
    },
    {
      category: "operacion",
      evidence: adminRoutesReady.filter(Boolean).length ? [`Rutas admin verificadas: ${adminRoutesReady.filter(Boolean).length}`] : [],
      id: "admin-observability",
      missing: adminRoutesReady.every(Boolean) ? [] : ["Rutas admin de salud, diagnostico o runbook"],
      recommendation: "Usar mfe-admin como consola de operacion y diagnostico.",
      status: adminRoutesReady.every(Boolean) ? "ready" : "warning",
      title: "Observabilidad administrativa"
    },
    {
      category: "infraestructura",
      evidence: [`Cloud Run: ${cloudRunFiles}`, `Cloud Build: ${cloudBuildFiles}`, `Terraform: ${terraformFiles}`],
      id: "deploy-manifests",
      missing: cloudRunFiles + cloudBuildFiles + terraformFiles > 0 ? [] : ["Manifiestos Cloud Run/Cloud Build/Terraform productivos"],
      recommendation: "Crear definiciones de despliegue reproducibles para ambientes dev/stage/prod.",
      status: cloudRunFiles + cloudBuildFiles + terraformFiles > 0 ? "warning" : "missing",
      title: "Despliegue reproducible"
    },
    {
      category: "infraestructura",
      evidence: [
        ...(githubWorkflows || gitlabCi ? [`Workflows CI/CD detectados: ${githubWorkflows}`] : []),
        ...(frontendArtifactWorkflow ? ["Pipeline de artefactos frontend detectado"] : [])
      ],
      id: "ci-cd",
      missing: githubWorkflows || gitlabCi ? (frontendArtifactWorkflow ? [] : ["Pipeline frontend dedicado"]) : ["Pipeline CI/CD versionado"],
      recommendation: "Agregar pipeline con typecheck, tests, build, artefactos, imagenes, seguridad y despliegue controlado.",
      status: githubWorkflows || gitlabCi ? "warning" : "missing",
      title: "CI/CD"
    },
    {
      category: "seguridad",
      evidence: identitySecurityFiles.filter(Boolean).length ? ["JWT y filtro bearer en identity-service"] : [],
      id: "auth-security",
      missing: identitySecurityFiles.every(Boolean) ? ["Hardening final de roles, expiracion, rotacion y politicas por ambiente"] : ["Autenticacion JWT/Bearer"],
      recommendation: "Completar hardening de autenticacion, autorizacion, rotacion de secretos y politicas por rol.",
      status: identitySecurityFiles.every(Boolean) ? "warning" : "missing",
      title: "Autenticacion y autorizacion"
    },
    {
      category: "seguridad",
      evidence: secretExamples.filter(Boolean).length ? [`Referencias de secretos: ${secretExamples.filter(Boolean).length}`] : [],
      id: "secrets",
      missing: secretExamples.every(Boolean) ? ["Verificacion de secretos productivos reales"] : ["Catalogo de secretos por ambiente"],
      recommendation: "Usar Secret Manager o equivalente y validar que no existan secretos reales en repo.",
      status: secretExamples.every(Boolean) ? "warning" : "missing",
      title: "Secretos por ambiente"
    },
    {
      category: "datos",
      evidence: dbBackupFiles ? [`Scripts backup/restore detectados: ${dbBackupFiles}`] : [],
      id: "db-backups",
      missing: dbBackupFiles ? [] : ["Backups, restore drill y retencion de bases de datos"],
      recommendation: "Agregar dumps/restauracion por base y probar recuperacion en ambiente controlado.",
      status: dbBackupFiles ? "warning" : "missing",
      title: "Backups de base de datos"
    },
    {
      category: "infraestructura",
      evidence: [
        ...(nativeReady.filter(Boolean).length ? [`Builds nativos disponibles: ${nativeReady.filter(Boolean).length}`] : []),
        ...(frontendArtifactScript ? ["Script de artefactos frontend disponible"] : [])
      ],
      id: "artifact-images",
      missing: nativeReady.every(Boolean) && frontendArtifactScript
        ? ["Imagenes para todos los servicios y publicacion automatizada"]
        : ["Build nativo/imagen para todos los servicios", "Artefactos frontend versionados"],
      recommendation: "Completar imagenes versionadas para todos los servicios, artefactos frontend y publicarlos por pipeline.",
      status: nativeReady.every(Boolean) ? "warning" : "missing",
      title: "Imagenes y artefactos"
    }
  ];
}

export async function GET() {
  const projectRoot = resolveProjectRoot();
  const items = await buildReadiness(projectRoot);
  const categories = buildCategorySummary(items);
  const ready = items.filter((item) => item.status === "ready").length;
  const warning = items.filter((item) => item.status === "warning").length;
  const missing = items.filter((item) => item.status === "missing").length;
  const score = Math.round((items.reduce((total, item) => total + itemScore(item.status), 0) / items.length) * 100);

  return Response.json({
    categories,
    generated_at: new Date().toISOString(),
    items,
    next_actions: items
      .filter((item) => item.status !== "ready")
      .map((item) => ({
        id: item.id,
        recommendation: item.recommendation,
        status: item.status,
        title: item.title
      })),
    project_root: projectRoot,
    score_percent: score,
    status: statusFromScore(score),
    totals: {
      missing,
      ready,
      total: items.length,
      warning
    }
  });
}
