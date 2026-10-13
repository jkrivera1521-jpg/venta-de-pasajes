# Gmail API en Google Cloud

Guia para habilitar Gmail API, crear credenciales OAuth y probar envio de correos con `curl`.

Fuentes oficiales usadas:

- Credenciales OAuth para Google Workspace: https://developers.google.com/workspace/guides/create-credentials?hl=es-419
- Scopes de Gmail API: https://developers.google.com/workspace/gmail/api/auth/scopes?hl=es-419
- Envio de mensajes Gmail API: https://developers.google.com/workspace/gmail/api/guides/sending
- Metodo `users.messages.send`: https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send
- Habilitar APIs con `gcloud services enable`: https://docs.cloud.google.com/sdk/gcloud/reference/services/enable

## 1. Conceptos importantes

Para enviar correos con Gmail API necesitas:

1. Un proyecto en Google Cloud.
2. Gmail API habilitada.
3. Una pantalla de consentimiento OAuth configurada.
4. Un OAuth Client ID.
5. Un access token con el scope:

```text
https://www.googleapis.com/auth/gmail.send
```

Ese scope permite enviar correos en nombre del usuario autenticado. Google lo clasifica como scope sensible, por lo que para uso publico real puede pedir verificacion de la app. Para desarrollo se puede trabajar con usuarios de prueba.

La Gmail API envia mensajes MIME codificados como `base64url` en el campo JSON `raw`.

## 2. Habilitar Gmail API en modo grafico

1. Entra a Google Cloud Console:

```text
https://console.cloud.google.com/
```

2. Selecciona o crea el proyecto.
3. En el menu lateral ve a:

```text
APIs y servicios > Biblioteca
```

4. Busca:

```text
Gmail API
```

5. Abre la ficha de Gmail API.
6. Haz clic en:

```text
Habilitar
```

7. Verifica que quede habilitada en:

```text
APIs y servicios > APIs habilitadas y servicios
```

## 3. Habilitar Gmail API por consola

Instala e inicia sesion con Google Cloud CLI si todavia no lo hiciste:

```powershell
gcloud init
gcloud auth login
```

Selecciona el proyecto:

```powershell
gcloud config set project TU_PROJECT_ID
```

Habilita Gmail API:

```powershell
gcloud services enable gmail.googleapis.com
```

Verifica:

```powershell
gcloud services list --enabled --filter="gmail.googleapis.com"
```

Si aparece `gmail.googleapis.com`, la API esta habilitada.

## 4. Configurar OAuth consent screen en modo grafico

Google cambio la interfaz. En muchos proyectos ya no veras una pantalla unica llamada `Pantalla de consentimiento OAuth`; ahora aparece como varias secciones dentro de:

```text
Google Auth Platform
```

Mapa rapido de la interfaz nueva:

| Antes se decia | Ahora lo encuentras en |
| --- | --- |
| Pantalla de consentimiento OAuth | Google Auth Platform |
| Datos de la app / App information | Informacion de la marca |
| Tipo de usuarios / User type | Publico |
| Scopes / Permisos solicitados | Acceso a los datos |
| OAuth Client ID | Clientes |

### 4.1 Completar informacion de la marca

1. En el menu izquierdo entra a:

```text
Google Auth Platform > Informacion de la marca
```

2. Completa los datos minimos:

- Nombre de la app.
- Email de soporte.
- Email de contacto del desarrollador.
- Logo, si ya tienes uno.

Para este proyecto puedes usar:

```text
Nombre de la app: Venta de Pasajes
Email de soporte: tu correo de soporte o desarrollo
Email de contacto del desarrollador: tu correo
```

3. Guarda los cambios.

### 4.2 Configurar publico de la app

1. En el menu izquierdo entra a:

```text
Google Auth Platform > Publico
```

2. Elige segun tu caso:

- `Interno`: solo usuarios de tu organizacion Google Workspace.
- `Externo`: usuarios fuera de tu organizacion o cuentas Gmail personales.

Para pruebas con una cuenta Gmail personal normalmente necesitas `Externo`.

3. En desarrollo, agrega usuarios de prueba:

```text
Google Auth Platform > Publico > Test users
```

Agrega el correo Gmail/Workspace con el que vas a autorizar y enviar correos.

### 4.3 Agregar permisos de Gmail API

1. En el menu izquierdo entra a:

```text
Google Auth Platform > Acceso a los datos
```

2. Agrega el scope de envio:

