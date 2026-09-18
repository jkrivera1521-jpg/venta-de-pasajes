type StartupGroup = "backend" | "frontend" | "preflight";

type StartupCommand = {
  command: string;
  title: string;
};

type StartupStep = {
  commands: StartupCommand[];
  description: string;
  docs: string[];
  group: StartupGroup;
  id: string;
  order: number;
  target_id: string | null;
  title: string;
  verify_commands: StartupCommand[];
};

type ServiceStepConfig = {
  apiSegment?: string;
  docs: string[];
  group: "backend" | "frontend";
  id: string;
  name: string;
  order: number;
  port: number;
  serviceDir?: string;
  verifyScript?: string;
  workspace?: string;
};

export const dynamic = "force-dynamic";

function command(title: string, value: string): StartupCommand {
  return { command: value, title };
}

function frontendStep(config: ServiceStepConfig): StartupStep {
  const baseUrl = `http://localhost:${config.port}`;
  const workspace = config.workspace ?? `@venta-pasajes/${config.id}`;

  return {
    commands: [
      command("Arrancar", `npm run dev -w ${workspace} -- --hostname 127.0.0.1 -p ${config.port}`)
    ],
    description: `Levantar ${config.name} en el puerto ${config.port}.`,
    docs: config.docs,
    group: "frontend",
    id: `start-${config.id}`,
    order: config.order,
    target_id: config.id,
    title: config.name,
    verify_commands: [
      command("Health", `curl.exe -s ${baseUrl}/api/health`),
      command("Manifest", `curl.exe -s ${baseUrl}/mfe/manifest`)
    ]
  };
}

function backendStep(config: ServiceStepConfig): StartupStep {
  const apiSegment = config.apiSegment ?? config.id.replace("-service", "");
  const healthUrl = `http://localhost:${config.port}/api/v1/${apiSegment}/health`;

  return {
    commands: [
      command(
        "Verificacion local",
        `powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\${config.verifyScript}`
      )
    ],
    description: `Levantar y verificar ${config.name} en el puerto ${config.port}.`,
    docs: config.docs,
    group: "backend",
    id: `start-${config.id}`,
    order: config.order,
    target_id: config.id,
    title: config.name,
    verify_commands: [
      command("Compilar", `mvn -f .\\services\\${config.serviceDir}\\pom.xml package`),
      command("Health", `curl.exe -s ${healthUrl}`)
    ]
  };
}

