# MFE de aplicaciones de calculo

`@venta-pasajes/mfe-formula-runtime` es el microfrontend orientado al usuario final. El constructor `@venta-pasajes/mfe-aviatorscript` conserva exclusivamente la autoria de formulas; este modulo consume las versiones activas y presenta una interfaz dinamica para ejecutarlas.

## Flujo

1. Consulta `GET /api/v1/calculos/formulas` a traves del proxy Next `/api/formulas`.
2. Selecciona solo versiones `activa=true`, sin permitir editar la plantilla publicada.
3. Construye los campos desde `contratoEntrada`; si una formula antigua no tiene contrato, infiere el esquema desde `ejemplo.parametros`.
4. Valida tipos, requeridos, listas y limites en el navegador para dar feedback inmediato.
5. Ejecuta la version activa contra `POST /api/v1/calculos/ejecutar` a traves de `/api/execute`.
6. Presenta escalares, objetos, listas tabulares y valores nulos sin asumir que el resultado es numerico.

El motor Java es la autoridad. La validacion de interfaz no reemplaza sus reglas de negocio, sus permisos ni sus errores controlados.

## Contrato persistido

Las versiones nuevas pueden guardar junto con `expresion` y `ejemplo`:

- `contratoEntrada`: JSON Schema acotado para generar controles.
- `contratoSalida`: JSON Schema opcional para describir la salida.
- `configuracionInterfaz`: titulo, descripcion, secciones y textos de la pantalla.

La migracion `V9__agregar_contratos_y_configuracion_de_formulas.sql` agrega las columnas JSONB sin modificar datos anteriores. El constructor genera automaticamente `contratoEntrada` y una configuracion inicial a partir de su ejemplo al guardar una nueva version.

## Operacion local

```powershell
npm run dev:mfe-formula-runtime
```

Abre `http://localhost:3007/formula-runtime/embedded`. Para levantar todos los MFEs, `scripts/start-frontend-dev.ps1` incluye este modulo y publica su manifest en `http://localhost:3007/mfe/manifest`.

Al registrar el modulo en el Shell, usa las dos URLs: `URL de pantalla` debe apuntar a `/formula-runtime/embedded` y `URL del manifest MFE` debe apuntar a `/mfe/manifest`. El Shell tambien corrige automaticamente una configuracion antigua que haya puesto `/embedded` en el campo del manifest.

Variables server-side:

- `AVIATORSCRIPT_SERVICE_URL`: URL del servicio Quarkus; por defecto `http://localhost:8087`.
- `NEXT_PUBLIC_MFE_PUBLIC_URL`: URL que se anuncia en el manifest.

El proxy reenvia el `Authorization` de la sesion, usa `no-store`, limites de tamaño y timeouts. Si el motor no responde, se muestra un estado desconectado y se usa el ultimo catalogo cacheado en el navegador; un catalogo vacio se informa como un estado diferente.

## Rutas

- `/formula-runtime/embedded`: entrada para el shell.
- `/mfe/manifest`: contrato de descubrimiento.
- `/api/formulas`: proxy de catalogo.
- `/api/execute`: proxy de ejecucion.
- `/api/health`: health check.

## Verificacion

```powershell
npm run typecheck -w @venta-pasajes/mfe-formula-runtime
npm test -w @venta-pasajes/mfe-formula-runtime
npm run build -w @venta-pasajes/mfe-formula-runtime
```
