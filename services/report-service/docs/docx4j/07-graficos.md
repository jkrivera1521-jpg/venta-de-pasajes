# Graficos existentes

## Alcance verificado

El servicio actualiza graficos existentes. Usa `charts.chart1`, `charts.chart2`, etc., donde el nombre corresponde al archivo `word/charts/chartN.xml`. Actualiza caches del chart y el unico workbook XLSX embebido permitido por el flujo actual.

El tipo y el numero de series y puntos deben coincidir con la plantilla. No se crean graficos nuevos. Una plantilla con varios workbooks embebidos se rechaza para evitar asociar datos al grafico equivocado.

## Fixture

Usa `clustered-column.docx`. Su contrato de ejemplo es:

```json
{
  "charts": {
    "chart1": {
      "categories": ["North", "South", "East", "West"],
      "series": [
        { "name": "2026", "values": [10, 20, 30, 40] },
        { "name": "2027", "values": [12, 22, 32, 42] },
        { "name": "2028", "values": [14, 24, 34, 44] }
      ]
    }
  }
}
```

## Prueba desde el MFE

1. Carga `clustered-column.docx` con codigo `CHARTS_EXAMPLE` y version `1`.
2. En la inspeccion confirma `CHARTS` y el parametro opcional `charts` de tipo `OBJECT`.
3. Abre la generacion y copia el JSON del ejemplo dentro de `data`.
4. Genera DOCX y abrelo en Word. Usa `Editar datos` del grafico para comprobar que el workbook embebido tambien fue actualizado.
5. Cambia una categoria y los valores, y vuelve a generar con otro nombre.
6. Prueba una cantidad diferente de series o puntos; debe aparecer `INVALID_CHART_DATA`.

## PDF

El exportador PDF de docx4j puede conservar el texto y parte del grafico, pero la fidelidad visual de charts depende de la version de `docx4j-export-fo`. La prueba actual verifica que el DOCX y sus caches queden consistentes. No se debe afirmar equivalencia pixel a pixel con Word sin una prueba visual del mismo fixture en ambos entornos.

## Verificacion automatizada

```powershell
mvn -f .\services\report-service\pom.xml '-Dtest=DocxTemplateEngineTest#updatesChartCachesAndEmbeddedWorkbook,TemplateParameterExtractorTest#exposesChartsAsOptionalStructuredParameter' test
```

## Limites intencionales

- No se aceptan formulas recibidas desde el JSON.
- No se descargan workbooks externos.
- Las series y categorias deben tener longitudes compatibles.
- Los tipos 3D, combinados y ejes secundarios requieren un fixture y prueba especificos antes de habilitarse.
