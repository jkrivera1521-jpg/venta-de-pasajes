# Reporte de costo mensual estimado

Fecha base: 2026-09-28

Estado: PENDIENTE_OPERACION_REAL_ESTABLE

Run ID: 20260928-111615

## Resumen ejecutivo

La configuracion productiva actual esta orientada a controlar costos iniciales: todos los servicios Cloud Run tienen min_instances=0, max_instances=2, cpu=1 y memory=512Mi. Esto evita costo fijo por instancias minimas y limita el crecimiento automatico mientras se confirma demanda real.

El costo real mensual no queda validado todavia porque requiere operacion productiva estable, metricas de 30 dias y lectura de Billing. Por eso el estado permanece pendiente hasta cerrar el soporte intensivo y ejecutar la recoleccion real.

## Estimacion por configuracion

| Componente | Lectura de costo | Estado |
| --- | --- | --- |
| Cloud Run | Piso fijo bajo porque min_instances=0 en todos los servicios; costo variable depende de trafico real. | Controlado por configuracion |
| Cloud SQL | Instancia venta-pasajes-prod-sql en tier db-f1-micro, storage 10GB SSD, backups retenidos 14. | Bajo para arranque, validar con metricas |
| Logging | Volumen real pendiente de medir con dia83-cloudrun-log-sample.json, buckets y metricas. | Pendiente de evidencia |
| Presupuesto | Presupuesto mensual sugerido: 150 USD, con alertas 50%, 75% forecast, 90% y 100%. | Plantilla preparada |

## Cloud Run

| Servicio | Grupo | CPU | Memoria | Min | Max | Lectura |
| --- | --- | --- | --- | --- | --- | --- |
| audit-service-prod | backend | 1 | 512Mi | 0 | 2 | Sin costo fijo por instancias minimas |
| dispatch-service-prod | backend | 1 | 512Mi | 0 | 2 | Sin costo fijo por instancias minimas |
| document-service-prod | backend | 1 | 512Mi | 0 | 2 | Sin costo fijo por instancias minimas |
| identity-service-prod | backend | 1 | 512Mi | 0 | 2 | Sin costo fijo por instancias minimas |
| reporting-service-prod | backend | 1 | 512Mi | 0 | 2 | Sin costo fijo por instancias minimas |
| ticketing-service-prod | backend | 1 | 512Mi | 0 | 2 | Sin costo fijo por instancias minimas |
| frontend-shell-prod | frontend | 1 | 512Mi | 0 | 2 | Sin costo fijo por instancias minimas |
| mfe-admin-prod | frontend | 1 | 512Mi | 0 | 2 | Sin costo fijo por instancias minimas |
| mfe-dispatch-prod | frontend | 1 | 512Mi | 0 | 2 | Sin costo fijo por instancias minimas |
| mfe-identity-prod | frontend | 1 | 512Mi | 0 | 2 | Sin costo fijo por instancias minimas |
| mfe-reporting-prod | frontend | 1 | 512Mi | 0 | 2 | Sin costo fijo por instancias minimas |
| mfe-ticketing-prod | frontend | 1 | 512Mi | 0 | 2 | Sin costo fijo por instancias minimas |

## Cloud SQL

| Campo | Valor | Lectura |
| --- | --- | --- |
| Instancia | venta-pasajes-prod-sql | Base productiva compartida por bases separadas de microservicio |
| Tier | db-f1-micro | Costo bajo para arranque; revisar si CPU o conexiones se saturan |
| Storage | 10GB SSD | Mantener con auto incremento y alertas |
| Alta disponibilidad | ZONAL | Zonal controla costo; HA aumenta resiliencia y costo |
| Backups retenidos | 14 | Correcto para recuperacion inicial; vigilar crecimiento |

## Ajustes recomendados

| Area | Ajuste | Ejecutar ahora |
| --- | --- | --- |
| Cloud Run min instances | Mantener 0 en todos los servicios hasta tener demanda real sostenida. | No |
| Cloud Run CPU/RAM | Mantener 1 CPU / 512Mi y revisar con metricas antes de reducir o subir. | No |
| Cloud Run max instances | Mantener 2 para limitar costo de arranque. | No |
| Cloud SQL | Mantener db-f1-micro, 10GB SSD y auto incremento; revisar tras 30 dias. | No |
| Logging | Medir volumen real antes de excluir logs; no excluir auditoria, errores ni seguridad. | No |
| Budget | Crear presupuesto mensual con el ID real de billing. | Si, con aprobacion |

## Evidencia requerida para cerrar

- logs\cost-optimization\dia83-cost-evidence.json.
- logs\cost-optimization\dia83-cloudrun-services.json.
- logs\cost-optimization\dia83-cloudsql-instance.json.
- logs\cost-optimization\dia83-cloudrun-request-count.json.
- logs\cost-optimization\dia83-cloudrun-latency.json.
- logs\cost-optimization\dia83-cloudsql-cpu.json.
- logs\cost-optimization\dia83-cloudsql-disk-bytes-used.json.
- logs\cost-optimization\dia83-billing-project.txt.
- Confirmacion de presupuesto creado o decision documentada de no crearlo todavia.

## Decision

El costo queda controlado por configuracion, pero no queda certificado por gasto real hasta ejecutar la recoleccion con produccion estable y revisar Billing.
