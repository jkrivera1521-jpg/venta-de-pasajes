# MFE de pruebas de report-service

`@venta-pasajes/mfe-report-runtime` es una consola embebible para probar los endpoints de `services/report-service` desde el navegador. No reemplaza el MFE operativo de reportes: esta aplicacion esta orientada a integracion, diagnostico y validacion manual del contrato.

## Funcionalidades

- Consulta el health y el catalogo de plantillas.
- Carga plantillas XLSX/DOCX con `multipart/form-data`.
- Consulta versiones, parametros y contratos detectados.
- Muestra el motor, capacidades, raiz XML y advertencias detectadas en plantillas DOCX.
- Activa versiones y ejecuta eliminacion logica.
- Genera documentos XLSX, DOCX o PDF y descarga la respuesta binaria.
- Crea lotes asincronos, consulta su estado, cancela y descarga el ZIP.
- Reenvia el token del Shell mediante un proxy server-side; la URL del backend no se expone al navegador.

## Operacion local

Levanta primero `report-service` en `http://localhost:8088` y luego:

```powershell
npm run dev:mfe-report-runtime
```

Abre `http://localhost:3008/report-runtime/embedded`. El manifest queda disponible en `http://localhost:3008/mfe/manifest`.

Variables principales:

- `REPORT_SERVICE_URL`: URL server-side de `report-service`; por defecto `http://localhost:8088`.
- `NEXT_PUBLIC_MFE_PUBLIC_URL`: URL publicada por el manifest; por defecto `http://localhost:3008`.

La guia paso a paso para probar OpenDoPE, repeticiones, condicionales, headers, footers, imagenes, rich text, graficos, TOC, bookmarks y MERGEFIELD esta en `services/report-service/docs/docx4j/README.md`.

Al registrar el MFE en el Shell, usa `/report-runtime/embedded` como URL de pantalla y `/mfe/manifest` como URL del manifest.

## Rutas

- `/report-runtime/embedded`: entrada embebible para el Shell.
- `/mfe/manifest`: contrato de descubrimiento del MFE.
- `/api/health`: health del frontend.
- `/api/report/*`: proxy autenticado hacia `/api/v1/*` de `report-service`.

## Verificacion

```powershell
npm run typecheck -w @venta-pasajes/mfe-report-runtime
npm run build -w @venta-pasajes/mfe-report-runtime
```
