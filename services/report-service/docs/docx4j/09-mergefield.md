# Compatibilidad con MERGEFIELD

## Alcance

Las plantillas que contienen campos Word `MERGEFIELD` siguen un camino compatible con `MailMerger`. El extractor los registra y el motor asigna los nombres planos del JSON al campo correspondiente.

Las plantillas nuevas deben preferir OpenDoPE y controles de contenido porque permiten tipos, repeticiones y diagnosticos mas claros.

## Fixture y JSON

Usa `MERGEFIELD.docx` con un campo `Kundenname`:

```json
{
  "Kundenname": "Maria Perez"
}
```

## Prueba desde el MFE

1. Carga `MERGEFIELD.docx` con codigo `MERGEFIELD_EXAMPLE` y version `1`.
2. Confirma que el motor sea `MERGEFIELD` o `MIXED` y que el campo aparezca en parametros.
3. Abre la generacion, usa el JSON del ejemplo y genera DOCX.
4. Abre el archivo y verifica que no quede el marcador `Kundenname` ni el texto de campo sin reemplazar.
5. Prueba un nombre inexistente y revisa el comportamiento configurado por la plantilla y el contrato.

## Verificacion automatizada

```powershell
mvn -f .\services\report-service\pom.xml '-Dtest=DocxTemplateEngineTest#replacesMergeFieldsFromDocx4jFixture' test
```

El flujo conserva la compatibilidad sin forzar una plantilla MERGEFIELD a OpenDoPE.
