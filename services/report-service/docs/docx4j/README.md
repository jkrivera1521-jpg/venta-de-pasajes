# Guia de plantillas DOCX con docx4j

Esta carpeta documenta el uso y la prueba de las capacidades DOCX implementadas en `report-service`. Los ejemplos estan pensados para el MFE `apps/mfe-report-runtime` y para las pruebas automatizadas del backend.

## Flujo local completo

1. Inicia PostgreSQL para `report-service` desde la seccion `Desarrollo` del README del servicio.
2. Copia `services/report-service/.env.example` como `.env` local y revisa el puerto `55438`, la base `report_db` y `APP_REPORT_PDF_ENABLED=true`.
3. Levanta Quarkus:

   ```powershell
   mvn -f .\services\report-service\pom.xml quarkus:dev
   ```

4. En otra terminal inicia el MFE:

   ```powershell
   npm run dev:mfe-report-runtime
   ```

5. Abre `http://localhost:3008/report-runtime/embedded`.
6. Pulsa `Cargar plantilla`, selecciona un DOCX de ejemplo, completa codigo, nombre y version, y activa la version.
7. Pulsa el codigo de la plantilla. El detalle muestra el motor detectado, las capacidades, advertencias y parametros.
8. Abre `Generar documento`, edita el JSON en CodeMirror 6, selecciona `DOCX` o `PDF`, y genera el archivo.
9. Abre el archivo descargado con Word o un visor PDF y compara el resultado con la seccion `Resultado esperado` de cada guia.

## Contrato general de generacion

```json
{
  "data": {},
  "fileName": "reporte.docx",
  "outputFormat": "DOCX",
  "templateCode": "EJEMPLO_DOCX",
  "templateVersion": 1
}
```

`data` contiene los valores del documento. Las opciones de transporte (`fileName`, `outputFormat`, `templateCode` y `templateVersion`) permanecen fuera de `data`. El MFE guarda el JSON por plantilla y version en el almacenamiento local del navegador; `Guardar` valida y persiste el borrador y `Reset` recupera el ultimo borrador valido.

## Ejemplos disponibles

| Guia | Capacidad | Fixture o prueba principal |
| --- | --- | --- |
| [OpenDoPE y controles](01-opendope-controles.md) | Bindings, repeticiones y condicionales | `invoice-opendope.docx` |
| [Parametros y JSON/XML](02-parametros-json-xml.md) | Deteccion y conversion segura | `JsonToXmlConverterTest` |
| [Repeticiones y condicionales](03-repeticiones-condicionales.md) | Arrays anidados y condiciones | `DocxTemplateEngineTest` |
| [Headers y footers](04-headers-footers.md) | Historias de Word | `Headers.docx` |
| [Imagenes](05-imagenes.md) | Base64 y data URI validada | `picture.docx` |
| [Texto enriquecido](06-texto-enriquecido.md) | XHTML permitido en content controls | `RichTextSanitizerTest` |
| [Graficos](07-graficos.md) | Caches y workbook embebido | `clustered-column.docx` |
| [TOC y bookmarks](08-toc-bookmarks.md) | Tabla de contenido y marcadores | `toc.docx` |
| [MERGEFIELD](09-mergefield.md) | Compatibilidad MailMerger | `MERGEFIELD.docx` |
| [Fuentes para PDF](10-fuentes-pdf-docker.md) | Exportacion reproducible | `DocxTemplateEngineTest` |
| [Matriz de pruebas MFE](11-pruebas-mfe.md) | Prueba manual completa | Todos los ejemplos |

## Validacion automatizada

Desde la raiz del monorepo:

```powershell
mvn -f .\services\report-service\pom.xml test
npm run typecheck -w @venta-pasajes/mfe-report-runtime
npm run build -w @venta-pasajes/mfe-report-runtime
```

Las pruebas de generacion comparan la estructura del DOCX, el contenido relevante de sus historias, los caches de graficos y la firma de PDF. La comparacion visual final debe hacerse con Word y un visor PDF, porque el backend no depende de una instalacion de Microsoft Office.

## Seguridad y limites

- Las imagenes deben ser base64 o data URI; no se descargan URLs remotas.
- Se valida el tipo real de imagen, el tamano y las dimensiones.
- El XHTML permitido pasa por una lista blanca; scripts, iframes, objetos y protocolos inseguros se rechazan.
- El JSON se convierte a XML con StAX y limites de profundidad y cantidad de nodos.
- Los paquetes DOCX y los XML se leen sin DTD, entidades externas ni XInclude.
- Los graficos existentes se actualizan con `charts.chartN`; no se crean graficos nuevos.
- El resultado PDF usa `docx4j-export-fo`; su fidelidad depende de las capacidades del exportador, no de Word.
