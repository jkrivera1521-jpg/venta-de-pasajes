INSERT INTO calculos.formula (
    codigo,
    nombre,
    version,
    expresion,
    activa,
    descripcion
)
VALUES (
    'FORM-CREDITO-SCORING-V2',
    'Motor de Scoring Crediticio Multidimensional y Amortizacion',
    1,
    $$
    if (solicitudId == nil) { throw "El parametro 'solicitudId' es obligatorio"; }
    if (financiero.ingresoNetoMensual <= 0) { throw "El ingreso neto mensual debe ser mayor que cero"; }

    let deudasActivas = seq.filter(historialCrediticio, lambda(x) -> x.estado == "ACTIVO" end);
    let deudasCastigadas = seq.filter(historialCrediticio, lambda(x) -> x.estado == "CASTIGADO" || x.diasMoraMaximos > 60 end);

    if (seq.count(deudasCastigadas) > 0) {
        return seq.map(
            "solicitudId", solicitudId,
            "dictamen", "RECHAZADO_DIRECTO",
            "motivo", "El cliente registra operaciones castigadas",
            "scoreFinal", 0,
            "montoAprobado", 0.0
        );
    }

    let totalCuotasVigentes = seq.reduce(deudasActivas, lambda(acc, item) -> acc + item.cuotaMensual end, 0.0);
    let i = propuesta.tasaTNMBase;
    let n = propuesta.plazoMeses;
    let factorAmortizacion = (i * math.pow(1 + i, n)) / (math.pow(1 + i, n) - 1);
    let cuotaMensualProyectada = propuesta.montoSolicitado * factorAmortizacion;

    let ingresoAjustado = financiero.ingresoNetoMensual / financiero.factorEstresInflacionario;
    let gastoTotal = financiero.gastosFijosVariables + totalCuotasVigentes + cuotaMensualProyectada;
    let dtiProyectado = gastoTotal / ingresoAjustado;
    let valorGarantiaReal = propuesta.garantia.valorComercial * propuesta.garantia.factorAjusteLiquidez;
    let ltvProyectado = propuesta.montoSolicitado / valorGarantiaReal;

    let scorePonderado = perfil.scoreBuroInicial;
    if (dtiProyectado <= 0.35) { scorePonderado = scorePonderado + 150; }
    elsif (dtiProyectado <= 0.50) { scorePonderado = scorePonderado + 75; }
    else { scorePonderado = scorePonderado - 150; }

    if (ltvProyectado <= 0.70) { scorePonderado = scorePonderado + 100; }
    else { scorePonderado = scorePonderado - 50; }

    let dictamen = "RECHAZADO";
    let montoAprobado = 0.0;
    if (scorePonderado >= 650 && dtiProyectado <= 0.60) {
        dictamen = "APROBADO";
        montoAprobado = propuesta.montoSolicitado;
    }

    return seq.map(
        "solicitudId", solicitudId,
        "dictamen", dictamen,
        "scoreCalculado", scorePonderado,
        "dtiProyectado", dtiProyectado,
        "ltvProyectado", ltvProyectado,
        "montoAprobado", montoAprobado
    );
    $$,
    TRUE,
    'Evalua capacidad de pago, riesgo crediticio, DTI, LTV y una aprobacion simplificada con datos financieros y de historial crediticio.'
)
ON CONFLICT (codigo, version) DO NOTHING;

