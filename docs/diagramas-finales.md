# Diagramas finales

Fecha base: 2026-09-29

Los diagramas estan en Mermaid para poder versionarlos en Git y actualizarlos junto con el codigo.

## Vista general

```mermaid
flowchart LR
  Usuario[Usuario operativo] --> Shell[frontend-shell-prod]
  Shell --> MFEID[mfe-identity-prod]
  Shell --> MFEDIS[mfe-dispatch-prod]
  Shell --> MFETIC[mfe-ticketing-prod]
  Shell --> MFERPT[mfe-reporting-prod]
  Shell --> MFEADM[mfe-admin-prod]
  MFEID --> ID[identity-service-prod]
  MFEDIS --> DIS[dispatch-service-prod]
  MFETIC --> TIC[ticketing-service-prod]
  MFERPT --> RPT[reporting-service-prod]
  MFEADM --> AUD[audit-service-prod]
  MFETIC --> DOC[document-service-prod]
  ID --> SQL[(Cloud SQL prod)]
  DIS --> SQL
  TIC --> SQL
  DOC --> SQL
  RPT --> SQL
  AUD --> SQL
  DOC --> GCS[(Cloud Storage documentos)]
  ID --> PUB[(Pub/Sub)]
  DIS --> PUB
  TIC --> PUB
  DOC --> PUB
  AUD --> PUB
  PUB --> RPT
  PUB --> AUD
```

## Microservicios y bases

```mermaid
flowchart TB
  audit_service[audit-service] --> audit_db[(audit_db)]
  dispatch_service[dispatch-service] --> dispatch_db[(dispatch_db)]
  document_service[document-service] --> documents_db[(documents_db)]
  identity_service[identity-service] --> identity_db[(identity_db)]
  reporting_service[reporting-service] --> reporting_db[(reporting_db)]
  ticketing_service[ticketing-service] --> ticketing_db[(ticketing_db)]
```

## Eventos principales

```mermaid
flowchart LR
  identity[identity-service] --> identityTopic[identity-events]
  dispatch[dispatch-service] --> dispatchTopic[dispatch-events]
  ticketing[ticketing-service] --> ticketingTopic[ticketing-events]
  document[document-service] --> documentTopic[document-events]
  audit[audit-service] --> auditTopic[audit-events]
  identityTopic --> audit
  identityTopic --> reporting[reporting-service]
  dispatchTopic --> audit
  dispatchTopic --> reporting
  dispatchTopic --> ticketing
  ticketingTopic --> audit
  ticketingTopic --> reporting
  ticketingTopic --> document
  documentTopic --> audit
  documentTopic --> reporting
  auditTopic --> reporting
```

## Despliegue productivo

```mermaid
flowchart TB
  GitHub[GitHub main/develop] --> CI[GitHub Actions]
  CI --> Artifact[Artifact Registry]
  Artifact --> CloudRun[Cloud Run prod]
  CloudRun --> SecretManager[Secret Manager]
  CloudRun --> CloudSql[(Cloud SQL prod)]
  CloudRun --> PubSub[(Pub/Sub prod)]
  CloudRun --> Storage[(Bucket documentos)]
  HTTPS[Load Balancer HTTPS] --> Shell[frontend-shell-prod]
  Shell --> MFE[MFEs prod]
  MFE --> Backend[Backends privados]
```
