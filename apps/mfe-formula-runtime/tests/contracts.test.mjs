import assert from "node:assert/strict";
import test from "node:test";
import {
  inferSchema,
  inputExample,
  readPath,
  validateInput,
  writePath
} from "../lib/contracts.ts";

test("usa parametros como entrada cuando el ejemplo conserva metadatos de solicitud", () => {
  const formula = { ejemplo: { idSolicitud: "REQ-1", parametros: { importe: 10 } } };
  assert.deepEqual(inputExample(formula), { importe: 10 });
});

test("actualiza rutas anidadas dentro de listas sin perder el resto del contexto", () => {
  const initial = { pasajeros: [{ nombre: "Ana", edad: 30 }, { nombre: "Luis", edad: 8 }] };
  const updated = writePath(initial, "pasajeros.1.edad", 9);
  assert.equal(readPath(updated, "pasajeros.1.edad"), 9);
  assert.equal(readPath(updated, "pasajeros.0.edad"), 30);
});

test("infiere tipos de listas y valida campos requeridos y limites", () => {
  const schema = inferSchema({ pasajeros: [{ edad: 30 }] });
  assert.equal(schema.properties?.pasajeros?.type, "array");
  const constrained = { type: "object", properties: { edad: { type: "integer", minimum: 18 } }, required: ["edad"] };
  assert.deepEqual(validateInput(constrained, { edad: 12 }), ["Parámetros.Edad debe ser mayor o igual a 18."]);
  assert.deepEqual(validateInput(constrained, {}), ["Parámetros.Edad es obligatorio."]);
});