```text
https://www.googleapis.com/auth/gmail.send
```

3. Guarda los cambios.

Nota: `gmail.send` es un scope sensible. Para pruebas internas basta con usuarios de prueba. Para publicar la app a usuarios reales fuera del modo testing, Google puede pedir verificacion de la app.

## 5. Crear OAuth Client ID en modo grafico

Para una prueba con `curl`, lo mas simple es crear un cliente tipo `Aplicacion web`.

1. Ve a:

```text
Google Auth Platform > Clientes
```

2. Haz clic en:

```text
Crear cliente
```

3. Tipo de aplicacion:

```text
Aplicacion web
```

4. Nombre sugerido:

```text
Venta Pasajes Gmail API Local
```

5. En `Origenes autorizados de JavaScript`, si lo usaras desde tu shell local, agrega:

```text
http://localhost:3000
```

6. En `URIs de redireccionamiento autorizados`, para pruebas manuales agrega:

```text
http://localhost:8080/oauth2callback
https://developers.google.com/oauthplayground
```

Usa `http://localhost:8080/oauth2callback` para el flujo manual con navegador y `curl`.

Usa `https://developers.google.com/oauthplayground` solo si vas a usar OAuth Playground para generar el token de prueba.

7. Guarda.
8. Copia estos valores:

```text
CLIENT_ID
CLIENT_SECRET
```

No subas `CLIENT_SECRET` al repositorio. Guardalo en un `.env` local o en Secret Manager.

## 6. Sobre crear el client_id por consola

Para Gmail API con usuarios Google/Gmail normales, el camino recomendado por Google es crear el OAuth Client ID desde Google Cloud Console, en:

```text
Google Auth Platform > Clientes
```

Existe el comando:

```powershell
gcloud iam oauth-clients create
```

pero Google documenta ese flujo para Workforce Identity Federation, no para crear los OAuth Client IDs estandar usados por Gmail API de usuarios. Ademas, ese comando limita los scopes soportados a scopes de Google Cloud como `cloud-platform`, `openid` y `email`; no sirve para crear un cliente con `https://www.googleapis.com/auth/gmail.send`.

Conclusion practica:

- Usa consola grafica para crear el OAuth Client ID de Gmail API.
- Usa `gcloud` para habilitar APIs, listar servicios y automatizar configuracion del proyecto.
- No uses `gcloud iap oauth-clients create`; es para IAP y esta deprecado.

## 7. Obtener access token con OAuth Playground

Esta es la forma mas rapida para probar envio de correo con `curl`.

1. Abre:

```text
https://developers.google.com/oauthplayground
```

2. En el icono de configuracion, activa:

```text
Use your own OAuth credentials
```

3. Pega:

```text
OAuth Client ID
OAuth Client secret
```

4. En la lista de APIs, busca Gmail API o pega manualmente este scope:

```text
https://www.googleapis.com/auth/gmail.send
```

5. Haz clic en:

```text
Authorize APIs
```

6. Inicia sesion con el correo que enviara el mensaje.
7. Acepta el consentimiento.
8. Haz clic en:

```text
Exchange authorization code for tokens
```

9. Copia el:

```text
Access token
Refresh token
```

El `access_token` es temporal. Sirve para la prueba con `curl`.

El `refresh_token` es el valor que se configura en `APP_GMAIL_REFRESH_TOKEN`. Sirve para que `identity-service` pueda pedir nuevos `access_token` automaticamente cada vez que necesite enviar un correo de recuperacion, sin volver a abrir el navegador ni pedir consentimiento manual.

## 8. Obtener access token manualmente con navegador y curl

Define variables en PowerShell:

```powershell
$CLIENT_ID = "TU_CLIENT_ID"
$CLIENT_SECRET = "TU_CLIENT_SECRET"
$REDIRECT_URI = "http://localhost:8080/oauth2callback"
$SCOPE = "https://www.googleapis.com/auth/gmail.send"
```

Importante: copia las URLs como texto limpio. No copies enlaces Markdown de este estilo:

```text
[http://localhost:8080/oauth2callback](http://localhost:8080/oauth2callback)
```

En PowerShell debe quedar asi:

```powershell
$REDIRECT_URI = "http://localhost:8080/oauth2callback"
$SCOPE = "https://www.googleapis.com/auth/gmail.send"
```

Construye la URL de autorizacion:

