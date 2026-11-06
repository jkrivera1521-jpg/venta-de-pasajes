# Plantillas de mejoras

Estas plantillas sirven para comprobar la generacion DOCX del servicio de reportes desde el MFE.

## OpenDoPE con arrays anidados y condicionales

- `opendope-arrays-condicionales.docx`
- `opendope-arrays-condicionales-true.json`
- `opendope-arrays-condicionales-false.json`

El JSON verdadero activa `includeBankDetails` y muestra la rama verdadera. El JSON falso desactiva ese valor y muestra la rama alternativa. Ambos contienen dos viajes y pasajeros anidados para comprobar que no se repita el primer pasajero en todas las filas.

## Encabezados y pies por seccion

- `opendope-headers-footers-secciones.docx`
- `opendope-headers-footers-secciones.json`

La plantilla contiene tres secciones con encabezados predeterminados, primera pagina, pares e impares, y sus pies correspondientes.

## Filas legacy con formato

- `legacy-filas-formato.docx`
- `legacy-filas-formato.json`

La fila repetida contiene tokens divididos entre varios runs con negrita y cursiva. Sirve para comprobar que el reemplazo no aplana el formato de Word.

## Uso en el MFE

1. Carga el DOCX usando un codigo nuevo y activa la version.
2. Abre `Probar generacion` en la version cargada.
3. Copia el contenido del JSON correspondiente en el editor de solicitud.
4. Verifica el DOCX descargado y, en el caso de los condicionales, ejecuta ambos JSON para comparar las ramas.
