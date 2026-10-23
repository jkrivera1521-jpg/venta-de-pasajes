INSERT INTO permissions (code, description) VALUES
    ('REPORT_TEMPLATE_READ', 'Consultar plantillas y sus versiones de reportes.'),
    ('REPORT_TEMPLATE_CREATE', 'Crear plantillas y versiones de reportes.'),
    ('REPORT_TEMPLATE_UPDATE', 'Modificar metadatos de plantillas de reportes.'),
    ('REPORT_TEMPLATE_ACTIVATE', 'Activar una version de plantilla de reportes.'),
    ('REPORT_GENERATE', 'Generar un reporte individual.'),
    ('REPORT_BATCH_GENERATE', 'Crear y consultar trabajos masivos de reportes.'),
    ('REPORT_JOB_DOWNLOAD', 'Descargar resultados de trabajos de reportes.')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'ADMIN'
  AND p.code IN (
      'REPORT_TEMPLATE_READ', 'REPORT_TEMPLATE_CREATE', 'REPORT_TEMPLATE_UPDATE',
      'REPORT_TEMPLATE_ACTIVATE', 'REPORT_GENERATE', 'REPORT_BATCH_GENERATE',
      'REPORT_JOB_DOWNLOAD')
ON CONFLICT DO NOTHING;