```powershell
$authUrl = "https://accounts.google.com/o/oauth2/v2/auth" +
  "?client_id=$CLIENT_ID" +
  "&redirect_uri=$([uri]::EscapeDataString($REDIRECT_URI))" +
  "&response_type=code" +
  "&scope=$([uri]::EscapeDataString($SCOPE))" +
  "&access_type=offline" +
  "&prompt=consent"

Start-Process $authUrl
```

El navegador pedira login y consentimiento.

Si no tienes un servidor escuchando en `localhost:8080`, el navegador puede mostrar una pagina de error, pero la URL tendra un parametro `code=...`.

Ejemplo de URL final:

```text
http://localhost:8080/oauth2callback?iss=https://accounts.google.com&code=4/0AX...&scope=https://www.googleapis.com/auth/gmail.send
```

Copia ese codigo:

```powershell
$AUTH_CODE = "PEGA_AQUI_EL_CODE"
```

El codigo es solo el valor despues de `code=` y antes del siguiente `&`.

Intercambia el codigo por tokens. En PowerShell recomiendo usar este comando en una sola linea para evitar errores con saltos de linea:

```powershell
curl.exe -k -i -X POST "https://oauth2.googleapis.com/token" -H "Content-Type: application/x-www-form-urlencoded" --data-urlencode "code=$AUTH_CODE" --data-urlencode "client_id=$CLIENT_ID" --data-urlencode "client_secret=$CLIENT_SECRET" --data-urlencode "redirect_uri=$REDIRECT_URI" --data-urlencode "grant_type=authorization_code"
```

`-k` solo se usa si tu Windows/cURL falla con `CRYPT_E_NO_REVOCATION_CHECK`. Si no tienes ese error, puedes quitar `-k`.

No mezcles este flujo con OAuth Playground. En este item el `redirect_uri` debe ser siempre:

```text
http://localhost:8080/oauth2callback
```

La respuesta contiene:

```json
{
  "access_token": "...",
  "expires_in": 3599,
  "refresh_token": "...",
  "scope": "https://www.googleapis.com/auth/gmail.send",
  "token_type": "Bearer"
}
```

Guarda el access token para pruebas manuales:

```powershell
$ACCESS_TOKEN = "PEGA_AQUI_EL_ACCESS_TOKEN"
```

Guarda tambien el refresh token para el backend:

```powershell
$APP_GMAIL_REFRESH_TOKEN = "PEGA_AQUI_EL_REFRESH_TOKEN"
```

## 8.1. Que es `APP_GMAIL_REFRESH_TOKEN` y para que sirve

`APP_GMAIL_REFRESH_TOKEN` es el token largo que Google entrega cuando autorizas tu OAuth Client con acceso offline:

```text
access_type=offline
prompt=consent
```

El `access_token` expira rapido, normalmente cerca de 1 hora. Por eso no conviene guardarlo en el backend.

El `refresh_token` permite que `identity-service` haga este flujo automaticamente:

1. Toma `APP_GMAIL_CLIENT_ID`, `APP_GMAIL_CLIENT_SECRET` y `APP_GMAIL_REFRESH_TOKEN`.
2. Llama a `https://oauth2.googleapis.com/token`.
3. Google devuelve un `access_token` nuevo.
4. `identity-service` usa ese `access_token` para llamar a Gmail API y enviar el correo.

En el proyecto, estos valores deben corresponder a la misma cuenta que enviara los correos:

```env
APP_GMAIL_ENABLED=true
APP_GMAIL_CLIENT_ID=TU_CLIENT_ID
APP_GMAIL_CLIENT_SECRET=TU_CLIENT_SECRET
APP_GMAIL_REFRESH_TOKEN=TU_REFRESH_TOKEN
APP_GMAIL_SENDER_EMAIL=correo-autenticado@gmail.com
```

`APP_GMAIL_SENDER_EMAIL` debe ser el correo con el que autorizaste Gmail API, o un alias permitido y verificado en Gmail.

### Obtener el refresh token con OAuth Playground

1. Abre:

```text
https://developers.google.com/oauthplayground
```

2. En configuracion activa:

```text
Use your own OAuth credentials
```

3. Pega tu `OAuth Client ID` y `OAuth Client secret`.
4. Autoriza el scope:

```text
https://www.googleapis.com/auth/gmail.send
```

5. Haz clic en `Authorize APIs`.
6. Ingresa con el correo remitente.
7. Haz clic en `Exchange authorization code for tokens`.
8. Copia el campo:

