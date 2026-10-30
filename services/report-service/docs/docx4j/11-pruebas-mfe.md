# Matriz de pruebas manuales en el MFE

## Preparacion unica

1. Levanta la base PostgreSQL de `report-service`.
2. Arranca Quarkus en `http://localhost:8088`.
3. Arranca `apps/mfe-report-runtime` en `http://localhost:3008`.
4. Inicia sesion en el Shell con un usuario que tenga `REPORT_TEMPLATE_READ`, `REPORT_TEMPLATE_CREATE` y `REPORT_GENERATE`.
5. Usa el mismo codigo y version en cada caso para que el contrato quede facil de localizar.

## Casos

| Caso | Plantilla | Accion MFE | Verificacion |
| --- | --- | --- | --- |
| OpenDoPE | `invoice-opendope.docx` | Cargar, abrir codigo, generar DOCX | Motor, raiz `invoice`, items y condicion |
| JSON/XML | `invoice-opendope.docx` | Editar caracteres especiales y usar Reset | JSON guardado, XML valido, texto intacto |
| Arrays | plantilla OpenDoPE anidada | Generar con `viajes[].pasajeros[]` | Filas/bloques repetidos |
| Header/footer | `Headers.docx` | Generar DOCX y PDF | Historias visibles en paginas |
| Imagen | `picture.docx` o control de imagen | Enviar data URI valida e invalida | Imagen visible, error seguro |
| Rich text | control rich text | Enviar `strong`, `em`, `br` y script | Formato permitido, script fuera |
| Graficos | `clustered-column.docx` | Enviar `charts.chart1` | Cache y workbook sincronizados |
| TOC/bookmarks | `toc.docx` | Generar y abrir en Word/PDF | Bookmarks conservados, advertencia si aplica |
| MERGEFIELD | `MERGEFIELD.docx` | Enviar el nombre del campo | Campo reemplazado |
| PDF Docker | cualquier DOCX compatible | Generar igual local y Docker | MIME, texto y fuentes consistentes |

## Secuencia de cada caso

1. Carga la plantilla desde `Cargar plantilla`.
2. Pulsa el codigo, revisa `Capacidades detectadas` y guarda una captura del contrato sin incluir tokens.
3. Abre `Generar documento`.
4. Confirma que el JSON inicial contiene la forma esperada: objetos como objetos y colecciones como arrays.
5. Edita un valor, pulsa `Guardar`, cierra el popup y vuelve a abrirlo.
6. Pulsa `Reset` y confirma que vuelve el JSON guardado.
7. Genera DOCX y luego PDF cuando el caso lo permita.
8. Descarga ambos archivos, revisa el resultado y registra cualquier diferencia visual.
9. Prueba al menos un error intencional por caso: campo faltante, tipo incorrecto, array incompatible, imagen invalida o grafico con longitud diferente.

## Comandos de validacion

```powershell
mvn -f .\services\report-service\pom.xml test
npm run typecheck -w @venta-pasajes/mfe-report-runtime
npm run build -w @venta-pasajes/mfe-report-runtime
git diff --check
```

## Criterio de aprobacion

Un caso se considera aprobado solo si el MFE muestra el diagnostico correcto, no descarga un archivo en errores, genera el formato solicitado, conserva la plantilla original y el resultado coincide con el contrato. Las diferencias de paginacion de TOC o de renderizado avanzado de graficos en FOP deben quedar registradas como limitacion, no ocultarse.
