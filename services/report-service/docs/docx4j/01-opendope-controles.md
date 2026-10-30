# OpenDoPE y controles de contenido

## Que esta implementado

El servicio detecta partes Custom XML, `w:sdt`, `od:xpath`, `od:repeat`, `od:condition` y bindings `w:dataBinding`. Al generar, convierte `data` a XML, inserta el datastore y ejecuta `Docx4J.bind` con insercion y binding de XML.

## Fixture

Usa `services/report-service/src/test/resources/docx4j/invoice-opendope.docx`. El XML original asociado esta en `invoice-original-data.xml` y muestra la raiz `invoice`:

```json
{
  "date": "2026-10-01",
  "customer": { "name": "Ana Perez" },
  "items": [
    { "name": "Boleto norte", "price": "$20" },
    { "name": "Boleto sur", "price": "$30" }
  ],
  "misc": { "includeBankDetails": true, "wantspam": false }
}
```

## Prueba desde el MFE

1. Carga `invoice-opendope.docx` con codigo `OPENDOPE_INVOICE` y version `1`.
2. Abre el codigo de la plantilla y confirma `OPENDOPE`, `CONTENT_CONTROLS`, `REPEATS` y `CONDITIONALS` en la inspeccion.
3. Abre `Generar documento` y conserva `templateCode` `OPENDOPE_INVOICE` y `templateVersion` `1`.
4. Reemplaza `data` por el JSON del ejemplo.
5. Genera `DOCX` con nombre `invoice-opendope.docx`.
6. Repite con `includeBankDetails: false` para comprobar que el bloque condicional se excluye.
7. Cambia la cantidad de elementos de `items` y confirma que la fila se repite sin modificar la plantilla original.

## Resultado esperado

El documento conserva los estilos de la plantilla, muestra el cliente y la fecha, repite la tabla de items y muestra u oculta el bloque condicional segun `includeBankDetails`.

## Pruebas automatizadas

```powershell
mvn -f .\services\report-service\pom.xml '-Dtest=DocxTemplateEngineTest#rendersRealOpenDopeTemplateWithNestedDataAndConditionalInputs' test
mvn -f .\services\report-service\pom.xml '-Dtest=TemplateParameterExtractorTest#inspectsRealOpenDopeTemplateAndMapsXpathToJsonPaths' test
```

## Errores esperados

- Si falta la raiz Custom XML, el servicio devuelve `OPENDOPE_XML_ROOT_MISSING`.
- Si el JSON no cumple un parametro declarado y el modo estricto esta activo, devuelve `UNKNOWN_PARAMETER` o el error de contrato correspondiente.
- No se ejecutan expresiones del usuario ni XPath recibido como codigo.
