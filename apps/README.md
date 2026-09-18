# Apps

Frontend workspace for the shell and microfrontends.

## Modules

- `frontend-shell`: main shell, session, navigation and MFE composition.
- `mfe-identity`: user, role and permission management.
- `mfe-dispatch`: terminals, routes, buses, layouts and departures.
- `mfe-ticketing`: departures, seats, reservations, sales and cancellations.
- `mfe-reporting`: reports and exports.
- `mfe-admin`: configuration, audit views and system health.

## MFE composition

- `frontend-shell` loads remote module metadata from `NEXT_PUBLIC_MFE_IDENTITY_MANIFEST_URL`, `NEXT_PUBLIC_MFE_DISPATCH_MANIFEST_URL`, `NEXT_PUBLIC_MFE_TICKETING_MANIFEST_URL`, `NEXT_PUBLIC_MFE_REPORTING_MANIFEST_URL` and `NEXT_PUBLIC_MFE_ADMIN_MANIFEST_URL`.
- `mfe-identity` exposes its manifest at `/mfe/manifest`.
- `mfe-dispatch` exposes its manifest at `/mfe/manifest`.
- `mfe-ticketing` exposes its manifest at `/mfe/manifest`.
- `mfe-reporting` exposes its manifest at `/mfe/manifest`.
- `mfe-admin` exposes its manifest at `/mfe/manifest`.
- The shell embeds the module from the manifest `entry_url`.
- `mfe-identity` proxies backend calls through `/api/identity/*`.
- `mfe-dispatch` proxies backend calls through `/api/dispatch/*`.
- `mfe-ticketing` proxies backend calls through `/api/ticketing/*`.
- `mfe-reporting` proxies backend calls through `/api/reporting/*`.
- `mfe-admin` proxies backend calls through `/api/audit/*`.
- `mfe-admin` exposes a consolidated health view through `/api/admin/health`.
- `mfe-admin` exposes operational commands and docs through `/api/admin/runbook`.
- `mfe-admin` exposes a guided startup checklist through `/api/admin/startup-checklist`.
- `mfe-admin` exposes effective runtime parameters through `/api/admin/runtime-config`.
- `mfe-admin` exports a consolidated diagnostic snapshot through `/api/admin/diagnostic-export`.
- `mfe-admin` stores and compares local diagnostic snapshots through `/api/admin/diagnostic-history`.
- `mfe-admin` previews or applies local diagnostic retention through `DELETE /api/admin/diagnostic-history?keep=20&dry_run=true|false`.
- `mfe-admin` evaluates production readiness through `/api/admin/production-readiness`.
- The proxy target is `IDENTITY_API_URL` or `NEXT_PUBLIC_IDENTITY_API_URL`.
- The dispatch proxy target is `DISPATCH_API_URL` or `NEXT_PUBLIC_DISPATCH_API_URL`.
- The ticketing proxy target is `TICKETING_API_URL` or `NEXT_PUBLIC_TICKETING_API_URL`.
- The reporting proxy target is `REPORTING_API_URL` or `NEXT_PUBLIC_REPORTING_API_URL`.
- The admin audit proxy target is `AUDIT_API_URL` or `NEXT_PUBLIC_AUDIT_API_URL`.
- Local default ports are `3000` for `frontend-shell`, `3001` for `mfe-identity`, `3002` for `mfe-dispatch`, `3003` for `mfe-ticketing`, `3004` for `mfe-reporting` and `3005` for `mfe-admin`.

## Local HTTP checks

```powershell
curl.exe -s "http://localhost:3001/mfe/manifest"
curl.exe -s "http://localhost:3002/mfe/manifest"
curl.exe -s "http://localhost:3003/mfe/manifest"
curl.exe -s "http://localhost:3004/mfe/manifest"
curl.exe -s "http://localhost:3005/mfe/manifest"
curl.exe -s "http://localhost:3005/api/admin/health"
curl.exe -s "http://localhost:3005/api/admin/runbook"
curl.exe -s "http://localhost:3005/api/admin/startup-checklist"
curl.exe -s "http://localhost:3005/api/admin/runtime-config"
curl.exe -s "http://localhost:3005/api/admin/diagnostic-export"
curl.exe -s "http://localhost:3005/api/admin/diagnostic-history"
curl.exe -X DELETE "http://localhost:3005/api/admin/diagnostic-history?keep=20&dry_run=true"
curl.exe -s "http://localhost:3005/api/admin/production-readiness"
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3001/identity/embedded"
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3002/dispatch/embedded"
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3003/ticketing/embedded"
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3004/reporting/embedded"
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3005/admin/embedded"
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3000/"
```
