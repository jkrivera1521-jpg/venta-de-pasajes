# Guia de crecimiento modular

## Objetivo

Esta guia explica como agregar modulos nuevos al sistema Venta de Pasajes sin romper las convenciones de microservicios, microfrontends, seguridad, despliegue y operacion.

## Cuando crear un modulo nuevo

Crear un modulo nuevo solo cuando exista una responsabilidad de negocio clara y separable, por ejemplo pagos, facturacion electronica, encomiendas o caja avanzada.

Antes de crear codigo, validar:

- El modulo tiene datos propios o reglas propias.
- No necesita escribir directamente en bases de otros servicios.
- Puede exponer una API propia.
- Puede integrarse al shell como MFE independiente.
- Tiene responsable funcional y criterio de prueba.

## Crear un microservicio Quarkus

Validar primero con modo seco:

~~~powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 `
  -ServiceName catalog-service `
  -PackageSegment catalog `
  -DatabaseName catalog_db `
  -HttpPort 8087 `
  -DryRun
~~~

Resultado observado:

~~~text
service_name: catalog-service
package: com.ventapasajes.catalog
database_name: catalog_db
api_base_path: /api/v1/catalog
target_exists: False
dry_run: True
~~~

Crear el servicio solo si el target no existe o esta vacio:

~~~powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 `
  -ServiceName catalog-service `
  -PackageSegment catalog `
  -DatabaseName catalog_db `
  -HttpPort 8087
~~~

Despues de crear:

- Agregar migracion Flyway real.
- Agregar endpoints de dominio.
- Agregar OpenAPI en docs/openapi.
- Agregar configuracion Cloud Run dev/prod.
- Agregar secretos necesarios sin valores reales.
- Ejecutar tests Maven del servicio.

## Crear un MFE Next.js

Validar primero con modo seco:

~~~powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-next-mfe.ps1 `
  -MfeName mfe-catalog `
  -PackageSegment catalog `
  -Title "Catalogos" `
  -LocalPort 3006 `
  -BackendPort 8087 `
  -DryRun
~~~

Resultado observado:

~~~text
mfe_name: mfe-catalog
workspace_name: @venta-pasajes/mfe-catalog
package_segment: catalog
backend_api_url: http://localhost:8087/api/v1/catalog
workspace_path: apps/mfe-catalog
dry_run: True
~~~

Crear el MFE solo si el target no existe o esta vacio:

~~~powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-next-mfe.ps1 `
  -MfeName mfe-catalog `
  -PackageSegment catalog `
  -Title "Catalogos" `
  -LocalPort 3006 `
  -BackendPort 8087
~~~

Despues de crear:

- Agregar apps/mfe-catalog al arreglo workspaces en package.json.
- Agregar script dev:mfe-catalog.
- Agregar el manifest al shell.
- Configurar NEXT_PUBLIC_MFE_PUBLIC_URL.
- Configurar CATALOG_API_URL y NEXT_PUBLIC_CATALOG_API_URL.
- Ejecutar typecheck del workspace.

## Integrar el modulo al monorepo

Backend:

- Registrar el servicio en services/README.md.
- Agregar docs/openapi/<service>.openapi.yaml.
- Agregar DDL o migracion conceptual en docs/database.
- Agregar config en infra/cloudrun/dev-services.json.
- Agregar config en infra/cloudrun/prod-backend-services.json.
- Agregar secretos en el inventario del ambiente correspondiente.

Frontend:

- Registrar app en package.json.
- Registrar manifest en frontend-shell.
- Agregar config en infra/cloudrun/dev-services.json.
- Agregar config en infra/cloudrun/prod-frontend-services.json.
- Agregar health y embedded al checklist de despliegue.

## Checklist para nuevos modulos

- Dominio y limite documentado.
- Base propia definida si el backend persiste datos.
- API propia documentada.
- No hay escritura directa sobre bases ajenas.
- Eventos definidos si hay integracion asincrona.
- Secretos declarados sin valores reales.
- Health y OpenAPI disponibles.
- MFE con manifest y ruta embedded.
- Shell actualizado.
- Cloud Run dev/prod actualizado.
- Tests minimos definidos.
- Reversa documentada antes de ejecutar cambios reales.

## Validaciones minimas

Backend:

~~~powershell
mvn -f .\services\catalog-service\pom.xml test
~~~

Frontend:

~~~powershell
npm install
npm run typecheck -w @venta-pasajes/mfe-catalog
~~~

Workspace:

~~~powershell
git diff --check
~~~

## Plantillas disponibles

~~~text
templates/quarkus-service
templates/next-mfe
services/quarkus-service-template
scripts/new-quarkus-service.ps1
scripts/new-next-mfe.ps1
~~~
