export type ReportFormat = "XLSX" | "DOCX" | "PDF";

export type ReportTemplate = {
  code: string;
  name: string;
  description?: string | null;
  documentType?: string | null;
  status?: string | null;
  activeVersion?: number | null;
  createdBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type TemplateParameter = {
  name: string;
  path: string;
  dataType: string;
  required: boolean;
  repeated: boolean;
  collection: boolean;
  defaultValue?: unknown;
  description?: string | null;
  source?: string | null;
};

function exampleValue(parameter: TemplateParameter) {
  if (parameter.defaultValue !== undefined && parameter.defaultValue !== null) return parameter.defaultValue;
  // `repeated` marks a field rendered inside a loop; it does not make the
  // field itself an array. The array belongs to the loop root or an explicit
  // ARRAY declaration.
  if (parameter.dataType === "ARRAY" || (parameter.collection && !parameter.path.includes("."))) return [];
  switch (parameter.dataType) {
    case "NUMBER": return 0;
    case "BOOLEAN": return false;
    case "OBJECT": return {};
    case "DATE": return "2026-10-01";
    case "STRING": return "Ejemplo";
    default:
      if (/fecha|date/i.test(parameter.path)) return "2026-10-01";
      if (/correo|email/i.test(parameter.path)) return "ejemplo@correo.test";
      return "Ejemplo";
  }
}

function canonicalParameterPath(path: string) {
  const value = path.trim();
  return value.startsWith("${") && value.endsWith("}") ? value.slice(2, -1).trim() : value;
}

function assignExampleValue(target: Record<string, unknown>, path: string, value: unknown, parameter: TemplateParameter) {
  const segments = canonicalParameterPath(path).split(".").filter(Boolean);
  if (!segments.length) return;
  let current = target;
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      current[segment] = value;
      return;
    }
    const existing = current[segment];
    if (index === 0 && parameter.repeated && segments.length > 1) {
      const items = Array.isArray(existing) ? existing : [];
      if (!items.length || !items[0] || typeof items[0] !== "object" || Array.isArray(items[0])) items[0] = {};
      current[segment] = items;
      current = items[0] as Record<string, unknown>;
      return;
    }
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) current[segment] = {};
    current = current[segment] as Record<string, unknown>;
  });
}

export function buildExampleData(parameters: TemplateParameter[]) {
  const example: Record<string, unknown> = {};
  const merged = new Map<string, TemplateParameter>();
  parameters.forEach((parameter) => {
    const path = canonicalParameterPath(parameter.path);
    const previous = merged.get(path);
    if (!previous) {
      merged.set(path, { ...parameter, path });
      return;
    }
    merged.set(path, {
      ...previous,
      dataType: previous.dataType === "UNKNOWN" ? parameter.dataType : previous.dataType,
      required: previous.required || parameter.required,
      repeated: previous.repeated || parameter.repeated,
      collection: previous.collection || parameter.collection || parameter.dataType === "ARRAY",
      defaultValue: previous.defaultValue ?? parameter.defaultValue,
    });
  });
  [...merged.values()]
    .sort((left, right) => left.path.split(".").length - right.path.split(".").length)
    .forEach((parameter) => assignExampleValue(example, parameter.path, exampleValue(parameter), parameter));
  return example;
}

export type TemplateVersion = {
  code: string;
  version: number;
  name: string;
  description?: string | null;
  documentType?: string | null;
  fileName?: string | null;
  contentType?: string | null;
  fileSize?: number | null;
  checksumSha256?: string | null;
  status?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
  activatedAt?: string | null;
  parameters?: TemplateParameter[];
};

export type ReportJob = {
  id: string;
  templateCode?: string;
  templateVersion?: number;
  outputFormat?: string;
  status?: string;
  totalItems?: number;
  processedItems?: number;
  successfulItems?: number;
  failedItems?: number;
  zipFileName?: string;
  downloadUrl?: string | null;
  errorMessage?: string | null;
  createdAt?: string;
  completedAt?: string | null;
  expiresAt?: string;
};

export type ServiceStatus = {
  status?: string;
  service?: string;
  runtime?: string;
  checkedAt?: string;
};

export type ApiProblem = {
  code?: string;
  detail?: string;
  message?: string;
  status?: number;
  traceId?: string;
};

export const defaultGenerateData = JSON.stringify({
  empresa: { nombre: "Venta de Pasajes" },
  periodo: "2026-10",
  ventas: [{ fecha: "2026-10-01", total: 125.5 }],
}, null, 2);

export const defaultBatchData = JSON.stringify({
  templateCode: "VENTAS_MENSUALES",
  templateVersion: 1,
  outputFormat: "XLSX",
  zipFileName: "reportes.zip",
  documents: [
    { fileName: "sucursal-norte.xlsx", data: { empresa: { nombre: "Sucursal Norte" }, periodo: "2026-10" } },
    { fileName: "sucursal-sur.xlsx", data: { empresa: { nombre: "Sucursal Sur" }, periodo: "2026-10" } },
  ],
}, null, 2);

export function readableError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const value = payload as ApiProblem;
    if (typeof value.detail === "string" && value.detail.trim()) return value.detail;
    if (typeof value.message === "string" && value.message.trim()) return value.message;
    if (typeof value.code === "string" && value.code.trim()) return `${value.code}: ${fallback}`;
  }
  return fallback;
}

export function displayValue(value: unknown) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("es-EC");
}

export function formatBytes(value?: number | null) {
  if (!value && value !== 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