const startupSteps: StartupStep[] = [
  {
    commands: [
      command("Node", "node -v"),
      command("NPM", "npm -v"),
      command("Maven", "mvn -v"),
      command("Docker", "docker info")
    ],
    description: "Confirmar herramientas locales antes de levantar servicios.",
    docs: ["docs\\dia-40-tanstack-query-frontends.md", "docs\\dia-45-runbook-operativo-admin.md"],
    group: "preflight",
    id: "preflight-tools",
    order: 1,
    target_id: null,
    title: "Herramientas locales",
    verify_commands: [
      command("Workspaces", "npm run typecheck:frontend"),
      command("Puertos frontend", "Get-NetTCPConnection -LocalPort 3000,3001,3002,3003,3004,3005 -ErrorAction SilentlyContinue")
    ]
  },
  {
    commands: [
      command("Dependencias frontend", "npm install")
    ],
    description: "Confirmar dependencias del monorepo antes de abrir la consola.",
    docs: ["docs\\dia-40-tanstack-query-frontends.md"],
    group: "preflight",
    id: "preflight-dependencies",
    order: 2,
    target_id: null,
    title: "Dependencias del workspace",
    verify_commands: [
      command("Typecheck completo", "npm run typecheck:frontend")
    ]
  },
  backendStep({
    apiSegment: "identity",
    docs: ["docs\\dia-17-identity-service-base.md", "docs\\dia-18-autenticacion-autorizacion.md"],
    group: "backend",
    id: "identity-service",
    name: "Identity Service",
    order: 10,
    port: 8081,
    serviceDir: "identity-service",
    verifyScript: "verify-identity-service-local.ps1"
  }),
  backendStep({
    apiSegment: "dispatch",
    docs: ["docs\\dia-21-dispatch-service-base.md", "docs\\dia-24-salidas-programadas.md"],
    group: "backend",
    id: "dispatch-service",
    name: "Dispatch Service",
    order: 20,
    port: 8082,
    serviceDir: "dispatch-service",
    verifyScript: "verify-dispatch-service-local.ps1"
  }),
  backendStep({
    apiSegment: "ticketing",
    docs: [
      "docs\\dia-27-ticketing-service-base.md",
      "docs\\dia-31-anulacion-liberacion.md",
      "docs\\dia-38-integracion-ticketing-documentos.md"
    ],
    group: "backend",
    id: "ticketing-service",
    name: "Ticketing Service",
    order: 30,
    port: 8083,
    serviceDir: "ticketing-service",
    verifyScript: "verify-ticketing-service-local.ps1"
  }),
  backendStep({
    apiSegment: "document",
    docs: ["docs\\dia-37-document-service.md", "docs\\dia-38-integracion-ticketing-documentos.md"],
    group: "backend",
    id: "document-service",
    name: "Document Service",
    order: 40,
    port: 8084,
    serviceDir: "document-service",
    verifyScript: "verify-document-service-local.ps1"
  }),
  backendStep({
    apiSegment: "reporting",
    docs: ["docs\\dia-39-reporting-service-base.md", "docs\\dia-41-mfe-reporting.md"],
    group: "backend",
    id: "reporting-service",
    name: "Reporting Service",
    order: 50,
    port: 8085,
    serviceDir: "reporting-service",
    verifyScript: "verify-reporting-service-local.ps1"
  }),
  backendStep({
    apiSegment: "audit",
    docs: ["docs\\dia-42-audit-service.md", "docs\\dia-43-mfe-admin.md"],
    group: "backend",
    id: "audit-service",
    name: "Audit Service",
    order: 60,
    port: 8086,
    serviceDir: "audit-service",
    verifyScript: "verify-audit-service-local.ps1"
  }),
  frontendStep({
    docs: ["docs\\dia-40-tanstack-query-frontends.md"],
    group: "frontend",
    id: "frontend-shell",
    name: "Frontend Shell",
    order: 100,
    port: 3000,
    workspace: "@venta-pasajes/frontend-shell"
  }),
  frontendStep({
    docs: ["docs\\dia-19-mfe-identity.md", "docs\\dia-40-tanstack-query-frontends.md"],
    group: "frontend",
    id: "mfe-identity",
    name: "MFE Identity",
    order: 110,
    port: 3001,
    workspace: "@venta-pasajes/mfe-identity"
  }),
  frontendStep({
    docs: ["docs\\dia-25-mfe-dispatch.md", "docs\\dia-40-tanstack-query-frontends.md"],
    group: "frontend",
    id: "mfe-dispatch",
    name: "MFE Dispatch",
    order: 120,
    port: 3002,
    workspace: "@venta-pasajes/mfe-dispatch"
  }),
  frontendStep({
    docs: [
      "docs\\dia-33-mfe-ticketing-base.md",
      "docs\\dia-34-mapa-visual-asientos-avanzado.md",
      "docs\\dia-40-tanstack-query-frontends.md"
    ],
    group: "frontend",
    id: "mfe-ticketing",
    name: "MFE Ticketing",
    order: 130,
    port: 3003,
    workspace: "@venta-pasajes/mfe-ticketing"
  }),
  frontendStep({
    docs: ["docs\\dia-41-mfe-reporting.md", "docs\\dia-40-tanstack-query-frontends.md"],
    group: "frontend",
    id: "mfe-reporting",
    name: "MFE Reporting",
    order: 140,
    port: 3004,
    workspace: "@venta-pasajes/mfe-reporting"
  }),
  frontendStep({
    docs: [
      "docs\\dia-43-mfe-admin.md",
      "docs\\dia-44-visor-salud-admin.md",
      "docs\\dia-45-runbook-operativo-admin.md",
      "docs\\dia-46-arranque-guiado-admin.md"
    ],
    group: "frontend",
    id: "mfe-admin",
    name: "MFE Admin",
    order: 150,
    port: 3005,
    workspace: "@venta-pasajes/mfe-admin"
  })
];

export function GET() {
  const sortedSteps = [...startupSteps].sort((left, right) => left.order - right.order);

  return Response.json({
    generated_at: new Date().toISOString(),
    steps: sortedSteps,
    total_steps: sortedSteps.length
  });
}
