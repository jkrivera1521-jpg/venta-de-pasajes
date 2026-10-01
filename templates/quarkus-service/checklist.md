# Checklist para nuevo microservicio Quarkus

- Nombre usa formato `<modulo>-service`.
- Paquete Java usa `com.ventapasajes.<modulo>`.
- Base dedicada usa formato `<modulo>_db`.
- Endpoint funcional vive bajo `/api/v1/<modulo>`.
- Health funcional vive bajo `/api/v1/<modulo>/health`.
- Migraciones Flyway estan en `src/main/resources/db/migration`.
- No hay llaves foraneas hacia bases de otros servicios.
- Secrets no quedan en archivos versionados.
- Perfil `gcp` usa Cloud SQL IAM y Secret Manager.
- Perfil `onprem` usa variables o secretos locales fuera del repo.
- OpenAPI existe en `/q/openapi`.
- Tests base pasan con Maven.
- Config dev/prod se agrega en `infra/cloudrun`.
- Pub/Sub, Storage o Cloud Tasks se agregan solo si el dominio lo necesita.