INSERT INTO calculos.formula (
    codigo,
    nombre,
    version,
    expresion,
    activa,
    descripcion
)
VALUES (
    'FORM-COMISION-EJECUTIVA-V1',
    'Calculo de Comisiones Multinivel con Aceleradores y Clawbacks',
    1,
    $$
    let ventasValidas = seq.filter(ventasDirectas, lambda(v) -> v.moraCobro == false end);
    let totalVendidoDirecto = seq.reduce(ventasValidas, lambda(acc, v) -> acc + v.monto end, 0.0);

    let totalSoftware = seq.reduce(
        seq.filter(ventasValidas, lambda(v) -> v.categoria == "SOFTWARE" end),
        lambda(acc, v) -> acc + v.monto end, 0.0
    );

    let tasaCumplimiento = totalVendidoDirecto / ejecutivo.metaCuotaGlobal;
    let comisionBaseDirecta = 0.0;
    let montoRestante = totalVendidoDirecto;

    let tramo1Cap = ejecutivo.metaCuotaGlobal * 0.80;
    if (montoRestante > 0) {
        let montoTramo1 = math.min(montoRestante, tramo1Cap);
        comisionBaseDirecta = comisionBaseDirecta + (montoTramo1 * 0.03);
        montoRestante = montoRestante - montoTramo1;
    }

    let tramo2Cap = ejecutivo.metaCuotaGlobal * 0.20;
    if (montoRestante > 0) {
        let montoTramo2 = math.min(montoRestante, tramo2Cap);
        comisionBaseDirecta = comisionBaseDirecta + (montoTramo2 * 0.06);
        montoRestante = montoRestante - montoTramo2;
    }

    if (montoRestante > 0) {
        comisionBaseDirecta = comisionBaseDirecta + (montoRestante * 0.10);
    }

    let totalClawback = seq.reduce(clawbacks, lambda(acc, c) -> acc + c.montoComisionAbonadaPreviamente end, 0.0);
    let liquidacionNeto = comisionBaseDirecta - totalClawback;

    return seq.map(
        "ejecutivoId", ejecutivo.id,
        "totalVendidoDirecto", totalVendidoDirecto,
        "tasaCumplimiento", tasaCumplimiento,
        "comisionBaseDirecta", comisionBaseDirecta,
        "clawbacks", totalClawback,
        "netoAPagar", liquidacionNeto
    );
    $$,
    TRUE,
    'Calcula comisiones directas por tramos, cumplimiento de meta y deducciones por clawbacks para ejecutivos comerciales.'
)
ON CONFLICT (codigo, version) DO NOTHING;

INSERT INTO calculos.formula (
    codigo,
    nombre,
    version,
    expresion,
    activa,
    descripcion
)
VALUES (
    'FORM-LOGISTICA-TARIFARIO-V3',
    'Motor Logistico B2B Volumetrico Geografico Completo',
    1,
    $$
    if (seq.count(paquetes) == 0) { throw "La orden logistica debe incluir al menos un paquete"; }

    let factorDim = cliente.factorVolumetricoSector <= 0 ? 5000.0 : cliente.factorVolumetricoSector;
    let totalPesoFacturableGlobal = 0.0;
    let totalRecargosEspeciales = 0.0;

    for pkg in paquetes {
        let volumenCc = pkg.altoCm * pkg.anchoCm * pkg.largoCm;
        let pesoVolumetrico = volumenCc / factorDim;
        let pesoFacturablePkg = math.max(pkg.pesoRealKg, pesoVolumetrico);
        totalPesoFacturableGlobal = totalPesoFacturableGlobal + pesoFacturablePkg;

        if (pkg.esHazMat) { totalRecargosEspeciales = totalRecargosEspeciales + 45.0; }
        if (pkg.requiereRefrigeracion) { totalRecargosEspeciales = totalRecargosEspeciales + 30.0; }
    }

    let tarifaBasePorKm = 1.0;
    if (origen.zonaId == "ZONA_NORTE" && destino.zonaId == "ZONA_SUR_RURAL") {
        tarifaBasePorKm = 1.25;
    }

    let costoFleteBase = destino.distanciaKm * tarifaBasePorKm;
    let costoPesoBruto = totalPesoFacturableGlobal * 0.85;
    let subtotal = costoFleteBase + costoPesoBruto + totalRecargosEspeciales;

    let descuento = 0.0;
    if (cliente.tipoCliente == "VIP_B2B") {
        descuento = subtotal * 0.15;
    }

    let totalNeto = subtotal - descuento;
    let totalFinal = totalNeto * 1.12;

    return seq.map(
        "envioId", envioId,
        "pesoFacturableTotal", totalPesoFacturableGlobal,
        "subtotalNeto", totalNeto,
        "totalConIva", totalFinal
    );
    $$,
    TRUE,
    'Calcula tarifas logisticas B2B con peso volumetrico, recargos especiales, distancia, zona geografica y descuento por tipo de cliente.'
)
ON CONFLICT (codigo, version) DO NOTHING;
