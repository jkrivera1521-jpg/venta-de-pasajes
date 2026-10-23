INSERT INTO permissions (code, description) VALUES
    ('aviatorscript.formulas.read', 'Consultar el catalogo de formulas AviatorScript.'),
    ('aviatorscript.formulas.write', 'Crear nuevas versiones borrador de formulas AviatorScript.'),
    ('aviatorscript.formulas.validate', 'Validar codigo AviatorScript con el motor real.'),
    ('aviatorscript.formulas.test', 'Probar codigo AviatorScript sin persistirlo.'),
    ('aviatorscript.formulas.execute', 'Ejecutar formulas activas AviatorScript.'),
    ('aviatorscript.formulas.publish', 'Publicar versiones borrador de formulas AviatorScript.'),
    ('aviatorscript.formulas.activate', 'Activar versiones publicadas de formulas AviatorScript.'),
    ('aviatorscript.formulas.visualize', 'Visualizar estaticamente el flujo de formulas AviatorScript.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'ADMIN'
  AND p.code LIKE 'aviatorscript.formulas.%'
ON CONFLICT DO NOTHING;
