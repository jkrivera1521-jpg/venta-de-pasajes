# Acta de puesta en marcha

Fecha base: 2026-09-28

Estado: APERTURA_PRODUCTIVA_EJECUTADA_PENDIENTE_FIRMA

Run ID: 20260930-104617

## Objetivo

Formalizar el inicio de operacion real con monitoreo activo, roles operativos asignados y registro de incidencias.

## Accesos operativos

| Grupo | Correos | Estado |
| --- | --- | --- |
| Boleteria | goez2k12@gmail.com | Habilitado con rol TICKET_SELLER |
| Supervisores | diego.martinezc@iess.gob.ec | Habilitado con rol ADMIN |

## Comando de monitoreo preparado

```text
C:\VENTA-DE-PASAJES\logs\go-live\dia79-go-live-commands.ps1
```

## Checklist de apertura

| Paso | Resultado esperado | Estado | Evidencia |
| --- | --- | --- | --- |
| Migracion final aplicada | Datos productivos aprobados | OK | logs\migration\dia77-final-prod\final-data-migration-prod-readiness.json |
| Prueba controlada aprobada | Venta, PDF, anulacion, reportes y logs aprobados | OK | logs\prod-controlled-test\dia78-controlled-prod-test-readiness.json |
| Correos Google reales habilitados | Usuarios pueden ingresar | OK | logs\go-live\dia79-operational-identities-evidence.json |
| Roles operativos asignados | Boleteria y supervisores con permisos correctos | OK | logs\go-live\dia79-operational-identities-evidence.json |
| Operacion iniciada en boleteria | Primera venta real supervisada | OK | logs\go-live\dia79-go-live-readiness.json |
| Monitoreo activo | Logs y health checks revisados | OK | logs\go-live\dia79-go-live-monitoring-evidence.json |
| Incidencias registradas | Registro actualizado | OK | docs\registro-incidencias-iniciales.md |

## Decision

| Rol | Nombre | Decision | Firma | Fecha |
| --- | --- | --- | --- | --- |
| Responsable negocio | <nombre> | Pendiente | <firma> | <fecha> |
| Responsable boleteria | <nombre> | Pendiente | <firma> | <fecha> |
| Responsable tecnico | <nombre> | Pendiente | <firma> | <fecha> |
