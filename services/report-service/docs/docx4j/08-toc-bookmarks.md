# Tabla de contenido, bookmarks e hipervinculos

## Alcance

El detector identifica tablas de contenido, bookmarks e hipervinculos. Luego del binding el motor intenta actualizar la TOC mediante `TocGenerator` y activa la remediacion de integridad de bookmarks. Si la actualizacion no es posible, conserva la plantilla y registra una advertencia tecnica.

## Fixture

Usa `toc.docx`, que contiene una tabla de contenido y bookmarks para comprobar la conservacion del paquete.

## Prueba desde el MFE

1. Carga `toc.docx` con codigo `TOC_EXAMPLE` y version `1`.
2. En el detalle confirma `TOC_BOOKMARKS`.
3. Genera DOCX con un JSON vacio o con los parametros que reporte el contrato.
4. Abre el archivo en Word y actualiza la tabla si Word muestra el aviso de campos pendientes.
5. Revisa que los bookmarks existentes sigan presentes y que los hipervinculos internos no se hayan eliminado.
6. Genera PDF y verifica el texto resultante; la paginacion final de la TOC debe considerarse orientativa cuando FOP no pueda recalcularla.

## Verificacion automatizada

```powershell
mvn -f .\services\report-service\pom.xml '-Dtest=DocxTemplateEngineTest#preservesBookmarksAndRendersTocFixtureAsPdf,TemplateParameterExtractorTest#detectsTocAndBookmarksAndReportsDuplicateNames' test
```

La prueba no sustituye una inspeccion visual en Word y PDF. Una plantilla con bookmarks duplicados aparece con una advertencia de inspeccion.
