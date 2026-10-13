# Registro de capacitacion operativa

Fecha base: 2026-09-25

Estado general: PENDIENTE_FIRMA_REAL

## Objetivo

Registrar la ejecucion de capacitacion para boleteria, administrador y soporte.

Este documento queda preparado para uso real. No contiene firmas reales todavia.

## Sesiones planificadas

| Sesion | Publico | Duracion | Material | Estado |
| --- | --- | ---: | --- | --- |
| Boleteria operativa | Operadores de boleteria | 45 min | `docs/manual-usuario-operativo.md` | PENDIENTE_FIRMA_REAL |
| Administrador | Administradores del sistema | 45 min | `docs/manual-usuario-operativo.md` | PENDIENTE_FIRMA_REAL |
| Soporte | Equipo de soporte | 30 min | `docs/manual-usuario-operativo.md` y `docs/faq-operativa.md` | PENDIENTE_FIRMA_REAL |

## Lista de asistencia

| Fecha | Sesion | Nombre | Rol | Firma | Observaciones |
| --- | --- | --- | --- | --- | --- |
| <fecha> | Boleteria operativa | <nombre> | <rol> | <firma> | <observacion> |
| <fecha> | Administrador | <nombre> | <rol> | <firma> | <observacion> |
| <fecha> | Soporte | <nombre> | <rol> | <firma> | <observacion> |

## Temario boleteria

- Acceso al shell.
- Seleccion de modulo `Boleteria`.
- Busqueda de salidas.
- Seleccion de salida.
- Lectura de mapa de asientos.
- Estados: libre, reservado, vendido, bloqueado y cancelado.
- Banderas: discapacidad, nino y adulto mayor.
- Emision de boleto.
- Manejo de conflicto 409.
- Cierre operativo diario.

## Temario administrador

- Usuarios, roles y permisos.
- Validacion de modulos activos.
- Admin Health.
- Admin Runbook.
- Admin Arranque.
- Admin Config.
- Admin Diagnostico.
- Snapshots administrativos.
- Readiness productivo.
- Auditoria.

## Temario soporte

- Clasificacion P1, P2, P3 y P4.
- Revision inicial por modulo.
- Revision de health.
- Captura de evidencia.
- Uso de snapshots.
- Consulta de runbooks.
- Escalamiento.
- Comunicacion a usuarios.

## Evaluacion practica

| Control | Boleteria | Administrador | Soporte |
| --- | --- | --- | --- |
| Ubica el modulo correcto | Pendiente | Pendiente | Pendiente |
| Ejecuta flujo principal | Pendiente | Pendiente | Pendiente |
| Interpreta errores comunes | Pendiente | Pendiente | Pendiente |
| Sabe cuando escalar | Pendiente | Pendiente | Pendiente |
| Firma registrada | Pendiente | Pendiente | Pendiente |

## Cierre real de capacitacion

Para cerrar este registro en produccion:

1. Reemplazar `<fecha>`, `<nombre>`, `<rol>`, `<firma>` y `<observacion>`.
2. Cambiar `PENDIENTE_FIRMA_REAL` por `FIRMADO`.
3. Ejecutar el verificador con `-RequireSignedAttendance`.
4. Registrar el resultado en `vitacora.md`.

