ALTER TABLE calculos.formula
    ADD COLUMN IF NOT EXISTS contrato_entrada JSONB,
    ADD COLUMN IF NOT EXISTS contrato_salida JSONB,
    ADD COLUMN IF NOT EXISTS configuracion_interfaz JSONB;
