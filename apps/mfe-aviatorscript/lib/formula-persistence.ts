import type { FormulaDocument, FormulaTemplate } from "./formula";

export const FORMULA_STORAGE_KEY = "aviatorscript-formulas-v1";
export const TEMPLATE_CATALOG_STORAGE_KEY = "aviatorscript-template-catalog-v1";

export type SavedFormula = Pick<FormulaDocument, "name" | "updatedAt" | "expression" | "workspace">;

export function makeFormulaDocument(name: string, expression: FormulaDocument["expression"], workspace: unknown): FormulaDocument {
  return {
    format: "aviatorscript-formula",
    version: 1,
    name: name.trim() || "Formula sin titulo",
    expression,
    workspace,
    updatedAt: new Date().toISOString()
  };
}

export function saveFormulaToBrowser(formula: FormulaDocument) {
  let existing: SavedFormula[] = [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FORMULA_STORAGE_KEY) ?? "[]") as unknown;
    if (Array.isArray(parsed)) existing = parsed as SavedFormula[];
  } catch {
    existing = [];
  }
  const saved = [formula, ...existing.filter((item) => item.name !== formula.name)].slice(0, 25);
  window.localStorage.setItem(FORMULA_STORAGE_KEY, JSON.stringify(saved));
}

export function readCachedTemplateCatalog() {
  if (typeof window === "undefined") return [] as FormulaTemplate[];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TEMPLATE_CATALOG_STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is FormulaTemplate => Boolean(
      item && typeof item === "object" && "codigo" in item && "version" in item
    ));
  } catch {
    return [] as FormulaTemplate[];
  }
}

export function cacheTemplateCatalog(templates: FormulaTemplate[]) {
  try {
    window.localStorage.setItem(TEMPLATE_CATALOG_STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // El catalogo remoto sigue funcionando aunque el almacenamiento local no este disponible.
  }
}

export function downloadFormula(formula: FormulaDocument) {
  const file = new Blob([JSON.stringify(formula, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${formula.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "formula"}.aviatorscript.json`;
  link.click();
  URL.revokeObjectURL(url);
}
