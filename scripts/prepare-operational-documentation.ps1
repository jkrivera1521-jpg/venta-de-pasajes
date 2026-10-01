param(
    [string]$OutputDirectory = ".\logs\operational-documentation"
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$OutputPath = Join-Path $Root $OutputDirectory
New-Item -ItemType Directory -Force -Path $OutputPath | Out-Null

$Sources = @(
    "docs\manual-usuario-operativo.md",
    "docs\faq-operativa.md",
    "docs\registro-capacitacion-operativa.md",
    "apps\mfe-identity\app\identity\embedded\page.tsx",
    "apps\mfe-ticketing\app\ticketing\embedded\page.tsx",
    "apps\mfe-reporting\app\reporting\embedded\page.tsx",
    "apps\mfe-dispatch\app\dispatch\embedded\page.tsx",
    "services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingTicketResource.java",
    "services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingSaleService.java"
)

$SourceInventory = foreach ($Source in $Sources) {
    $FullPath = Join-Path $Root $Source
    [pscustomobject]@{
        path = $Source
        exists = Test-Path -LiteralPath $FullPath
    }
}

$MissingSources = @($SourceInventory | Where-Object { -not $_.exists })
if ($MissingSources.Count -gt 0) {
    $MissingList = ($MissingSources | ForEach-Object { $_.path }) -join ", "
    throw "No se pueden generar los manuales operativos. Fuentes faltantes: $MissingList"
}

$ManualPath = Join-Path $Root "docs\manual-operativo-final.md"
$GuidePath = Join-Path $Root "docs\guia-rapida-boleteria.md"
$ReadinessPath = Join-Path $OutputPath "dia85-operational-documentation-readiness.json"
$InventoryPath = Join-Path $OutputPath "dia85-operational-documentation-inventory.json"

$Manual = @'
# Manual operativo final

## Objetivo

Este manual consolida el uso operativo del sistema de venta de pasajes para boleteria, despacho, reportes, identidad y soporte basico. Esta pensado para operadores, supervisores y personal de soporte que necesitan ejecutar el proceso diario sin tocar codigo ni secretos.

## Alcance operativo

- Ingreso con login hibrido: Google, usuario local o usuario HYBRID.
- Venta de boletos desde el MFE de boleteria.
- Anulaciones y reimpresiones controladas.
- Reportes de ventas, pasajeros, usuarios y bus/ruta.
- Administracion operativa de terminales, rutas, tipos de bus, buses, layouts y salidas.
- Soporte basico con evidencia verificable.

## Roles minimos

- Operador de boleteria: vende boletos, revisa salidas, consulta estado de asientos y reporta incidentes.
- Supervisor: autoriza anulaciones, valida cierres diarios y revisa reportes.
- Administrador operativo: mantiene usuarios, identidades autorizadas, buses, rutas, layouts y salidas.
- Soporte tecnico: revisa salud de servicios, logs, configuracion y eventos de integracion.

## Login hibrido

El modulo de identidad acepta tres modos de usuario: LOCAL, GOOGLE y HYBRID.

- LOCAL: el usuario ingresa con login y password en la pantalla Login local.
- GOOGLE: el usuario ingresa con Sign in with Google, usando un correo autorizado.
- HYBRID: el usuario puede operar con credenciales locales y tambien asociarse a Google cuando corresponde.

Flujo recomendado:

1. Abrir el modulo de identidad.
2. Si se usa usuario local, completar Usuario y password.
3. Si se usa Google, pulsar Sign in with Google.
4. Verificar que el correo este registrado en Autorizados si Google no permite ingresar.
5. Si el usuario olvido su clave local, usar Recuperacion para solicitar y aplicar el token de recuperacion.

Reglas operativas:

- No compartir cuentas entre operadores.
- No anotar passwords temporales en chats o tickets.
- Revocar o desactivar usuarios que ya no trabajen en la operacion.
- Para Google, autorizar solo EMAIL, DOMAIN o GOOGLE_SUBJECT segun la politica vigente.

## Venta de boletos

La venta se realiza desde el MFE de boleteria. El flujo depende de las salidas publicadas por despacho y del mapa de asientos sincronizado.

Pasos:

1. Abrir el modulo de boleteria.
2. Revisar que existan salidas disponibles.
3. Seleccionar la salida correcta por ruta, bus y fecha.
4. Revisar el mapa de asientos.
5. Seleccionar un asiento Libre.
6. Completar documento, nombre y apellido del pasajero.
7. Marcar banderas del pasajero cuando aplique: D para discapacidad, N para nino y AM para adulto mayor.
8. Emitir el boleto.
9. Confirmar el ultimo boleto generado y entregar el comprobante correspondiente.

Estados de asiento:

- Libre: disponible para vender.
- Reservado: tomado temporalmente por otro flujo.
- Vendido: boleto emitido.
- Bloqueado: no disponible para venta.
- Cancelado: asiento afectado por cancelacion.

Reglas de venta:

- No vender si la salida esta cerrada o cancelada.
- No vender asientos reservados, vendidos, bloqueados o cancelados.
- Si aparece conflicto 409, refrescar el mapa y escoger otro asiento libre.
- Verificar documento y nombre antes de emitir.

## Anulaciones

La anulacion existe en el servicio de ticketing mediante el endpoint de cancelacion de boletos. Debe ejecutarse solo por un usuario autorizado o por soporte bajo aprobacion del supervisor.

Datos minimos para anular:

- Identificador del boleto.
- Motivo claro de anulacion.
- Usuario que autoriza o ejecuta la anulacion.
- Evidencia del caso cuando aplique.

Reglas:

- No anular boletos sin motivo.
- Si el boleto ya no esta en un estado anulable, el servicio responde conflicto y se debe escalar a soporte.
- Despues de anular, validar que el asiento quede en el estado esperado y que el evento de anulacion quede trazado.
- Toda anulacion debe aparecer en reportes o auditoria operativa.

## Reimpresiones

La reimpresion documental esta expuesta por ticketing para regenerar o recuperar la referencia del documento del boleto.

Uso operativo:

1. Confirmar que el boleto exista.
2. Confirmar que el pasajero solicito la reimpresion o que hubo falla de impresion.
3. Solicitar reimpresion desde el flujo autorizado.
4. Registrar la razon si el caso viene de soporte.

## Reportes

El modulo de reportes consolida informacion operativa para revision diaria.

Vistas disponibles:

- Ventas: resumen de boletos y montos.
- Pasajeros: busqueda y consulta operativa de pasajeros.
- Usuarios: ventas agrupadas por usuario.
- Bus/ruta: ventas agrupadas por bus o ruta.

Acciones:

1. Abrir Reportes operativos.
2. Seleccionar la pestana requerida: Ventas, Pasajeros, Usuarios o Bus/ruta.
3. Aplicar filtros de fecha, pasajero o agrupacion.
4. Revisar totales en pantalla.
5. Usar Exportar CSV para guardar evidencia.

Buenas practicas:

- Usar el mismo rango de fechas al comparar ventas y reportes.
- Para cierre diario, conservar el CSV de ventas y el CSV por usuario.
- Si hay diferencias, comparar hora de corte, anulaciones y ventas recientes.

## Administracion de buses y salidas

El modulo de despacho administra la base operativa para que boleteria pueda vender.

Secciones:

- Terminales.
- Rutas.
- Tipos.
- Buses.
- Layouts.
- Salidas.

Alta o mantenimiento de bus:

1. Verificar que exista el tipo de bus.
2. Verificar que exista el layout de asientos.
3. Registrar codigo, placa, tipo, terminal, layout y destino base.
4. Marcar Activo si el bus puede operar.
5. Guardar y verificar que el bus aparezca en la lista.

Programacion de salida:

1. Confirmar terminal y ruta.
2. Confirmar bus activo y layout correcto.
3. Seleccionar fecha y hora.
4. Programar salida.
5. Validar que boleteria muestre la salida y el mapa de asientos.

Cancelacion de salida:

- Usar Cancelar salida solo con autorizacion operativa.
- No cancelar si ya hay pasajeros sin definir plan de atencion.
- Despues de cancelar, validar que boleteria ya no venda la salida.

## Soporte basico

Antes de escalar, el operador debe reunir evidencia clara.

Checklist inicial:

1. Identificar modulo afectado: identidad, boleteria, despacho, reportes o admin.
2. Anotar fecha, hora, usuario, salida, boleto o pasajero afectado.
3. Capturar mensaje visible.
4. Probar nuevamente una sola vez si el error parece temporal.
5. Revisar si otros usuarios tienen el mismo problema.

Clasificacion:

- P1: no se puede vender o el sistema esta caido.
- P2: ventas funcionan pero hay impacto relevante en anulaciones, salidas o reportes.
- P3: error parcial con alternativa operativa.
- P4: consulta, mejora o ajuste menor.

Buenas practicas:

- No compartir secretos, tokens o passwords en el ticket de soporte.
- No modificar datos en base directamente desde operacion.
- Para incidentes de venta, incluir salida, asiento y documento del pasajero.
- Para incidentes de reportes, incluir rango de fechas y CSV exportado.

## Cierre diario

1. Validar que no queden ventas pendientes de confirmar.
2. Exportar reporte de ventas.
3. Exportar ventas por usuario.
4. Revisar anulaciones del dia.
5. Confirmar incidencias abiertas.
6. Entregar resumen al supervisor.

## Material de apoyo

- Guia rapida de boleteria: docs/guia-rapida-boleteria.md.
- Manual operativo anterior: docs/manual-usuario-operativo.md.
- FAQ operativa: docs/faq-operativa.md.
- Registro de capacitacion: docs/registro-capacitacion-operativa.md.
'@

$Guide = @'
# Guia rapida de boleteria

## Antes de vender

1. Ingresar con usuario local o Google autorizado.
2. Abrir el modulo de boleteria.
3. Verificar que la salida exista y corresponda a ruta, bus y fecha.
4. Confirmar que el mapa de asientos cargue correctamente.

## Venta en 8 pasos

1. Seleccionar la salida.
2. Elegir un asiento Libre.
3. Ingresar documento del pasajero.
4. Ingresar nombre y apellido.
5. Marcar D, N o AM solo si aplica.
6. Revisar datos antes de emitir.
7. Pulsar Emitir boleto.
8. Confirmar el ultimo boleto y entregar comprobante.

## Como leer el mapa

- Libre: se puede vender.
- Reservado: no vender.
- Vendido: no vender.
- Bloqueado: no vender.
- Cancelado: no vender sin validacion de supervisor.

## Si aparece conflicto 409

1. No insistir sobre el mismo asiento.
2. Actualizar el mapa.
3. Elegir otro asiento Libre.
4. Si se repite, avisar a soporte con salida, asiento, hora y usuario.

## Anulacion o reimpresion

1. Confirmar el numero o identificador del boleto.
2. Pedir autorizacion del supervisor.
3. Registrar motivo.
4. Ejecutar el flujo autorizado o escalar a soporte si no esta disponible en pantalla.
5. Validar reportes y estado del asiento despues de la accion.

## Cierre de turno

1. Exportar ventas.
2. Exportar ventas por usuario.
3. Revisar anulaciones.
4. Reportar incidencias pendientes.
5. Entregar resumen al supervisor.
'@

Set-Content -LiteralPath $ManualPath -Value $Manual -Encoding utf8
Set-Content -LiteralPath $GuidePath -Value $Guide -Encoding utf8

$ManualContent = Get-Content -LiteralPath $ManualPath -Raw
$GuideContent = Get-Content -LiteralPath $GuidePath -Raw

$RequiredManualSections = @(
    "## Login hibrido",
    "## Venta de boletos",
    "## Anulaciones",
    "## Reportes",
    "## Administracion de buses y salidas",
    "## Soporte basico"
)

$RequiredGuideSections = @(
    "## Antes de vender",
    "## Venta en 8 pasos",
    "## Como leer el mapa",
    "## Si aparece conflicto 409",
    "## Anulacion o reimpresion",
    "## Cierre de turno"
)

$ManualChecks = foreach ($Section in $RequiredManualSections) {
    [pscustomobject]@{
        section = $Section
        present = $ManualContent.Contains($Section)
    }
}

$GuideChecks = foreach ($Section in $RequiredGuideSections) {
    [pscustomobject]@{
        section = $Section
        present = $GuideContent.Contains($Section)
    }
}

$MissingManualSections = @($ManualChecks | Where-Object { -not $_.present })
$MissingGuideSections = @($GuideChecks | Where-Object { -not $_.present })

$Readiness = [pscustomobject]@{
    generated_at = (Get-Date).ToString("o")
    ready_for_operational_documentation = (($MissingManualSections.Count -eq 0) -and ($MissingGuideSections.Count -eq 0))
    manual_generated = Test-Path -LiteralPath $ManualPath
    quick_guide_generated = Test-Path -LiteralPath $GuidePath
    manual_sections = $ManualChecks
    quick_guide_sections = $GuideChecks
    source_files = $SourceInventory
    blockers = @()
}

if (-not $Readiness.ready_for_operational_documentation) {
    $Readiness.blockers += "Faltan secciones requeridas en los entregables operativos."
}

$Inventory = [pscustomobject]@{
    generated_at = $Readiness.generated_at
    deliverables = @(
        "docs\manual-operativo-final.md",
        "docs\guia-rapida-boleteria.md"
    )
    covered_tasks = @(
        "Login hibrido Google y usuario local",
        "Ventas",
        "Anulaciones",
        "Reportes",
        "Administracion de buses y salidas",
        "Soporte basico"
    )
    evidence_sources = $SourceInventory
}

$Readiness | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ReadinessPath -Encoding utf8
$Inventory | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $InventoryPath -Encoding utf8

Write-Host "Documentacion operativa lista: $($Readiness.ready_for_operational_documentation)"
Write-Host "Manual operativo generado: $($Readiness.manual_generated)"
Write-Host "Guia rapida generada: $($Readiness.quick_guide_generated)"
Write-Host "Fuentes verificadas: $($SourceInventory.Count)"
Write-Host "Bloqueos: $($Readiness.blockers.Count)"
