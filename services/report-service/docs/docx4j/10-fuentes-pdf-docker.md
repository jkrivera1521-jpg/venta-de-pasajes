# Fuentes para PDF y Docker

## Dependencias

El `pom.xml` usa los modulos de fuentes de la misma version de docx4j que `docx4j-export-fo`:

- `docx4j-export-fo-fonts-croscore`.
- `docx4j-export-fo-fonts-crosextra`.
- `docx4j-export-fo-fonts-symbol`.

No mezcles `docx4j-bundle-extras` con estos artefactos. El proyecto mantiene docx4j `17.0.0` porque la version disponible del chart renderer no esta publicada con el contrato utilizado por este servicio.

## Prueba local

1. Inicia PostgreSQL y `report-service` con `.env.example`.
2. Carga una plantilla DOCX que use Calibri, Arial, simbolos o una fuente no instalada localmente.
3. Genera PDF desde el MFE.
4. Revisa que el archivo tenga texto, que no falle FOP y que los simbolos no aparezcan como cuadros.

## Prueba en Docker

1. Construye la imagen JVM usando el Dockerfile del servicio.
2. Ejecuta el contenedor en la red donde este PostgreSQL y configura `APP_DB_JDBC_URL` con el nombre del contenedor de base.
3. Configura `APP_JWT_SIGNING_SECRET`, `APP_JWT_ISSUER` y `APP_JWT_AUDIENCE` por variables del entorno; no los pongas en la imagen.
4. Genera el mismo documento desde el MFE apuntando al servicio dockerizado.
5. Compara MIME, tamano razonable, texto visible, imagenes y ausencia de errores de fuentes.

## Verificacion automatizada

```powershell
mvn -f .\services\report-service\pom.xml '-Dtest=DocxTemplateEngineTest#rendersDocxAsPdfWithFopConfiguration' test
```

La prueba verifica la firma `%PDF-`. La validacion de sustitucion de fuentes en una imagen Docker debe ejecutarse como smoke test de despliegue y conservar solo diagnosticos tecnicos, nunca datos de negocio.