```text
Refresh token
```

Ese valor es el que va en:

```env
APP_GMAIL_REFRESH_TOKEN=...
```

### Obtener el refresh token con navegador y curl

En el flujo manual del item 8, el refresh token aparece en la respuesta JSON del intercambio:

```json
{
  "access_token": "...",
  "expires_in": 3599,
  "refresh_token": "...",
  "scope": "https://www.googleapis.com/auth/gmail.send",
  "token_type": "Bearer"
}
```

Si aparece `refresh_token`, copialo a:

```powershell
$APP_GMAIL_REFRESH_TOKEN = "PEGA_AQUI_EL_REFRESH_TOKEN"
```

### Renovar access token usando refresh token

Cuando ya tengas el refresh token, puedes probar que funciona asi:

```powershell
$CLIENT_ID = "TU_CLIENT_ID"
$CLIENT_SECRET = "TU_CLIENT_SECRET"
$REFRESH_TOKEN = "TU_REFRESH_TOKEN"

curl.exe -k -i -X POST "https://oauth2.googleapis.com/token" `
  -H "Content-Type: application/x-www-form-urlencoded" `
  --data-urlencode "client_id=$CLIENT_ID" `
  --data-urlencode "client_secret=$CLIENT_SECRET" `
  --data-urlencode "refresh_token=$REFRESH_TOKEN" `
  --data-urlencode "grant_type=refresh_token"
```

Respuesta esperada:

```json
{
  "access_token": "...",
  "expires_in": 3599,
  "scope": "https://www.googleapis.com/auth/gmail.send",
  "token_type": "Bearer"
}
```

En esta respuesta normalmente ya no aparece otro `refresh_token`. Eso es correcto.

### Si Google no devuelve `refresh_token`

Google puede no devolver `refresh_token` si ya autorizaste antes la misma aplicacion con el mismo usuario.

Soluciones:

1. Verifica que la URL de autorizacion tenga:

```text
access_type=offline
prompt=consent
```

2. Revoca el acceso anterior de la app en tu cuenta Google:

```text
https://myaccount.google.com/connections
```

3. Vuelve a ejecutar la autorizacion desde cero.
4. Usa el mismo `redirect_uri` registrado en el OAuth Client.
5. Confirma que estas usando el mismo OAuth Client ID y Client Secret que pondras en `identity-service`.

Trata el `refresh_token` como secreto. No lo subas a Git, no lo pegues en capturas y no lo compartas por chat.

## 9. Probar envio de correo con curl en PowerShell

Define remitente y destinatario:

```powershell
$FROM = "correo-autenticado@gmail.com"
$TO = "destinatario@dominio.com"
$SUBJECT = "Prueba Gmail API"
$TEXT = "Hola, este correo fue enviado desde Gmail API usando curl."
$ACCESS_TOKEN = "PEGA_AQUI_EL_ACCESS_TOKEN"
```

El `FROM` debe ser el mismo usuario autenticado o un alias permitido en Gmail.

Crea el mensaje MIME:

```powershell
$mime = @"
From: $FROM
To: $TO
Subject: $SUBJECT
Content-Type: text/plain; charset="UTF-8"

