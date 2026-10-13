# Checklist para nuevo MFE

- Nombre usa formato `mfe-<modulo>`.
- Puerto local no choca con shell ni MFEs existentes.
- `NEXT_PUBLIC_MFE_PUBLIC_URL` apunta al puerto local correcto.
- Proxy server-side tiene URL backend local y URL backend Cloud Run por variables de entorno.
- Manifest expone `mount_path`, `entry_url`, `health_url` y capacidades.
- Ruta embedded existe y no depende del shell para funcionar.
- Health local responde HTTP 200.
- Workspace fue agregado en `package.json`.
- Typecheck del paquete nuevo pasa.
- El shell conoce el manifest del nuevo MFE.
- Cloud Run dev/prod tiene service account y variables correctas.
