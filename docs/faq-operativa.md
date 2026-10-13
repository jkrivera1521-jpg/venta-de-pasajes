# FAQ operativa

Fecha base: 2026-09-25

## Objetivo

Registrar preguntas frecuentes para capacitacion de boleteria, administracion y soporte.

### P01 - Que hago si no aparece ninguna salida?

Revisar el rango de fechas, presionar `Actualizar` y confirmar que el modulo `Despachos` tenga salidas programadas para esa fecha.

### P02 - Que hago si el asiento aparece como reservado?

No se debe vender ese asiento. Actualizar la salida y seleccionar un asiento libre. Si la reserva no expira, escalar a soporte.

### P03 - Que significa error 409 al emitir?

Significa conflicto: normalmente el asiento ya no esta disponible. Actualizar el mapa y escoger otro asiento.

### P04 - Que significa la bandera D?

Indica asiento vendido a pasajero con discapacidad. Debe conservarse para control operativo y reportes.

### P05 - Que significa la bandera N?

Indica asiento vendido a nino. Debe validarse con la politica comercial vigente.

### P06 - Que significa la bandera AM?

Indica asiento vendido a adulto mayor. Debe validarse con la politica comercial vigente.

### P07 - Puedo modificar una salida mientras ya se esta vendiendo?

No es recomendable. Las modificaciones deben hacerse antes de iniciar la venta o bajo autorizacion operativa.

### P08 - Que hago si un usuario no puede entrar?

Revisar si el usuario esta activo, si tiene rol asignado y si la sesion esta vigente. Si es usuario migrado, puede requerir activacion o recuperacion de clave.

### P09 - Donde reviso si un servicio esta caido?

En `Admin > Health`. Si se necesita detalle, abrir `Admin > Diagnostico` y guardar snapshot.

### P10 - Donde encuentro comandos de arranque o diagnostico?

En `Admin > Runbook` y `Admin > Arranque`.

### P11 - Como exporto reportes?

Entrar a `Reportes`, seleccionar rango y tipo de reporte, validar totales y usar `Exportar CSV`.

### P12 - Que hago si el reporte no coincide con boleteria?

No cerrar caja con datos dudosos. Guardar evidencia, comparar fecha/hora/filtros y escalar a soporte para revisar sincronizacion de datos.

### P13 - Que hago si Cloud Run o el frontend productivo no responde?

Registrar hora, modulo afectado y mensaje. Revisar `Admin > Health` si esta disponible. Si el incidente bloquea ventas, clasificar como P1.

### P14 - Puedo usar una cuenta compartida para boleteria?

No. Cada operador debe usar su cuenta para mantener trazabilidad y auditoria.

### P15 - Que informacion no debo enviar por chat?

No enviar claves, tokens, documentos completos de pasajeros, enlaces con sesion, secretos o archivos con informacion sensible.

