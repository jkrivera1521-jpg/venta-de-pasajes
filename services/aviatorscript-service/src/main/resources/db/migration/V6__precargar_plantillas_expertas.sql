-- Plantillas expertas del documento 2 con sus ejemplos de prueba completos.
-- Las versiones publicadas son inmutables y no se reemplazan si ya existen.

INSERT INTO calculos.formula (
    codigo,
    nombre,
    version,
    expresion,
    activa,
    descripcion,
    ejemplo
)
VALUES (
    'FORM-ACTUARIAL-SEGUROS-V4',
    'Motor Actuarial Avanzado para Seguros Colectivos',
    1,
    $$
    if (polizaId == nil) { throw "El parametro 'polizaId' es obligatorio"; }
    if (seq.count(asegurados) == 0) { throw "La nomina de asegurados no puede estar vacia"; }

    let totalPrimasHist = seq.reduce(historicoSiniestros, lambda(acc, h) -> acc + h.montoPrimasCobradas end, 0.0);
    let totalReclamacionesHist = seq.reduce(historicoSiniestros, lambda(acc, h) -> acc + h.montoReclamacionesPagadas end, 0.0);
    let lossRatioGlobal = totalReclamacionesHist / totalPrimasHist;

    let factorExperienciaSiniestral = lossRatioGlobal > 0.85 ? 1.25 : 1.0;
    let numAsegurados = seq.count(asegurados);

    let perfiles = seq.reduce(asegurados, lambda(acc, a) -> seq.add(acc, seq.map(
        "id", a.id,
        "prima", 100000.0 * 0.001 * math.pow(1.06, a.edad - 18) * (a.fumador ? 1.80 : 1.0) * (1.0 + seq.count(a.diagnosticosPrevios) * 0.20)
    )) end, seq.list());

    let primaPura = seq.reduce(perfiles, lambda(acc, p) -> acc + p.prima end, 0.0);
    let primaComercial = (primaPura * factorExperienciaSiniestral) / 0.70;

    return seq.map(
        "polizaId", polizaId,
        "lossRatio", lossRatioGlobal,
        "numAsegurados", numAsegurados,
        "primaPuraTotal", primaPura,
        "primaComercialAnual", primaComercial
    );
    $$,
    TRUE,
    'Evalua siniestralidad, riesgo poblacional y prima comercial de seguros colectivos.',
    $$
{
  "idSolicitud": "POL-ACTUARIAL-2026-9901",
  "codigoFormula": "FORM-ACTUARIAL-SEGUROS-V4",
  "parametros": {
    "polizaId": "POL-ACTUARIAL-2026-9901",
    "empresa": {
      "sectorRiesgo": "MINERIA_SUBTERRANEA",
      "aniosContrato": 3
    },
    "historicoSiniestros": [
      { "anio": 2023, "montoPrimasCobradas": 150000.0, "montoReclamacionesPagadas": 110000.0, "casosGraves": 2 },
      { "anio": 2024, "montoPrimasCobradas": 180000.0, "montoReclamacionesPagadas": 195000.0, "casosGraves": 4 },
      { "anio": 2025, "montoPrimasCobradas": 210000.0, "montoReclamacionesPagadas": 140000.0, "casosGraves": 1 }
    ],
    "asegurados": [
      { "id": "EMP-01", "edad": 28, "fumador": false, "diagnosticosPrevios": ["GASTRITIS"] },
      { "id": "EMP-02", "edad": 54, "fumador": true, "diagnosticosPrevios": ["HIPERTENSION", "DIABETES_T2"] },
      { "id": "EMP-03", "edad": 42, "fumador": false, "diagnosticosPrevios": [] },
      { "id": "EMP-04", "edad": 61, "fumador": true, "diagnosticosPrevios": ["DISLIPIDEMIA", "HIPERTENSION", "CARDIOPATIA"] },
      { "id": "EMP-05", "edad": 35, "fumador": false, "diagnosticosPrevios": ["ASMA"] }
    ],
    "parametrosEstrategicos": {
      "margenUtilidadEsperado": 0.18,
      "gastosAdministrativosTasa": 0.12,
      "factorCargaCatastrofica": 1.05
    }
  }
}
    $$::jsonb
)
ON CONFLICT (codigo, version) DO NOTHING;

