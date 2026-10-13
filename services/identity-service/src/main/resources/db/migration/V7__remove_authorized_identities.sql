DELETE FROM role_permissions
WHERE permission_code IN (
    'identity.authorized-identities.read',
    'identity.authorized-identities.manage'
);

DELETE FROM permissions
WHERE code IN (
    'identity.authorized-identities.read',
    'identity.authorized-identities.manage'
);

DROP TABLE IF EXISTS authorized_identities;
