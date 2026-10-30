# Imagenes dinamicas

## Contrato

Una imagen puede enviarse como base64 puro o como data URI. Tambien puede enviarse como objeto para conservar metadatos del contrato:

```json
{
  "logo": {
    "contentType": "image/png",
    "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB...",
    "altText": "Logo institucional"
  }
}
```

El backend valida el base64, los bytes reales, el MIME, el formato de imagen, el tamano de 10 MB y las dimensiones maximas. No descarga URLs remotas.

## Fixture y prueba automatizada

`picture.docx` se usa para comprobar que el binding conserva o reemplaza la imagen. `DynamicImageValidatorTest` cubre data URI, objeto, MIME incorrecto, bytes falsos y parametros opcionales dentro de colecciones.

## Prueba desde el MFE

1. Carga una plantilla DOCX con un control de imagen enlazado a `logo` o `element1`.
2. En el detalle verifica que `IMAGES` aparezca en las capacidades y que el parametro tenga tipo `IMAGE`.
3. Abre `Generar documento` y reemplaza el valor por una data URI PNG valida o por el objeto del ejemplo.
4. Genera DOCX y revisa la imagen en Word.
5. Genera PDF y comprueba que la imagen no desaparezca.
6. Prueba con una cadena base64 alterada: el MFE debe mostrar el error de validacion y no descargar un archivo.

## Reglas de seguridad

- No uses `http://` o `https://` como origen de imagen.
- No confies solo en `contentType`; se valida el contenido real.
- Para una imagen opcional, declara `required=false` en `parameterSchema`.
- Para una imagen dentro de un array, usa una ruta como `items.logo`; el validador recorre cada elemento.

## Verificacion

```powershell
mvn -f .\services\report-service\pom.xml '-Dtest=DynamicImageValidatorTest,DocxTemplateEngineTest#bindsDynamicImageFromBase64AndExportsPdf' test
```
