CREATE TABLE identity_sessions (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    user_agent text,
    ip_address text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_identity_sessions_dates CHECK (expires_at > created_at)
);

CREATE INDEX idx_identity_sessions_active
    ON identity_sessions (user_id, expires_at)
    WHERE revoked_at IS NULL;

INSERT INTO permissions (code, description)
VALUES
    ('identity.sessions.read', 'Listar sesiones activas de identidad.'),
    ('identity.sessions.revoke', 'Revocar sesiones activas de identidad.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r
JOIN permissions p ON p.code IN ('identity.sessions.read', 'identity.sessions.revoke')
WHERE r.code = 'ADMIN'
ON CONFLICT DO NOTHING;
