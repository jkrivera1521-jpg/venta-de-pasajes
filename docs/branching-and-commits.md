# Convenciones de ramas y commits

Fecha: 2026-09-01

## Estado

El workspace actual no tiene Git inicializado. Estas convenciones aplican cuando se inicialice el repositorio o se conecte a un remoto.

## Ramas

Rama principal:

- `main`: codigo estable y desplegable.

Ramas de trabajo:

- `feature/<alcance>` para funcionalidad nueva.
- `fix/<alcance>` para correcciones.
- `docs/<alcance>` para documentacion.
- `chore/<alcance>` para tareas operativas.
- `infra/<alcance>` para infraestructura.
- `migration/<alcance>` para migracion de datos.

Ejemplos:

- `feature/identity-local-login`
- `feature/ticket-seat-map`
- `docs/domain-boundaries`
- `infra/cloudrun-dispatch-service`
- `migration/access-export`

## Commits

Usar estilo Conventional Commits:

- `feat: add ticket sale endpoint`
- `fix: prevent duplicate active seat allocation`
- `docs: document dispatch domain boundaries`
- `chore: add monorepo folders`
- `infra: add cloud run service template`
- `test: add concurrent ticket sale test`
- `migration: map access clientes to tickets`

Reglas:

- Commits pequenos y coherentes.
- Mensaje en ingles para consistencia tecnica, o espanol si el equipo lo decide formalmente.
- No mezclar refactors grandes con cambios funcionales.
- No commitear secretos, dumps productivos ni credenciales.
- Referenciar ticket o tarea cuando exista.

## Pull requests

Cada PR debe incluir:

- Resumen del cambio.
- Riesgo principal.
- Evidencia de pruebas o validacion.
- Migraciones afectadas, si aplica.
- Variables de ambiente nuevas, si aplica.

## Versionado

- APIs: version por contrato OpenAPI.
- Servicios: version por imagen/commit.
- Frontend: version por build.
- Base de datos: version por migracion Flyway o Liquibase.
