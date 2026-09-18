type RuntimeConfigGroup = "admin" | "backend" | "frontend" | "proxy" | "timeout";

type RuntimeConfigCommand = {
  command: string;
  title: string;
};

type RuntimeConfigItem = {
  commands: RuntimeConfigCommand[];
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

type RuntimeConfigDefinition = Omit<RuntimeConfigItem, "commands" | "source" | "value">;

export const dynamic = "force-dynamic";

function command(title: string, value: string): RuntimeConfigCommand {
  return { command: value, title };
}

function resolveValue(envKey: string, defaultValue: string) {
  const value = process.env[envKey];
  return {
    source: value ? "env" as const : "default" as const,
    value: value || defaultValue
  };
}

function envLocalCommand(envKey: string, value: string) {
  return `$env:${envKey} = "${value}"`;
}

function configItem(definition: RuntimeConfigDefinition): RuntimeConfigItem {
  const resolved = resolveValue(definition.env_key, definition.default_value);

  return {
    ...definition,
    commands: [
      command("Sesion PowerShell", envLocalCommand(definition.env_key, resolved.value)),
      command("Ver valor actual", `echo $env:${definition.env_key}`),
      command("Editar .env.local", `notepad .\\apps\\mfe-admin\\.env.local`)
    ],
    source: resolved.source,
    value: resolved.value
  };
}

const definitions: RuntimeConfigDefinition[] = [
  {
    default_value: "http://localhost:3005",
    description: "URL publica usada por el manifest de mfe-admin.",
    docs: ["docs\\dia-43-mfe-admin.md", "docs\\dia-44-visor-salud-admin.md"],
    env_key: "NEXT_PUBLIC_MFE_PUBLIC_URL",
    group: "admin",
    id: "mfe-admin-public-url",
    restart_required: true
  },
  {
    default_value: "http://localhost:8086/api/v1/audit",
    description: "Base URL server-side para el proxy de audit-service.",
    docs: ["docs\\dia-42-audit-service.md", "docs\\dia-43-mfe-admin.md"],
    env_key: "AUDIT_API_URL",
    group: "proxy",
    id: "audit-api-url",
    restart_required: true
  },
  {
    default_value: "http://localhost:8086/api/v1/audit",
    description: "Base URL publica de audit-service para configuraciones frontend.",
    docs: ["docs\\dia-42-audit-service.md", "docs\\dia-43-mfe-admin.md"],
    env_key: "NEXT_PUBLIC_AUDIT_API_URL",
    group: "proxy",
    id: "audit-public-api-url",
    restart_required: true
  },
  {
    default_value: "http://localhost:3000/api/health",
    description: "Health URL de frontend-shell.",
    docs: ["docs\\dia-40-tanstack-query-frontends.md", "docs\\dia-44-visor-salud-admin.md"],
    env_key: "ADMIN_SHELL_HEALTH_URL",
    group: "frontend",
    id: "frontend-shell-health-url",
    restart_required: true
  },
  {
    default_value: "http://localhost:3001/api/health",
    description: "Health URL de mfe-identity.",
    docs: ["docs\\dia-19-mfe-identity.md", "docs\\dia-44-visor-salud-admin.md"],
    env_key: "ADMIN_MFE_IDENTITY_HEALTH_URL",
    group: "frontend",
    id: "mfe-identity-health-url",
    restart_required: true
  },
  {
    default_value: "http://localhost:3002/api/health",
    description: "Health URL de mfe-dispatch.",
    docs: ["docs\\dia-25-mfe-dispatch.md", "docs\\dia-44-visor-salud-admin.md"],
    env_key: "ADMIN_MFE_DISPATCH_HEALTH_URL",
    group: "frontend",
    id: "mfe-dispatch-health-url",
    restart_required: true
  },
  {
    default_value: "http://localhost:3003/api/health",
    description: "Health URL de mfe-ticketing.",
    docs: ["docs\\dia-33-mfe-ticketing-base.md", "docs\\dia-44-visor-salud-admin.md"],
    env_key: "ADMIN_MFE_TICKETING_HEALTH_URL",
    group: "frontend",
    id: "mfe-ticketing-health-url",
    restart_required: true
  },
  {
    default_value: "http://localhost:3004/api/health",
    description: "Health URL de mfe-reporting.",
    docs: ["docs\\dia-41-mfe-reporting.md", "docs\\dia-44-visor-salud-admin.md"],
    env_key: "ADMIN_MFE_REPORTING_HEALTH_URL",
    group: "frontend",
    id: "mfe-reporting-health-url",
    restart_required: true
  },
  {
    default_value: "http://localhost:3005/api/health",
    description: "Health URL de mfe-admin.",
    docs: ["docs\\dia-43-mfe-admin.md", "docs\\dia-44-visor-salud-admin.md"],
    env_key: "ADMIN_MFE_ADMIN_HEALTH_URL",
    group: "frontend",
    id: "mfe-admin-health-url",
    restart_required: true
  },
  {
    default_value: "http://localhost:8081/api/v1/identity/health",
    description: "Health URL de identity-service.",
    docs: ["docs\\dia-17-identity-service-base.md", "docs\\dia-44-visor-salud-admin.md"],
    env_key: "ADMIN_IDENTITY_HEALTH_URL",
    group: "backend",
    id: "identity-service-health-url",
    restart_required: true
  },
  {
    default_value: "http://localhost:8082/api/v1/dispatch/health",
    description: "Health URL de dispatch-service.",
    docs: ["docs\\dia-21-dispatch-service-base.md", "docs\\dia-44-visor-salud-admin.md"],
    env_key: "ADMIN_DISPATCH_HEALTH_URL",
    group: "backend",
    id: "dispatch-service-health-url",
    restart_required: true
  },
  {
    default_value: "http://localhost:8083/api/v1/ticketing/health",
    description: "Health URL de ticketing-service.",
    docs: ["docs\\dia-27-ticketing-service-base.md", "docs\\dia-44-visor-salud-admin.md"],
    env_key: "ADMIN_TICKETING_HEALTH_URL",
    group: "backend",
    id: "ticketing-service-health-url",
    restart_required: true
  },
  {
    default_value: "http://localhost:8084/api/v1/document/health",
    description: "Health URL de document-service.",
    docs: ["docs\\dia-37-document-service.md", "docs\\dia-44-visor-salud-admin.md"],
    env_key: "ADMIN_DOCUMENT_HEALTH_URL",
    group: "backend",
    id: "document-service-health-url",
    restart_required: true
  },
  {
    default_value: "http://localhost:8085/api/v1/reporting/health",
    description: "Health URL de reporting-service.",
    docs: ["docs\\dia-39-reporting-service-base.md", "docs\\dia-44-visor-salud-admin.md"],
    env_key: "ADMIN_REPORTING_HEALTH_URL",
    group: "backend",
    id: "reporting-service-health-url",
    restart_required: true
  },
  {
    default_value: "http://localhost:8086/api/v1/audit/health",
    description: "Health URL de audit-service.",
    docs: ["docs\\dia-42-audit-service.md", "docs\\dia-44-visor-salud-admin.md"],
    env_key: "ADMIN_AUDIT_HEALTH_URL",
    group: "backend",
    id: "audit-service-health-url",
    restart_required: true
  },
  {
    default_value: "2500",
    description: "Timeout actual del visor de salud en milisegundos. Hoy es informativo.",
    docs: ["docs\\dia-44-visor-salud-admin.md"],
    env_key: "ADMIN_HEALTH_TIMEOUT_MS",
    group: "timeout",
    id: "admin-health-timeout-ms",
    restart_required: true
  }
];

export function GET() {
  const items = definitions.map(configItem);
  const fromEnv = items.filter((item) => item.source === "env").length;

  return Response.json({
    generated_at: new Date().toISOString(),
    items,
    summary: {
      defaults: items.length - fromEnv,
      from_env: fromEnv,
      total_items: items.length
    }
  });
}
