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

export function sortReportTemplatesByCreatedAt(templates: ReportTemplate[]) {
  return [...templates].sort((left, right) => {
    const leftCreatedAt = left.createdAt ? Date.parse(left.createdAt) : Number.NEGATIVE_INFINITY;
    const rightCreatedAt = right.createdAt ? Date.parse(right.createdAt) : Number.NEGATIVE_INFINITY;
    const leftTimestamp = Number.isFinite(leftCreatedAt) ? leftCreatedAt : Number.NEGATIVE_INFINITY;
    const rightTimestamp = Number.isFinite(rightCreatedAt) ? rightCreatedAt : Number.NEGATIVE_INFINITY;
    if (rightTimestamp !== leftTimestamp) return rightTimestamp - leftTimestamp;
    return left.code.localeCompare(right.code);
  });
}

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

export type TemplateInspection = {
  engine?: string | null;
  features?: string[];
  xmlRoot?: string | null;
  warnings?: string[];
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

type ExampleObject = Record<string, unknown>;

function hasDescendant(path: string, paths: Set<string>) {
  return [...paths].some((candidate) => candidate.startsWith(`${path}.`));
}

function mergeExampleValue(existing: unknown, value: unknown) {
  if (Array.isArray(existing) && Array.isArray(value)) {
    // Keep the representative item created for a collection when a later
    // parameter describes the same collection as an empty ARRAY value.
    return existing.length > 0 && value.length === 0 ? existing : value;
  }
  if (existing && typeof existing === "object" && !Array.isArray(existing)
      && value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(existing as ExampleObject), ...(value as ExampleObject) };
  }
  return value;
}

function assignExampleValue(
  target: ExampleObject,
  path: string,
  value: unknown,
  collectionPaths: Set<string>,
) {
  const segments = canonicalParameterPath(path).split(".").filter(Boolean);
  if (!segments.length) return;

  const assign = (current: unknown, index: number): void => {
    if (Array.isArray(current)) {
      if (!current.length) current.push({});
      assign(current[0], index);
      return;
    }
    if (!current || typeof current !== "object") return;

    const object = current as ExampleObject;
    const segment = segments[index];
    if (index === segments.length - 1) {
      object[segment] = mergeExampleValue(object[segment], value);
      return;
    }

    const childPath = segments.slice(0, index + 1).join(".");
    const existing = object[segment];
    if (existing === undefined || existing === null || typeof existing !== "object") {
      object[segment] = collectionPaths.has(childPath) ? [{}] : {};
    } else if (collectionPaths.has(childPath) && !Array.isArray(existing)) {
      object[segment] = [existing];
    }
    assign(object[segment], index + 1);
  };

  assign(target, 0);
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

  const mergedParameters = [...merged.values()];
  const paths = new Set(mergedParameters.map((parameter) => parameter.path));
  const collectionPaths = new Set<string>();
  mergedParameters.forEach((parameter) => {
    const segments = parameter.path.split(".").filter(Boolean);
    if (parameter.collection || parameter.dataType === "ARRAY") collectionPaths.add(parameter.path);
    // A repeated nested field implies a collection at its first repeated
    // segment even when the extractor could not emit an explicit ARRAY row.
    if (parameter.repeated && segments.length > 1) collectionPaths.add(segments[0]);
  });

  // Materialize one representative object at every collection level before
  // assigning leaf values. This is what lets `viajes.pasajeros.nombre` become
  // [{ pasajeros: [{ nombre: "Ejemplo" }] }] instead of losing the inner array.
  [...collectionPaths]
    .sort((left, right) => left.split(".").length - right.split(".").length)
    .forEach((path) => {
      const parameter = merged.get(path);
      const value = parameter && !hasDescendant(path, paths)
        ? parameter.dataType === "ARRAY" ? exampleValue(parameter) : [exampleValue(parameter)]
        : [{}];
      assignExampleValue(example, path, value, collectionPaths);
    });

  mergedParameters
    .sort((left, right) => left.path.split(".").length - right.path.split(".").length)
    .forEach((parameter) => assignExampleValue(example, parameter.path, exampleValue(parameter), collectionPaths));
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
  inspection?: TemplateInspection | null;
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
