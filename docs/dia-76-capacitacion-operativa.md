# Dia 76 - Capacitacion operativa

Fecha: 2026-09-25

## Objetivo

Alinear el Dia 76 con `C:\VENTA-DE-PASAJES\tareas.md`: capacitar boleteria, administrador y soporte, entregar manual rapido y registrar preguntas frecuentes.

Este dia prepara y valida el paquete de capacitacion. La capacitacion real se cierra cuando existan asistentes y firmas reales.

## Resultado alcanzado

Se creo el paquete operativo de capacitacion:

```text
C:\VENTA-DE-PASAJES\docs\manual-usuario-operativo.md
C:\VENTA-DE-PASAJES\docs\faq-operativa.md
C:\VENTA-DE-PASAJES\docs\registro-capacitacion-operativa.md
C:\VENTA-DE-PASAJES\scripts\verify-operational-training.ps1
C:\VENTA-DE-PASAJES\logs\training\dia76-operational-training-readiness.json
```

Estado esperado despues de validar:

```text
Paquete de capacitacion listo: True
Capacitacion real firmada: False
```

La capacitacion real queda en `False` a proposito porque requiere nombres, asistencia y firma de usuarios reales.

## Reversa primero

Esta reversa elimina solo documentos y evidencia local del Dia 76. No modifica Cloud Run, Cloud SQL, buckets, secretos ni datos.

### Paso R1 - Ubicarse en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso R2 - Eliminar evidencia local

```powershell
Remove-Item -LiteralPath .\logs\training\dia76-operational-training-readiness.json -Force
```

### Paso R3 - Eliminar paquete de capacitacion

```powershell
Remove-Item -LiteralPath .\docs\manual-usuario-operativo.md -Force
Remove-Item -LiteralPath .\docs\faq-operativa.md -Force
Remove-Item -LiteralPath .\docs\registro-capacitacion-operativa.md -Force
Remove-Item -LiteralPath .\scripts\verify-operational-training.ps1 -Force
Remove-Item -LiteralPath .\docs\dia-76-capacitacion-operativa.md -Force
```

### Paso R4 - Eliminar carpeta training si queda vacia

```powershell
if (Test-Path -LiteralPath .\logs\training) {
  $Items = Get-ChildItem -LiteralPath .\logs\training -Force
  if (@($Items).Count -eq 0) {
    Remove-Item -LiteralPath .\logs\training -Force
  }
}
```

## Cambios realizados

```text
docs/manual-usuario-operativo.md
docs/faq-operativa.md
docs/registro-capacitacion-operativa.md
docs/dia-76-capacitacion-operativa.md
scripts/verify-operational-training.ps1
logs/training/dia76-operational-training-readiness.json
```

## Guia manual desde cero

### Paso 1 - Abrir PowerShell en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Confirmar que existen los modulos que se van a capacitar

```powershell
Test-Path -LiteralPath .\apps\frontend-shell\app\page.tsx
Test-Path -LiteralPath .\apps\mfe-ticketing\app\ticketing\embedded\page.tsx
Test-Path -LiteralPath .\apps\mfe-dispatch\app\dispatch\embedded\page.tsx
Test-Path -LiteralPath .\apps\mfe-identity\app\identity\embedded\page.tsx
Test-Path -LiteralPath .\apps\mfe-reporting\app\reporting\embedded\page.tsx
Test-Path -LiteralPath .\apps\mfe-admin\app\admin\embedded\page.tsx
```

Resultado esperado:

```text
True
True
True
True
True
True
```

### Paso 3 - Revisar el manual entregable

```powershell
Get-Content -LiteralPath .\docs\manual-usuario-operativo.md
```

El manual debe cubrir:

```text
Boleteria
Despachos
Identidad
Reportes
Admin
Soporte
```

### Paso 4 - Revisar preguntas frecuentes

```powershell
Select-String -Path .\docs\faq-operativa.md -Pattern "^### P\\d+"
```

Resultado esperado:

```text
15 preguntas frecuentes.
```

### Paso 5 - Revisar registro de capacitacion

```powershell
Get-Content -LiteralPath .\docs\registro-capacitacion-operativa.md
```

Debe incluir sesiones para:

```text
Boleteria operativa
Administrador
Soporte
```

El registro queda con `PENDIENTE_FIRMA_REAL` hasta que existan asistentes reales.

### Paso 6 - Validar paquete automaticamente

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-operational-training.ps1 `
  -FailOnBlocker
```

Resultado esperado:

```text
Paquete de capacitacion listo: True
Capacitacion real firmada: False
```

### Paso 7 - Ejecutar capacitacion real

Con personas reales, seguir este orden:

```text
1. Boleteria operativa: 45 minutos.
2. Administrador: 45 minutos.
3. Soporte: 30 minutos.
4. Preguntas frecuentes: 15 minutos.
5. Registro de asistencia y firmas.
```

Actualizar:

```text
C:\VENTA-DE-PASAJES\docs\registro-capacitacion-operativa.md
```

Reemplazar:

```text
<fecha>
<nombre>
<rol>
<firma>
<observacion>
PENDIENTE_FIRMA_REAL
```

### Paso 8 - Validar cierre con firmas reales

Solo despues de actualizar asistencia real:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-operational-training.ps1 `
  -RequireSignedAttendance `
  -FailOnBlocker
```

Resultado esperado para cierre real:

```text
Paquete de capacitacion listo: True
Capacitacion real firmada: True
```

Si el registro sigue con `PENDIENTE_FIRMA_REAL`, este paso debe fallar.

## Pruebas y validaciones

Validar sintaxis del script:

```powershell
$Errors = $null
[System.Management.Automation.PSParser]::Tokenize(
  (Get-Content -LiteralPath .\scripts\verify-operational-training.ps1 -Raw),
  [ref]$Errors
) | Out-Null
if ($Errors.Count -gt 0) { $Errors } else { "parse-ok" }
```

Validar estructura del documento:

```powershell
Select-String -Path .\docs\dia-76-capacitacion-operativa.md `
  -Pattern "Reversa primero|Guia manual desde cero"
```

Validar evidencia:

```powershell
$Training = Get-Content -LiteralPath .\logs\training\dia76-operational-training-readiness.json -Raw | ConvertFrom-Json
$Training.summary
$Training.ready_for_training_execution
$Training.real_training_completed
```

## Peticiones HTTP/HTTPS listas para copiar

No son requisito principal del Dia 76. Si los frontends locales estan levantados, estas peticiones ayudan a mostrar health durante la capacitacion:

```powershell
curl.exe -s "http://localhost:3000/api/health"
curl.exe -s "http://localhost:3003/api/health"
curl.exe -s "http://localhost:3004/api/health"
curl.exe -s "http://localhost:3005/api/health"
```

## Problemas encontrados y soluciones

### No hay firmas reales aun

Solucion: se separo `ready_for_training_execution` de `real_training_completed`.

El material puede validarse automaticamente, pero el cierre real exige reemplazar `PENDIENTE_FIRMA_REAL` por firmas/asistentes reales y ejecutar con `-RequireSignedAttendance`.

### La capacitacion depende de roles distintos

Solucion: el registro separa tres sesiones minimas:

```text
Boleteria operativa
Administrador
Soporte
```

## Estado final

Manual de usuario operativo creado.

FAQ operativa creada.

Registro de capacitacion preparado.

Validador automatico creado.

Evidencia local generada.

Capacitacion real pendiente de asistentes y firmas.

Siguiente paso natural: Dia 77 - Migracion final de datos.

