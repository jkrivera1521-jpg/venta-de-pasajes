ALTER TABLE calculos.formula
    ADD COLUMN IF NOT EXISTS ejemplo JSONB;

UPDATE calculos.formula
SET ejemplo = $$
{
  "idSolicitud": "PRUEBA-NOMINA-0001",
  "codigoFormula": "FORM-NOMINA-001",
  "parametros": {
    "salario": 2400,
    "bonificacion": 500,
    "descuento": 150
  }
}
$$::jsonb
WHERE codigo = 'FORM-NOMINA-001'
  AND version = 1
  AND ejemplo IS NULL;

UPDATE calculos.formula
SET ejemplo = $$
{
  "idSolicitud": "NOMINA-2026-0001",
  "codigoFormula": "FORM-NOMINA-AVANZADA-001",
  "parametros": {
    "salarioMensual": 2400,
    "diasMes": 100,
    "diasTrabajados": 100,
    "aniosAntiguedad": 8,
    "tipoEmpleado": "TECNICO",
    "calificacionDesempeno": 92,
    "horasExtras": [
      { "horas": 5, "tipo": "DIURNA" },
      { "horas": 3, "tipo": "NOCTURNA" },
      { "horas": 2, "tipo": "FERIADO" }
    ],
    "descuentosAdicionales": [
      { "concepto": "PRESTAMO", "valor": 75 },
      { "concepto": "ANTICIPO", "valor": 40 }
    ]
  }
}
$$::jsonb
WHERE codigo = 'FORM-NOMINA-AVANZADA-001'
  AND version = 1
  AND ejemplo IS NULL;

UPDATE calculos.formula
SET ejemplo = $$
{
  "idSolicitud": "SOL-CREDITO-0001",
  "codigoFormula": "FORM-CREDITO-SCORING-V2",
  "parametros": {
    "solicitudId": "SOL-CREDITO-0001",
    "financiero": {
      "ingresoNetoMensual": 2800,
      "factorEstresInflacionario": 1.05,
      "gastosFijosVariables": 650
    },
    "historialCrediticio": [
      { "estado": "ACTIVO", "cuotaMensual": 180, "diasMoraMaximos": 5 },
      { "estado": "CERRADO", "cuotaMensual": 0, "diasMoraMaximos": 0 }
    ],
    "propuesta": {
      "tasaTNMBase": 0.02,
      "plazoMeses": 24,
      "montoSolicitado": 12000,
      "garantia": { "valorComercial": 22000, "factorAjusteLiquidez": 0.8 }
    },
    "perfil": { "scoreBuroInicial": 620 }
  }
}
$$::jsonb
WHERE codigo = 'FORM-CREDITO-SCORING-V2'
  AND version = 1
  AND ejemplo IS NULL;

UPDATE calculos.formula
SET ejemplo = $$
{
  "idSolicitud": "COMISION-2026-0001",
  "codigoFormula": "FORM-COMISION-EJECUTIVA-V1",
  "parametros": {
    "ventasDirectas": [
      { "moraCobro": false, "monto": 4200, "categoria": "SOFTWARE" },
      { "moraCobro": false, "monto": 1800, "categoria": "SERVICIOS" },
      { "moraCobro": true, "monto": 900, "categoria": "SOFTWARE" }
    ],
    "ejecutivo": { "id": "EJEC-001", "metaCuotaGlobal": 5000 },
    "clawbacks": [
      { "montoComisionAbonadaPreviamente": 120 }
    ]
  }
}
$$::jsonb
WHERE codigo = 'FORM-COMISION-EJECUTIVA-V1'
  AND version = 1
  AND ejemplo IS NULL;

UPDATE calculos.formula
SET ejemplo = $$
{
  "idSolicitud": "ENVIO-2026-0001",
  "codigoFormula": "FORM-LOGISTICA-TARIFARIO-V3",
  "parametros": {
    "paquetes": [
      {
        "altoCm": 40,
        "anchoCm": 30,
        "largoCm": 50,
        "pesoRealKg": 12,
        "esHazMat": false,
        "requiereRefrigeracion": false
      },
      {
        "altoCm": 20,
        "anchoCm": 25,
        "largoCm": 35,
        "pesoRealKg": 6,
        "esHazMat": true,
        "requiereRefrigeracion": false
      }
    ],
    "cliente": { "factorVolumetricoSector": 5000, "tipoCliente": "VIP_B2B" },
    "origen": { "zonaId": "ZONA_NORTE" },
    "destino": { "zonaId": "ZONA_SUR_RURAL", "distanciaKm": 180 },
    "envioId": "ENVIO-2026-0001"
  }
}
$$::jsonb
WHERE codigo = 'FORM-LOGISTICA-TARIFARIO-V3'
  AND version = 1
  AND ejemplo IS NULL;
