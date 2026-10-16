CREATE TABLE IF NOT EXISTS formula (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo VARCHAR(100) NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    expresion TEXT NOT NULL,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_formula_codigo_version UNIQUE (codigo, version)
);

CREATE INDEX IF NOT EXISTS idx_formula_activa
    ON formula (codigo, version DESC)
    WHERE activa = TRUE;

CREATE TABLE IF NOT EXISTS ejecucion (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_solicitud VARCHAR(100) NOT NULL,
    formula_id BIGINT NULL,
    codigo_formula VARCHAR(100) NOT NULL,
    version_formula INTEGER NULL,
    parametros JSONB NOT NULL DEFAULT '{}'::jsonb,
    resultado JSONB NULL,
    tipo_resultado VARCHAR(200) NULL,
    estado VARCHAR(30) NOT NULL,
    error TEXT NULL,
    fecha_inicio TIMESTAMPTZ NOT NULL,
    fecha_fin TIMESTAMPTZ NOT NULL,
    duracion_ms BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_ejecucion_formula
        FOREIGN KEY (formula_id) REFERENCES formula (id)
);

CREATE INDEX IF NOT EXISTS idx_ejecucion_solicitud
    ON ejecucion (id_solicitud);
CREATE INDEX IF NOT EXISTS idx_ejecucion_formula_fecha
    ON ejecucion (codigo_formula, fecha_inicio DESC);

INSERT INTO formula (codigo, nombre, version, expresion, activa)
VALUES (
    'FORM-NOMINA-001',
    'Cálculo de salario neto',
    1,
    'salario + bonificacion - descuento',
    TRUE
)
ON CONFLICT (codigo, version) DO NOTHING;
