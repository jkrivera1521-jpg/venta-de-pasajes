# Variables en encabezados y pies de pagina

## Alcance

El flujo legacy recorre el documento principal y las partes `HeaderPart` y `FooterPart`. Conserva las relaciones, estilos y referencias de las secciones. Los encabezados y pies se inspeccionan como historias independientes.

## Fixture

`services/report-service/src/test/resources/docx4j/Headers.docx` contiene partes de encabezado y pie para verificar la lectura de historias. Para una variable sencilla usa una plantilla con `${empresa}` en el header y `${codigo}` en el footer.

## Prueba desde el MFE

1. Carga un DOCX que contenga `${empresa}`, `${codigo}` o controles OpenDoPE en header/footer.
2. Abre el codigo de la plantilla y confirma `HEADERS_FOOTERS` en las capacidades.
3. Abre `Generar documento` y usa:

   ```json
   {
     "empresa": "Venta de Pasajes",
     "codigo": "REPORTE-001",
     "fecha": "2026-10-29"
   }
   ```

4. Genera DOCX y revisa todas las paginas, no solo la primera.
5. Genera PDF y confirma que el contenido repetido del header/footer permanece visible.

## Resultado esperado

Las variables se reemplazan en las historias correspondientes y el cuerpo conserva su maquetacion. Un header o footer sin parametro no debe provocar que se procese como cuerpo principal.

## Pruebas automatizadas

```powershell
mvn -f .\services\report-service\pom.xml '-Dtest=DocxTemplateEngineTest#replacesVariablesInHeadersAndFooters' test
mvn -f .\services\report-service\pom.xml '-Dtest=TemplateParameterExtractorTest' test
```

La prueba genera un paquete con header/footer y verifica el XML resultante. Los casos con primera, par y ultima seccion deben agregarse usando una plantilla que declare esas referencias.
