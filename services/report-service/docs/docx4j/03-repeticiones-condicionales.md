# Repeticiones, condicionales y arrays anidados

## OpenDoPE

Las repeticiones se definen en la plantilla con `od:repeat` y un XPath que apunte a la coleccion. Las condiciones se definen con `od:condition` y un XPath booleano. El motor conserva el anidamiento de objetos y arrays al generar el XML.

## Ejemplo de datos

```json
{
  "viajes": [
    {
      "codigo": "NORTE",
      "pasajeros": [
        { "nombre": "Ana", "documento": "001" },
        { "nombre": "Luis", "documento": "002" }
      ]
    },
    {
      "codigo": "SUR",
      "pasajeros": [
        { "nombre": "Marta", "documento": "003" }
      ]
    }
  ],
  "mostrarResumen": true
}
```

## Prueba desde el MFE

1. Usa una plantilla OpenDoPE con una repeticion externa `viajes` y una repeticion interna `pasajeros`.
2. Carga la plantilla y revisa en la inspeccion que los parametros repetibles aparezcan como `ARRAY` o `collection`.
3. Abre la generacion y reemplaza el contenido de `data` con el ejemplo.
4. Genera DOCX.
5. Repite con `viajes: []` y valida el comportamiento vacio definido por la plantilla.
6. Repite con `mostrarResumen: false` y confirma que el bloque condicional no aparezca.
7. Usa `Guardar`, cierra el popup, vuelve a abrirlo y usa `Reset` para comprobar la persistencia del borrador.

## Legacy JXLS

Las plantillas existentes con `jt:forEach` y expresiones `${...}` mantienen su camino legacy. Ese flujo no debe mezclarse con OpenDoPE salvo que la inspeccion marque la plantilla como `MIXED` y el contrato lo justifique.

## Verificacion automatizada

```powershell
mvn -f .\services\report-service\pom.xml '-Dtest=DocxTemplateEngineTest,TemplateParameterExtractorTest' test
```

Valida la plantilla OpenDoPE real y la expansion legacy. El resultado debe ser un DOCX valido y la plantilla almacenada no debe modificarse.

## Errores esperados

- Un array con elementos de tipo incompatible se rechaza antes de crear el documento.
- Un campo no declarado se rechaza cuando `APP_REPORT_PARAMETERS_STRICT=true`.
- Un XPath OpenDoPE que no tenga raiz de datos produce un diagnostico de plantilla y no una sustitucion silenciosa.
