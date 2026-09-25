# Manual de usuario operativo

Fecha base: 2026-09-25

## Objetivo

Guiar la operacion diaria del sistema Venta Pasajes para boleteria, administracion y soporte.

Este manual no reemplaza los permisos del sistema. Cada operador debe usar su propia cuenta y nunca compartir claves.

## Acceso general

1. Abrir el frontend principal.
2. Verificar que el reloj de la consola operativa muestre fecha y hora actual.
3. Confirmar que el modulo requerido este disponible en la barra izquierda.
4. Si se necesita mas espacio, ocultar la barra izquierda con el boton del encabezado.
5. Entrar al modulo de trabajo: `Identidad`, `Despachos`, `Boleteria`, `Reportes` o `Admin`.

## Boleteria

Objetivo: vender boletos usando salidas disponibles, mapa de asientos y datos del pasajero.

Flujo normal:

1. Abrir `Boleteria`.
2. Filtrar por fecha, ruta, bus o terminal.
3. Presionar `Actualizar`.
4. Seleccionar una salida disponible.
5. Revisar los contadores de asientos disponibles, vendidos, reservados, bloqueados y cancelados.
6. Seleccionar un asiento libre en el mapa.
7. Registrar documento, nombres, correo y telefono del pasajero.
8. Revisar tarifa y moneda.
9. Presionar `Emitir boleto`.
10. Confirmar que el ultimo boleto se actualice y que el asiento cambie a vendido.

Lectura del mapa de asientos:

```text
Libre      = asiento disponible para venta.
Reservado  = asiento retenido temporalmente.
Vendido    = asiento ya emitido.
Bloqueado  = asiento no vendible.
Cancelado  = asiento afectado por cancelacion.
D          = pasajero con discapacidad.
N          = nino.
AM         = adulto mayor.
```

Reglas operativas:

- No vender si la salida esta cerrada o cancelada.
- No vender si el asiento aparece reservado, vendido, bloqueado o cancelado.
- Si aparece conflicto 409, actualizar la salida y seleccionar otro asiento libre.
- Verificar documento y nombre antes de emitir.
- Si el pasajero pertenece a un grupo especial, validar que la bandera visual quede asociada al asiento vendido.

## Despachos

Objetivo: administrar datos operativos que alimentan boleteria.

Elementos principales:

- Terminales.
- Rutas.
- Tipos de bus.
- Buses.
- Layouts de asientos.
- Salidas programadas.

Reglas operativas:

- Crear o modificar salidas antes de iniciar la venta.
- Verificar que cada bus tenga layout de asientos correcto.
- No modificar rutas, buses, layouts ni salidas despues del congelamiento definido en el plan de corte.
- Si un bus tiene diferente capacidad, confirmar que el layout tenga el numero real de asientos.
- En buses de doble piso, usar layout por piso cuando el backend entregue coordenadas visuales por nivel.

## Identidad

Objetivo: administrar acceso, usuarios, roles y permisos.

Uso esperado:

1. Crear usuarios internos solo con datos verificados.
2. Asignar roles minimos necesarios.
3. Suspender usuarios que ya no deben operar.
4. Usar identidades autorizadas para acceso Google cuando aplique.
5. Revisar que el usuario tenga sesion valida antes de operar modulos protegidos.

Reglas operativas:

- No compartir cuentas.
- No reutilizar claves legacy como claves productivas.
- Si un usuario migrado no tiene clave activa, usar el flujo de recuperacion o activacion.
- Los permisos deben ser trazables por usuario.

## Reportes

Objetivo: consultar ventas, pasajeros, usuarios y agrupaciones operativas.

Reportes disponibles:

- Ventas por rango de fechas.
- Pasajeros por rango y busqueda.
- Ventas por usuario.
- Ventas agrupadas por bus, ruta o terminal.
- Exportacion CSV del reporte activo.

Flujo normal:

1. Abrir `Reportes`.
2. Seleccionar rango de fechas.
3. Seleccionar el tipo de reporte.
4. Actualizar la consulta.
5. Validar totales antes de usar el reporte.
6. Exportar CSV solo si el usuario tiene permiso para manejar la informacion.

## Admin

Objetivo: dar visibilidad operativa al estado de la plataforma.

Vistas principales:

- `Health`: estado de frontends y backends.
- `Arranque`: pasos de inicio y chequeos vinculados.
- `Runbook`: comandos operativos listos para copiar.
- `Config`: configuracion runtime visible.
- `Diagnostico`: snapshot administrativo y comparacion historica.
- `Produccion`: readiness productivo.
- `Auditoria`: eventos auditables.

Reglas operativas:

- Antes de una ventana critica, guardar snapshot de diagnostico.
- Si un servicio aparece caido, revisar primero `Health` y luego `Runbook`.
- No cambiar configuracion productiva sin registro en bitacora.
- Si hay degradacion, documentar hora, servicio, mensaje y accion tomada.

## Soporte

Objetivo: responder incidentes sin improvisar.

Primer diagnostico:

1. Confirmar si el problema afecta a un usuario, un modulo o todo el sistema.
2. Revisar `Admin > Health`.
3. Revisar `Admin > Diagnostico`.
4. Guardar snapshot si el problema sigue activo.
5. Revisar la bitacora operativa.
6. Escalar si hay venta detenida, datos inconsistentes, error de autenticacion general o indisponibilidad productiva.

Clasificacion rapida:

```text
P1 = venta detenida o produccion inaccesible.
P2 = modulo principal degradado con alternativa temporal.
P3 = error puntual con impacto bajo.
P4 = duda operativa o mejora.
```

## Cierre diario

Al finalizar la jornada:

1. Confirmar ventas emitidas.
2. Revisar reportes del dia.
3. Confirmar que no queden incidentes abiertos.
4. Registrar novedades de operacion.
5. Guardar snapshot administrativo si hubo eventos relevantes.

