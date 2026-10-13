INSERT INTO roles (code, name, description, active, status)
VALUES ('CUSTOMER', 'Cliente pasajero', 'Acceso publico para venta en linea sin permisos operativos internos.', true, 'ACTIVE')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    active = true,
    status = 'ACTIVE';

INSERT INTO user_roles (user_id, role_id, assigned_by_user_id)
SELECT u.id, customer_role.id, NULL
FROM users u
CROSS JOIN roles customer_role
WHERE u.identity_type = 'GOOGLE'
  AND customer_role.code = 'CUSTOMER'
  AND NOT EXISTS (
      SELECT 1
      FROM user_roles existing_user_role
      WHERE existing_user_role.user_id = u.id
        AND existing_user_role.role_id = customer_role.id
  )
ON CONFLICT DO NOTHING;

DELETE FROM user_roles user_role
USING users u, roles seller_role
WHERE user_role.user_id = u.id
  AND user_role.role_id = seller_role.id
  AND u.identity_type = 'GOOGLE'
  AND seller_role.code = 'TICKET_SELLER';
