import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/mfe/manifest/route.ts";

test("publica la identidad y capacidades actuales del MFE", async () => {
  const response = GET();
  const manifest = await response.json();

  assert.equal(response.status, 200);
  assert.equal(manifest.name, "mfe-aviatorscript");
  assert.equal(manifest.title, "Constructor visual de fórmulas AviatorScript");
  assert.equal(manifest.mount_path, "/rules");
  assert.equal(manifest.entry_url.endsWith("/rules/embedded"), true);

  for (const capability of [
    "visual-rule-builder",
    "aviatorscript-code-editor",
    "real-engine-testing",
    "formula-catalog",
    "formula-versioning",
    "mermaid-visualization",
    "diagram-export",
    "curl-generation"
  ]) {
    assert.equal(manifest.capabilities.includes(capability), true, `Falta la capacidad ${capability}`);
  }
});