INSERT INTO calculos.formula (
    codigo,
    nombre,
    version,
    expresion,
    activa,
    descripcion,
    ejemplo
)
VALUES (
    'FORM-UTILITIES-ENERGIA-V2',
    'Tarificacion Dinamica de Energia con Penalizacion FP y Solar',
    1,
    $$
    let kwhValle = seq.reduce(seq.filter(lecturasIntervalo, lambda(l) -> l.bloque == "VALLE" end), lambda(acc, l) -> acc + l.kwhConsumidos end, 0.0);
    let kwhLlano = seq.reduce(seq.filter(lecturasIntervalo, lambda(l) -> l.bloque == "LLANO" end), lambda(acc, l) -> acc + l.kwhConsumidos end, 0.0);
    let kwhPico = seq.reduce(seq.filter(lecturasIntervalo, lambda(l) -> l.bloque == "PICO" end), lambda(acc, l) -> acc + l.kwhConsumidos end, 0.0);

    let costoEnergia = (kwhValle * preciosBase.kwhValle) + (kwhLlano * preciosBase.kwhLlano) + (kwhPico * preciosBase.kwhPico);
    let totalKwh = kwhValle + kwhLlano + kwhPico;
    let totalReactiva = seq.reduce(lecturasIntervalo, lambda(acc, l) -> acc + l.kvarhReactiva end, 0.0);

    let fp = totalKwh / math.sqrt(math.pow(totalKwh, 2) + math.pow(totalReactiva, 2));
    let penalizacionFP = fp < 0.92 ? costoEnergia * ((0.92 - fp) * 2.5) : 0.0;

    let subtotal = costoEnergia + (contrato.potenciaContratadaKw * preciosBase.kwPotenciaMes) + penalizacionFP;
    let totalConIva = subtotal * 1.12;

    return seq.map(
        "puntoSuministroId", puntoSuministroId,
        "totalKwh", totalKwh,
        "factorPotencia", fp,
        "costoEnergia", costoEnergia,
        "penalizacionFP", penalizacionFP,
        "totalPagar", totalConIva
    );
    $$,
    TRUE,
    'Calcula consumo electrico, factor de potencia, penalizaciones y total de factura.',
    $$
{
  "idSolicitud": "ELECTRO-IND-8831",
  "codigoFormula": "FORM-UTILITIES-ENERGIA-V2",
  "parametros": {
    "puntoSuministroId": "ELECTRO-IND-8831",
    "periodoFacturacion": "2026-09",
    "contrato": {
      "potenciaContratadaKw": 500.0,
      "tipoTarifa": "GRAN_DEMANDA_3T",
      "exentoImpuestoCarbono": false
    },
    "lecturasIntervalo": [
      { "hora": 1, "bloque": "VALLE", "kwhConsumidos": 120.0, "kwPotenciaMaxima": 180.0, "kvarhReactiva": 30.0, "kwhInyectadosSolar": 0.0 },
      { "hora": 14, "bloque": "PICO", "kwhConsumidos": 480.0, "kwPotenciaMaxima": 540.0, "kvarhReactiva": 210.0, "kwhInyectadosSolar": 150.0 },
      { "hora": 19, "bloque": "PICO", "kwhConsumidos": 510.0, "kwPotenciaMaxima": 580.0, "kvarhReactiva": 240.0, "kwhInyectadosSolar": 10.0 },
      { "hora": 22, "bloque": "LLANO", "kwhConsumidos": 310.0, "kwPotenciaMaxima": 390.0, "kvarhReactiva": 80.0, "kwhInyectadosSolar": 0.0 }
    ],
    "preciosBase": {
      "kwhValle": 0.065,
      "kwhLlano": 0.110,
      "kwhPico": 0.245,
      "kwPotenciaMes": 8.50,
      "compensacionSolarKwh": 0.050
    }
  }
}
    $$::jsonb
)
ON CONFLICT (codigo, version) DO NOTHING;

INSERT INTO calculos.formula (
    codigo,
    nombre,
    version,
    expresion,
    activa,
    descripcion,
    ejemplo
)
VALUES (
    'FORM-REASEGURO-XOL-V1',
    'Motor de Distribucion de Perdidas de Reaseguro Layered XoL',
    1,
    $$
    if (montoSiniestroBruto <= 0) { throw "El monto del siniestro debe ser mayor que cero"; }

    let retencionEfectiva = math.min(montoSiniestroBruto, retencionCedente);
    let remanente = montoSiniestroBruto - retencionEfectiva;

    let reparto = seq.list();
    let totalReaseguro = 0.0;

    for capa in capasReaseguro {
        let absorbido = 0.0;
        if (montoSiniestroBruto > capa.prioridadExceso) {
            let exceso = montoSiniestroBruto - capa.prioridadExceso;
            absorbido = math.min(exceso, capa.limiteCapa);
            totalReaseguro = totalReaseguro + absorbido;
        }

        seq.add(reparto, seq.map(
            "capa", capa.capaNumero,
            "absorbido", absorbido,
            "lae", gastosAjusteLAE * (absorbido / montoSiniestroBruto)
        ));
    }

    return seq.map(
        "siniestroId", siniestroId,
        "retencionCedente", retencionEfectiva,
        "totalReaseguro", totalReaseguro,
        "excesoNoCubierto", montoSiniestroBruto - retencionEfectiva - totalReaseguro,
        "desgloseCapas", reparto
    );
    $$,
    TRUE,
    'Distribuye siniestros entre retencion cedente y capas de reaseguro XoL.',
    $$
{
  "idSolicitud": "CLAIM-CATASTROFE-2026-01",
  "codigoFormula": "FORM-REASEGURO-XOL-V1",
  "parametros": {
    "siniestroId": "CLAIM-CATASTROFE-2026-01",
    "montoSiniestroBruto": 18500000.0,
    "gastosAjusteLAE": 1200000.0,
    "retencionCedente": 2000000.0,
    "capasReaseguro": [
      { "capaNumero": 1, "limiteCapa": 3000000.0, "prioridadExceso": 2000000.0, "primaBaseCapa": 150000.0, "porcentajeReinstalamiento": 1.0, "reinstalacionesConsumidas": 0 },
      { "capaNumero": 2, "limiteCapa": 5000000.0, "prioridadExceso": 5000000.0, "primaBaseCapa": 220000.0, "porcentajeReinstalamiento": 1.0, "reinstalacionesConsumidas": 0 },
      { "capaNumero": 3, "limiteCapa": 10000000.0, "prioridadExceso": 10000000.0, "primaBaseCapa": 300000.0, "porcentajeReinstalamiento": 0.5, "reinstalacionesConsumidas": 1 }
    ]
  }
}
    $$::jsonb
)
ON CONFLICT (codigo, version) DO NOTHING;
