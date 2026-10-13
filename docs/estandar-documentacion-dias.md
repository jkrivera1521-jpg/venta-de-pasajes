# Estandar de documentacion por dia

Fecha de adopcion: 2026-09-04

## Objetivo

Desde el Dia 21 en adelante, cada documento de avance diario debe servir como una guia operativa completa para repetir el trabajo desde cero y llegar al mismo objetivo probado durante la practica.

El documento debe mostrar primero la reversa, limpieza o desinstalacion de lo construido, y despues la guia manual de construccion paso a paso.

## Orden obligatorio del documento

Cada documento `dia-XX-*.md` debe seguir este orden general:

```text
1. Objetivo del dia.
2. Resultado alcanzado durante la practica.
3. Archivos creados o modificados.
4. Reversa primero: como detener, eliminar, despublicar o limpiar lo construido.
5. Guia manual desde cero: como repetir el proceso hasta llegar al objetivo.
6. Pruebas y validaciones.
7. Peticiones HTTP/HTTPS listas para copiar con curl.exe.
8. Publicacion o despliegue, si aplica.
9. Verificacion en consola web o por comandos, si aplica.
10. Problemas encontrados y soluciones.
11. Estado final y siguiente paso natural.
```

## Reversa primero

La seccion de reversa debe aparecer antes de la guia manual de construccion.

Debe incluir, segun aplique:

```text
- Como detener servicios locales.
- Como eliminar contenedores Docker.
- Como eliminar redes Docker temporales.
- Como eliminar imagenes locales.
- Como borrar tags o imagenes remotas.
- Como eliminar recursos creados en GCP.
- Como revertir bases de datos temporales o esquemas de prueba.
- Como confirmar que la limpieza quedo correcta.
```

La reversa no debe ejecutarse automaticamente si puede borrar recursos utiles. Debe quedar documentada con advertencias claras.

## Guia manual desde cero

La guia manual debe permitir que una persona repita el trabajo sin depender de Codex.

Debe incluir:

```text
- Prerequisitos.
- Variables de entorno o variables PowerShell.
- Comandos exactos en orden.
- Resultado esperado despues de cada bloque importante.
- Que revisar si un comando falla.
- Como validar en local.
- Como validar en GCP o consola web, si aplica.
- Como publicar o desplegar, si aplica.
```

Los comandos deben estar orientados a PowerShell en Windows, porque el proyecto se trabaja desde `C:\VENTA-DE-PASAJES`.

## Peticiones HTTP/HTTPS

Toda peticion HTTP o HTTPS documentada debe tener una version lista para copiar y ejecutar con `curl.exe`.

Ejemplo:

```powershell
curl.exe -s -X GET "http://localhost:8081/api/v1/identity/health"
```

Si requiere token:

```powershell
curl.exe -s -X GET "http://localhost:8081/api/v1/identity/me" `
  -H "Authorization: Bearer $accessToken"
```

## Bitacora

Toda actividad debe registrarse en:

```text
C:\VENTA-DE-PASAJES\vitacora.md
```

La bitacora debe incluir:

```text
- Comandos ejecutados por Codex.
- Comandos importantes agregados a la documentacion.
- Resultado de pruebas.
- Resultado de builds.
- Resultado de despliegues o publicaciones.
- Problemas encontrados y solucionados.
- Recursos creados o eliminados.
```

No se deben registrar secretos reales.

Usar placeholders:

```text
<redacted>
<redacted-token>
<temporary-local-password>
<temporary-local-secret>
```

## Practica primero, documentacion despues

El flujo de trabajo de cada dia debe ser:

```text
1. Codex realiza la practica tecnica.
2. Codex valida el resultado.
3. Codex registra comandos y resultados en vitacora.md.
4. Codex documenta la reversa.
5. Codex documenta la guia manual desde cero.
6. Codex confirma el estado final.
```

## Criterio de calidad

Un documento diario esta completo cuando una persona puede:

```text
1. Entender que se logro.
2. Deshacer o limpiar lo creado.
3. Reconstruirlo desde cero.
4. Probarlo localmente.
5. Publicarlo o desplegarlo.
6. Verificarlo por consola o comandos.
```
