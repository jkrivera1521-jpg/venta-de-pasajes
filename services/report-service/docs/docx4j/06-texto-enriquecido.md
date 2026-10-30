# Texto enriquecido seguro

## Contrato

El contenido enriquecido solo se procesa cuando el parametro fue detectado como `RICH_TEXT` por un control de contenido rich text. El valor puede ser XHTML reducido:

```json
{
  "descripcion": "<p><strong>Servicio especial</strong><br/><em>Salida confirmada</em></p>"
}
```

Se permiten `p`, `br`, `strong`, `em`, `u`, `ul`, `ol` y `li` segun el control. Se eliminan o rechazan scripts, iframes, objetos, formularios, estilos peligrosos y URLs con protocolos inseguros.

## Prueba desde el MFE

1. Carga una plantilla DOCX con un control de contenido marcado como rich text y enlazado a `descripcion`.
2. Confirma que el detalle muestre `RICH_TEXT` y el tipo `RICH_TEXT`.
3. Abre la generacion y pega el JSON del ejemplo.
4. Genera DOCX y revisa negrita, cursiva, subrayado y saltos de linea.
5. Agrega `<script>alert(1)</script>` y un enlace `javascript:`; la generacion debe rechazar o sanitizar esos fragmentos.
6. Genera PDF y verifica que el texto visible se conserve.

## Resultado esperado

El documento contiene ejecuciones Word `w:r` y `w:t`, no HTML sin procesar. El contenido no puede ejecutar JavaScript ni cambiar relaciones del paquete DOCX.

## Verificacion automatizada

```powershell
mvn -f .\services\report-service\pom.xml '-Dtest=RichTextSanitizerTest,DocxTemplateEngineTest#sanitizesAndRendersRichTextContentControl' test
```

El sanitizador debe probar tambien etiquetas desconocidas, atributos peligrosos, documentos demasiado grandes y texto Unicode.
