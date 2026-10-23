import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3006";
const chromePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const templateSource = [
  "if (order.amount > 100) {",
  '  return "premium";',
  "} else {",
  '  return "standard";',
  "}"
].join("\n");

const schema = [
  { key: "order.amount", label: "Monto del pedido", type: "number", description: "Monto de prueba." },
  { key: "order.category", label: "Categoria del pedido", type: "string", description: "Categoria de prueba." }
];

const template = {
  id: 1,
  codigo: "FORM-E2E-001",
  nombre: "1.- Formula de prueba con decision",
  descripcion: "Plantilla usada por las pruebas de navegador.",
  version: 1,
  expresion: templateSource,
  ejemplo: {
    idSolicitud: "E2E-0001",
    codigoFormula: "FORM-E2E-001",
    parametros: { order: { amount: 250, category: "ELECTRO" } }
  },
  activa: true,
  estado: "PUBLICADA",
  creadoPor: "playwright",
  fechaCreacion: "2026-10-23T12:00:00Z"
};

async function fulfill(route, body, status = 200) {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    status
  });
}

async function mockApi(page) {
  await page.route("**/api/v1/rules/schema", (route) => fulfill(route, schema));
  await page.route("**/api/v1/calculos/formulas", (route) => fulfill(route, [template]));
  await page.route("**/api/v1/calculos/endpoint", (route) => fulfill(route, { executionUrl: "http://127.0.0.1:8087/api/v1/calculos/ejecutar" }));
  await page.route("**/api/v1/calculos/validar", (route) => fulfill(route, {
    contractVersion: 1,
    diagnostics: [],
    engine: "AviatorScript Java (Playwright fixture)",
    valid: true
  }));
  await page.route("**/api/v1/calculos/probar", (route) => fulfill(route, {
    contractVersion: 1,
    engine: "AviatorScript Java (Playwright fixture)",
    executionTimeMs: 1,
    result: "premium",
    success: true
  }));
  await page.route("**/api/v1/aviator/visualize", (route) => fulfill(route, { error: "Remote graph disabled in browser fixture." }, 503));
}

async function openBuilder(browser, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ acceptDownloads: true, viewport });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(baseURL).origin });
  const page = await context.newPage();
  await mockApi(page);
  await page.goto(`${baseURL}/rules/embedded`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Constructor visual de fórmulas" }).waitFor({ state: "visible" });
  await page.evaluate(() => window.postMessage({
    accessToken: "playwright-fixture-token",
    type: "venta-pasajes:shell-auth-token",
    user: { displayName: "Playwright", login: "playwright", email: "playwright@example.local" }
  }, "*"));
  await page.getByRole("button", { name: "Guardar", exact: true }).waitFor({ state: "visible" });
  await page.getByRole("combobox", { name: "Seleccionar fórmula como plantilla" }).waitFor({ state: "visible" });
  await page.locator(".block-workspace .blocklyBlockCanvas .blocklyBlock").first().waitFor({ state: "visible", timeout: 30_000 });
  return { context, page };
}

async function selectTemplate(page) {
  const select = page.getByRole("combobox", { name: "Seleccionar fórmula como plantilla" });
  await select.selectOption("FORM-E2E-001::1");
  await page.getByText(/cargada como una fórmula nueva/i).waitFor({ state: "visible" });
}

async function assertVisible(locator, message) {
  await locator.waitFor({ state: "visible", timeout: 15_000 });
  assert.equal(await locator.isVisible(), true, message);
}

async function checkTemplateCopyCurl(browser) {
  const { context, page } = await openBuilder(browser);
  try {
    await selectTemplate(page);
    assert.equal(await page.locator("#formula-name").inputValue(), "Nueva - 1.- Formula de prueba con decision");
    await assertVisible(page.getByLabel("Representación: Editable visualmente"), "La plantilla compatible debe quedar editable visualmente.");
    await page.getByRole("button", { name: "Cerrar información de la fórmula" }).click();

    await page.getByRole("button", { name: "Copiar fórmula" }).click();
    await assertVisible(page.getByRole("button", { name: "Fórmula copiada" }), "La fórmula debe copiarse al portapapeles.");

    await page.getByRole("tab", { name: "Probar fórmula" }).click();
    assert.match(await page.getByLabel("Datos de prueba en formato JSON").textContent(), /E2E-0001/);
    await page.getByRole("tab", { name: "cURL" }).click();
    await assertVisible(page.getByLabel("Comando cURL generado"), "La pestana cURL debe mostrar el comando generado.");
    assert.match(await page.getByLabel("Comando cURL generado").textContent(), /127\.0\.0\.1:8087/);
    await page.getByRole("button", { name: "Copiar cURL" }).click();
    await assertVisible(page.getByRole("button", { name: "cURL copiado" }), "El comando cURL debe copiarse al portapapeles.");
  } finally {
    await context.close();
  }
}

