ALTER TABLE calculos.formula
    ADD COLUMN IF NOT EXISTS estado VARCHAR(20),
    ADD COLUMN IF NOT EXISTS creado_por VARCHAR(200),
    ADD COLUMN IF NOT EXISTS publicado_por VARCHAR(200),
    ADD COLUMN IF NOT EXISTS fecha_publicacion TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS activado_por VARCHAR(200),
    ADD COLUMN IF NOT EXISTS fecha_activacion TIMESTAMPTZ;

UPDATE calculos.formula
SET estado = 'PUBLICADA'
WHERE estado IS NULL;

UPDATE calculos.formula
SET creado_por = 'desconocido'
WHERE creado_por IS NULL OR BTRIM(creado_por) = '';

UPDATE calculos.formula
SET publicado_por = 'desconocido',
    fecha_publicacion = COALESCE(fecha_publicacion, fecha_creacion)
WHERE estado = 'PUBLICADA' AND publicado_por IS NULL;

UPDATE calculos.formula
SET activado_por = 'desconocido',
    fecha_activacion = COALESCE(fecha_activacion, fecha_creacion)
WHERE activa = TRUE AND activado_por IS NULL;

ALTER TABLE calculos.formula
    ALTER COLUMN estado SET DEFAULT 'BORRADOR',
    ALTER COLUMN estado SET NOT NULL,
    ALTER COLUMN creado_por SET DEFAULT 'desconocido',
    ALTER COLUMN creado_por SET NOT NULL;

ALTER TABLE calculos.formula
    ADD CONSTRAINT ck_formula_estado CHECK (estado IN ('BORRADOR', 'PUBLICADA'));

CREATE INDEX IF NOT EXISTS idx_formula_estado
    ON calculos.formula (codigo, estado, version DESC);
