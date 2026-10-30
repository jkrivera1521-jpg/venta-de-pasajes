# Deteccion de parametros y conversion JSON/XML

## Deteccion

`TemplateParameterExtractor` inspecciona el paquete DOCX y sus historias. Combina variables legacy, JXLS, `w:dataBinding`, tags OpenDoPE, MERGEFIELD, imagenes, rich text, graficos, headers, footers, TOC y bookmarks. Cada parametro expone ruta, tipo, obligatoriedad, repeticion, coleccion y origen.

La respuesta de detalle del MFE incluye `inspection` con `engine`, `features`, `xmlRoot` y `warnings`.

## Ejemplo de contrato detectado

```json
{
  "name": "items",
  "path": "items",
  "dataType": "ARRAY",
  "required": true,
  "repeated": true,
  "collection": true,
  "source": "OPENDOPE"
}
```

## Conversion

El conversor usa la raiz detectada por la plantilla. Los objetos se convierten en elementos, los arrays en elementos repetidos bajo un contenedor y las claves se validan como nombres XML. Se rechazan profundidad, cantidad de nodos y tamano fuera de los limites.

## Prueba desde el MFE

1. Carga `invoice-opendope.docx`.
2. En el detalle revisa que aparezcan `date`, `customer.name`, `items.name`, `items.price` y los campos de `misc`.
3. Abre la generacion y observa que el JSON inicial tenga objeto `customer`, array `items` y objeto `misc`.
4. Introduce caracteres como `&`, `<`, `>`, acentos y saltos de linea dentro de un texto.
5. Guarda el JSON, cierra el popup, vuelve a abrirlo y usa `Reset`.
6. Genera el DOCX y comprueba que los caracteres se muestran como texto, no como markup XML.

## Pruebas automatizadas

```powershell
mvn -f .\services\report-service\pom.xml '-Dtest=JsonToXmlConverterTest,TemplateParameterExtractorTest' test
```

Las pruebas cubren caracteres especiales, tipos escalares, arrays, estructuras anidadas y deteccion de OpenDoPE. La conversion no concatena XML y desactiva DTD, entidades externas y XInclude.

## Recomendaciones de contrato

- Usa nombres JSON simples para los nodos enlazados por XPath.
- Mantiene arrays de objetos como arrays, por ejemplo `viajes[].pasajeros[]`.
- Declara parametros opcionales en `parameterSchema` si una imagen, grafico o bloque no siempre recibe datos.
- No incluyas claves de control de transporte dentro de `data`.
