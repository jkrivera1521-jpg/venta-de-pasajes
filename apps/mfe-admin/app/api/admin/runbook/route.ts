type RunbookGroup = "backend" | "frontend";

type RunbookCommand = {
  command: string;
  title: string;
};

type RunbookItem = {
  docs: string[];
  group: RunbookGroup;
  health_url: string;
  id: string;
  name: string;
  ports: number[];
  start_commands: RunbookCommand[];
  verify_commands: RunbookCommand[];
};

type FrontendConfig = {
  docs: string[];
  id: string;
  name: string;
  port: number;
  workspace: string;
};

type BackendConfig = {
  apiSegment: string;
  docs: string[];
  id: string;
  name: string;
  port: number;
  serviceDir: string;
  verifyScript: string;
};

export const dynamic = "force-dynamic";

function command(title: string, value: string): RunbookCommand {
  return { command: value, title };
}

function frontend(config: FrontendConfig): RunbookItem {
  const baseUrl = `http://localhost:${config.port}`;

  return {
    docs: config.docs,
    group: "frontend",
    health_url: `${baseUrl}/api/health`,
    id: config.id,
    name: config.name,
    ports: [config.port],
    start_commands: [
      command("Arrancar", `npm run dev -w ${config.workspace} -- --hostname 127.0.0.1 -p ${config.port}`),
      command("Arranque guiado", "powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\start-frontend-dev.ps1")
    ],
    verify_commands: [
      command("Typecheck", `npm run typecheck -w ${config.workspace}`),
      command("Health", `curl.exe -s ${baseUrl}/api/health`),
      command("Manifest", `curl.exe -s ${baseUrl}/mfe/manifest`)
    ]
  };
}

function backend(config: BackendConfig): RunbookItem {
  const healthUrl = `http://localhost:${config.port}/api/v1/${config.apiSegment}/health`;

  return {
    docs: config.docs,
    group: "backend",
    health_url: healthUrl,
    id: config.id,
    name: config.name,
    ports: [config.port],
    start_commands: [
      command("Verificacion local", `powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\${config.verifyScript}`),
      command("Health", `curl.exe -s ${healthUrl}`)
    ],
    verify_commands: [
      command("Compilar", `mvn -f .\\services\\${config.serviceDir}\\pom.xml package`),
      command("Health", `curl.exe -s ${healthUrl}`)
    ]
  };
}

const runbookItems: RunbookItem[] = [
  frontend({
    docs: ["docs\\dia-40-tanstack-query-frontends.md", "docs\\dia-44-visor-salud-admin.md"],
    id: "frontend-shell",
    name: "Frontend Shell",
    port: 3000,
    workspace: "@venta-pasajes/frontend-shell"
  }),
  frontend({
    docs: ["docs\\dia-19-mfe-identity.md", "docs\\dia-40-tanstack-query-frontends.md"],
    id: "mfe-identity",
    name: "MFE Identity",
    port: 3001,
    workspace: "@venta-pasajes/mfe-identity"
  }),
  frontend({
    docs: ["docs\\dia-25-mfe-dispatch.md", "docs\\dia-40-tanstack-query-frontends.md"],
    id: "mfe-dispatch",
    name: "MFE Dispatch",
    port: 3002,
    workspace: "@venta-pasajes/mfe-dispatch"
  }),
  frontend({
    docs: [
      "docs\\dia-33-mfe-ticketing-base.md",
      "docs\\dia-34-mapa-visual-asientos-avanzado.md",
      "docs\\dia-40-tanstack-query-frontends.md"
    ],
    id: "mfe-ticketing",
    name: "MFE Ticketing",
    port: 3003,
    workspace: "@venta-pasajes/mfe-ticketing"
  }),
  frontend({
    docs: ["docs\\dia-41-mfe-reporting.md", "docs\\dia-40-tanstack-query-frontends.md"],
    id: "mfe-reporting",
    name: "MFE Reporting",
    port: 3004,
    workspace: "@venta-pasajes/mfe-reporting"
  }),
  frontend({
    docs: [
      "docs\\dia-43-mfe-admin.md",
      "docs\\dia-44-visor-salud-admin.md",
      "docs\\dia-45-runbook-operativo-admin.md"
    ],
    id: "mfe-admin",
    name: "MFE Admin",
    port: 3005,
    workspace: "@venta-pasajes/mfe-admin"
  }),
  backend({
    apiSegment: "identity",
    docs: ["docs\\dia-17-identity-service-base.md", "docs\\dia-18-autenticacion-autorizacion.md"],
    id: "identity-service",
    name: "Identity Service",
    port: 8081,
    serviceDir: "identity-service",
    verifyScript: "verify-identity-service-local.ps1"
  }),
  backend({
    apiSegment: "dispatch",
    docs: ["docs\\dia-21-dispatch-service-base.md", "docs\\dia-24-salidas-programadas.md"],
    id: "dispatch-service",
    name: "Dispatch Service",
    port: 8082,
    serviceDir: "dispatch-service",
    verifyScript: "verify-dispatch-service-local.ps1"
  }),
  backend({
    apiSegment: "ticketing",
    docs: [
      "docs\\dia-27-ticketing-service-base.md",
      "docs\\dia-31-anulacion-liberacion.md",
      "docs\\dia-38-integracion-ticketing-documentos.md"
    ],
    id: "ticketing-service",
    name: "Ticketing Service",
    port: 8083,
    serviceDir: "ticketing-service",
    verifyScript: "verify-ticketing-service-local.ps1"
  }),
  backend({
    apiSegment: "document",
    docs: ["docs\\dia-37-document-service.md", "docs\\dia-38-integracion-ticketing-documentos.md"],
    id: "document-service",
    name: "Document Service",
    port: 8084,
    serviceDir: "document-service",
    verifyScript: "verify-document-service-local.ps1"
  }),
  backend({
    apiSegment: "reporting",
    docs: ["docs\\dia-39-reporting-service-base.md", "docs\\dia-41-mfe-reporting.md"],
    id: "reporting-service",
    name: "Reporting Service",
    port: 8085,
    serviceDir: "reporting-service",
    verifyScript: "verify-reporting-service-local.ps1"
  }),
  backend({
    apiSegment: "audit",
    docs: ["docs\\dia-42-audit-service.md", "docs\\dia-43-mfe-admin.md"],
    id: "audit-service",
    name: "Audit Service",
    port: 8086,
    serviceDir: "audit-service",
    verifyScript: "verify-audit-service-local.ps1"
  })
];

export function GET() {
  return Response.json({
    generated_at: new Date().toISOString(),
    items: runbookItems,
    total_items: runbookItems.length
  });
}
