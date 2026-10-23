-- Keep the persisted test payloads aligned with the documented input examples.
-- Formula versions remain immutable; only the optional test metadata is updated.

UPDATE calculos.formula
SET ejemplo = $$
{
  "idSolicitud": "CRED-2026-99421",
  "codigoFormula": "FORM-CREDITO-SCORING-V2",
  "parametros": {
    "solicitudId": "CRED-2026-99421",
    "financiero": {
      "ingresoNetoMensual": 4500.00,
      "gastosFijosVariables": 1200.00,
      "factorEstresInflacionario": 1.08
    },
    "propuesta": {
      "montoSolicitado": 85000.00,
      "plazoMeses": 48,
      "tasaTNMBase": 0.0125,
      "garantia": {
        "tipo": "INMUEBLE",
        "valorComercial": 120000.00,
        "factorAjusteLiquidez": 0.85
      }
    },
    "perfil": {
      "aniosEstabilidadLaboral": 6,
      "tipoContrato": "INDEFINIDO",
      "scoreBuroInicial": 680
    },
    "historialCrediticio": [
      {
        "entidad": "Banco A",
        "saldoPendiente": 12000.00,
        "cuotaMensual": 450.00,
        "diasMoraMaximos": 0,
        "estado": "ACTIVO"
      },
      {
        "entidad": "Financiera B",
        "saldoPendiente": 3500.00,
        "cuotaMensual": 180.00,
        "diasMoraMaximos": 15,
        "estado": "ACTIVO"
      },
      {
        "entidad": "Tarjeta C",
        "saldoPendiente": 8000.00,
        "cuotaMensual": 300.00,
        "diasMoraMaximos": 62,
        "estado": "CASTIGADO"
      },
      {
        "entidad": "Casa Comercial D",
        "saldoPendiente": 0.00,
        "cuotaMensual": 0.00,
        "diasMoraMaximos": 5,
        "estado": "CANCELADO"
      }
    ]
  }
}
$$::jsonb
WHERE codigo = 'FORM-CREDITO-SCORING-V2'
  AND version = 1;

UPDATE calculos.formula
SET ejemplo = $$
{
  "idSolicitud": "COMISION-2026-0001",
  "codigoFormula": "FORM-COMISION-EJECUTIVA-V1",
  "parametros": {
    "ejecutivo": {
      "id": "EXEC-0092",
      "rol": "DIRECTOR_COMERCIAL",
      "metaCuotaGlobal": 100000.00,
      "porcentajeComisionEquipo": 0.025
    },
    "ventasDirectas": [
      {
        "idVenta": "V-101",
        "categoria": "SOFTWARE",
        "monto": 45000.00,
        "moraCobro": false
      },
      {
        "idVenta": "V-102",
        "categoria": "SERVICIOS",
        "monto": 25000.00,
        "moraCobro": false
      },
      {
        "idVenta": "V-103",
        "categoria": "HARDWARE",
        "monto": 50000.00,
        "moraCobro": false
      },
      {
        "idVenta": "V-104",
        "categoria": "SOFTWARE",
        "monto": 15000.00,
        "moraCobro": true
      }
    ],
    "ventasEquipoSubordinado": [
      {
        "subordinadoId": "SUB-01",
        "montoTotal": 80000.00,
        "metaCumplida": true
      },
      {
        "subordinadoId": "SUB-02",
        "montoTotal": 60000.00,
        "metaCumplida": false
      }
    ],
    "clawbacks": [
      {
        "idVentaRevertida": "V-089",
        "montoComisionAbonadaPreviamente": 1200.00,
        "motivo": "CANCELACION_CONTRATO"
      }
    ]
  }
}
$$::jsonb
WHERE codigo = 'FORM-COMISION-EJECUTIVA-V1'
  AND version = 1;

UPDATE calculos.formula
SET ejemplo = $$
{
  "idSolicitud": "LOG-2026-8812",
  "codigoFormula": "FORM-LOGISTICA-TARIFARIO-V3",
  "parametros": {
    "envioId": "LOG-2026-8812",
    "origen": {
      "zonaId": "ZONA_NORTE",
      "esUrbano": true
    },
    "destino": {
      "zonaId": "ZONA_SUR_RURAL",
      "distanciaKm": 340.0,
      "esUrbano": false
    },
    "paquetes": [
      {
        "altoCm": 50.0,
        "anchoCm": 40.0,
        "largoCm": 60.0,
        "pesoRealKg": 12.5,
        "esHazMat": false,
        "requiereRefrigeracion": true
      },
      {
        "altoCm": 100.0,
        "anchoCm": 80.0,
        "largoCm": 120.0,
        "pesoRealKg": 85.0,
        "esHazMat": true,
        "requiereRefrigeracion": false
      }
    ],
    "cliente": {
      "tipoCliente": "VIP_B2B",
      "factorVolumetricoSector": 5000.0
    },
    "condicionesEntorno": {
      "recargoCombustiblePorcentaje": 0.05,
      "temporadaAlta": true
    }
  }
}
$$::jsonb
WHERE codigo = 'FORM-LOGISTICA-TARIFARIO-V3'
  AND version = 1;