$TEXT
"@
```

Codifica a `base64url`:

```powershell
$bytes = [System.Text.Encoding]::UTF8.GetBytes($mime)
$raw = [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
```

Construye el JSON:

```powershell
$json = @{ raw = $raw } | ConvertTo-Json -Compress
```

Verifica que el JSON tenga comillas dobles. Debe verse asi:

```powershell
$json
```

Ejemplo esperado:

```json
{"raw":"RnJv..."}
```

Si ves algo como `{raw:RnJv...}` sin comillas, Gmail lo rechazara con `Invalid JSON payload received`.

Para evitar problemas de comillas entre PowerShell y `curl.exe`, guarda el JSON en un archivo temporal:

```powershell
$json | Set-Content -Path ".\gmail-payload.json" -Encoding utf8
Get-Content ".\gmail-payload.json"
```

Envia el correo usando el archivo:

```powershell
curl.exe -k -i -X POST "https://gmail.googleapis.com/gmail/v1/users/me/messages/send" `
  -H "Authorization: Bearer $ACCESS_TOKEN" `
  -H "Content-Type: application/json" `
  --data-binary "@.\gmail-payload.json"
```

`-k` solo se usa si tu Windows/cURL falla con `CRYPT_E_NO_REVOCATION_CHECK`. Si no tienes ese error, puedes quitar `-k`.

Respuesta esperada:

```json
{
  "id": "...",
  "threadId": "...",
  "labelIds": [
    "SENT"
  ]
}
```

## 10. Probar envio de correo con curl en Bash o Git Bash

Variables:

```bash
ACCESS_TOKEN="PEGA_AQUI_EL_ACCESS_TOKEN"
FROM="correo-autenticado@gmail.com"
TO="destinatario@dominio.com"
SUBJECT="Prueba Gmail API"
TEXT="Hola, este correo fue enviado desde Gmail API usando curl."
```

Crear MIME y codificarlo como base64url:

```bash
RAW=$(cat <<EOF | base64 | tr -d '\n' | tr '+/' '-_' | tr -d '='
From: ${FROM}
To: ${TO}
Subject: ${SUBJECT}
Content-Type: text/plain; charset="UTF-8"

${TEXT}
EOF
)
```

Enviar:

```bash
curl -i -X POST "https://gmail.googleapis.com/gmail/v1/users/me/messages/send" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"raw\":\"${RAW}\"}"
```

## 11. Errores comunes

### `403 insufficientPermissions`

El access token no tiene el scope:

```text
https://www.googleapis.com/auth/gmail.send
```

Vuelve a autorizar con ese scope.

### `401 Invalid Credentials`

El access token expiro o esta mal copiado.

Genera uno nuevo o usa el refresh token para renovarlo.

### `redirect_uri_mismatch`

El `redirect_uri` usado en la URL de autorizacion no coincide exactamente con uno registrado en el OAuth Client.

Verifica mayusculas, puerto, protocolo y path.

### `Error 403: access_denied`

La app esta en modo prueba y el usuario no fue agregado como test user.

Agrega el correo en:

```text
Google Auth Platform > Publico > Test users
```

### El correo no sale con el `From` indicado

Gmail solo permite enviar desde el usuario autenticado o desde alias configurados y verificados en Gmail.

### `Could not connect to Gmail API` en `identity-service`

Si Windows puede conectarse a Google con `curl` o PowerShell, pero Quarkus muestra:

```text
Could not connect to Gmail API.
```

el problema puede estar en la validacion TLS de Java. Esto ocurre cuando Java no confia en la cadena de certificados que recibe al conectarse a Google, aunque Windows si la acepte.

Prueba primero la conectividad desde PowerShell:

```powershell
Invoke-WebRequest -Uri "https://oauth2.googleapis.com/token" -Method Get -TimeoutSec 15 -UseBasicParsing
Invoke-WebRequest -Uri "https://gmail.googleapis.com" -Method Get -TimeoutSec 15 -UseBasicParsing
```

Si responde `404 Not Found`, la red esta bien. Ese `404` es esperado porque solo estamos probando conectividad contra la URL base.

Para levantar `identity-service` en Windows usando el almacen de certificados del sistema:

```powershell
$env:MAVEN_OPTS = "-Djavax.net.ssl.trustStore=NONE -Djavax.net.ssl.trustStoreType=Windows-ROOT"
cd C:\VENTA-DE-PASAJES\services\identity-service
mvn quarkus:dev
```

Si despues de esto aparece un error tipo `PKIX path building failed`, Java todavia no esta confiando en el certificado presentado por la red. En ese caso revisa si existe proxy corporativo, antivirus con inspeccion HTTPS, o un certificado raiz institucional que deba instalarse en el almacen de certificados de Windows o en el `cacerts` del JDK.

## 12. Recomendacion para el proyecto Venta de Pasajes

Para desarrollo local:

```env
APP_GMAIL_ENABLED=true
APP_GMAIL_CLIENT_ID=...
APP_GMAIL_CLIENT_SECRET=...
APP_GMAIL_REFRESH_TOKEN=...
APP_GMAIL_SENDER_EMAIL=...
APP_AUTH_RECOVERY_RESET_URL=http://localhost:3001/identity/recovery
```

Para produccion:

- Guardar secretos en Secret Manager.
- No guardar `CLIENT_SECRET` ni `REFRESH_TOKEN` en Git.
- Usar solo el scope minimo `https://www.googleapis.com/auth/gmail.send`.
- Definir una cuenta remitente institucional, por ejemplo `notificaciones@panamericana.ec`.
- Separar el proyecto OAuth de desarrollo y produccion.
- Usar usuarios de prueba mientras la app no este verificada.