async function checkBlocklyDragAndMaximize(browser) {
  const { context, page } = await openBuilder(browser);
  try {
    await assertVisible(page.locator('[aria-label="Lienzo de bloques"]'), "El lienzo Blockly debe estar disponible.");
    await assertVisible(page.getByRole("separator", { name: "Ajustar ancho de los paneles" }), "El separador de paneles debe ser accesible en escritorio.");
    const before = await page.locator(".block-workspace .blocklyBlockCanvas .blocklyDraggable").count();
    const valuesCategory = page.locator(".blocklyToolboxCategory").filter({ hasText: "Valores" }).first();
    await assertVisible(valuesCategory, "La categoria Valores debe estar visible en el toolbox.");
    await valuesCategory.click();
    const flyoutBlock = page.locator(".blocklyFlyout .blocklyDraggable").first();
    await assertVisible(flyoutBlock, "El flyout debe mostrar bloques arrastrables.");
    const target = await page.locator(".block-workspace").boundingBox();
    const source = await flyoutBlock.boundingBox();
    assert.ok(target && source, "El origen y destino del arrastre deben tener coordenadas.");
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
    await page.mouse.up();
    await page.waitForFunction((minimum) => document.querySelectorAll(".block-workspace .blocklyBlockCanvas .blocklyDraggable").length > minimum, before);

    await page.getByRole("button", { name: "Maximizar lienzo" }).click();
    const maximized = page.locator('[data-maximized-panel="workspace"]');
    await assertVisible(maximized, "El lienzo debe abrirse maximizado.");
    assert.equal(await maximized.getAttribute("role"), "dialog");
    await page.keyboard.press("Escape");
    assert.equal(await maximized.count(), 0, "Escape debe restaurar el lienzo.");
  } finally {
    await context.close();
  }
}

async function checkMermaidAndDownloads(browser) {
  const { context, page } = await openBuilder(browser);
  try {
    await selectTemplate(page);
    await page.getByRole("button", { name: "Cerrar información de la fórmula" }).click();
    await page.getByRole("tab", { name: "Vista Mermaid" }).click();
    await assertVisible(page.getByRole("region", { name: "Vista Mermaid" }), "La vista Mermaid debe estar disponible.");
    await assertVisible(page.locator(".aviator-mermaid-diagram svg"), "Mermaid debe renderizar un SVG visible.");
    await assertVisible(page.getByText("Renderizado"), "Mermaid debe informar que el diagrama fue renderizado.");

    const theme = page.getByRole("combobox", { name: "Tema del diagrama Mermaid" });
    await theme.selectOption("dark");
    assert.equal(await theme.inputValue(), "dark");
    await page.getByRole("button", { name: "Copiar código Mermaid" }).first().click();
    await assertVisible(page.getByRole("button", { name: "Código Mermaid copiado" }).first(), "El código Mermaid debe copiarse.");

    const svgDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descargar diagrama SVG" }).click();
    assert.match((await svgDownload).suggestedFilename(), /\.svg$/i);

    const pngDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descargar diagrama PNG" }).click();
    assert.match((await pngDownload).suggestedFilename(), /\.png$/i);
  } finally {
    await context.close();
  }
}

async function checkResponsiveAccessibility(browser) {
  const { context, page } = await openBuilder(browser, { width: 390, height: 844 });
  try {
    await assertVisible(page.getByRole("navigation", { name: "Panel de trabajo movil" }), "La navegacion movil debe estar visible.");
    await assertVisible(page.getByRole("tablist", { name: "Vista del espacio de trabajo" }), "Las pestañas del espacio de trabajo deben ser accesibles.");
    await page.getByRole("button", { name: "Maximizar lienzo" }).click();
    const maximized = page.locator('[data-maximized-panel="workspace"]');
    assert.equal(await maximized.getAttribute("aria-modal"), "true");
    await page.keyboard.press("Escape");
    assert.equal(await maximized.count(), 0, "Escape debe cerrar el modo maximizado en movil.");
  } finally {
    await context.close();
  }
}

const checks = [
  ["plantillas, copiar y cURL", checkTemplateCopyCurl],
  ["Blockly drag and drop y maximización", checkBlocklyDragAndMaximize],
  ["Mermaid, tema, SVG y PNG", checkMermaidAndDownloads],
  ["responsive y accesibilidad", checkResponsiveAccessibility]
];

const browser = await chromium.launch({ executablePath: chromePath, headless: true });
let failures = 0;
for (const [label, check] of checks) {
  try {
    await check(browser);
    console.log(`PASS ${label}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
await browser.close();
if (failures) process.exitCode = 1;
