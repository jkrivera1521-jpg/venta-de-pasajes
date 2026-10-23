-- Plantillas del documento 3 con sus ejemplos de prueba completos.
-- El documento contiene dos casos; las versiones publicadas son inmutables.

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
    'FORM-TURISMO-DYNAMIC-PACKAGING-V1',
    'Motor Dynamic Packaging y Yield Management para Agencias de Viaje',
    1,
    $$
    if (cotizacionId == nil) { throw "Cotizacion requerida"; }
    if (seq.count(pasajeros) == 0) { throw "La lista de pasajeros no puede estar vacia"; }
    if (seq.count(servicios) == 0) { throw "Debe incluir al menos un servicio"; }

    let numAdultos = seq.count(seq.filter(pasajeros, lambda(p) -> p.tipo == "ADULTO" end));
    let numNinos = seq.count(seq.filter(pasajeros, lambda(p) -> p.tipo == "NINO" end));
    let numInfants = seq.count(seq.filter(pasajeros, lambda(p) -> p.tipo == "INFANT" end));
    if (numAdultos == 0) { throw "El paquete debe incluir al menos un adulto"; }

    let factorAnticipacion = diasHastaViaje < 7 ? 1.25 : (diasHastaViaje < 30 ? 1.10 : (diasHastaViaje > 90 ? 0.92 : 1.0));
    let factorTemporada = temporada == "ALTA" ? 1.30 : (temporada == "MEDIA" ? 1.10 : 0.85);
    let multiplicadorYieldGlobal = factorAnticipacion * factorTemporada;

    let detalleServiciosCotizados = seq.list();
    for srv in servicios {
        let tasaConversion = srv.moneda == "USD" ? tasasCambioUSD.USD : (srv.moneda == "EUR" ? tasasCambioUSD.EUR : tasasCambioUSD.BRL);
        if (tasaConversion == nil || tasaConversion <= 0) { throw "Tasa de cambio no disponible"; }

        let factorCantidad = srv.tipo == "HOTEL" ? srv.noches : 1.0;
        let costoBaseServicio = srv.costoNetoUnitario * tasaConversion * factorCantidad;
        let costoEfectivoPasajeros = (numAdultos * costoBaseServicio) + (numNinos * costoBaseServicio * 0.65) + (numInfants * costoBaseServicio * 0.10);
        let precioVentaServicio = costoEfectivoPasajeros * (1.0 + srv.markupEsperado) * multiplicadorYieldGlobal;

        seq.add(detalleServiciosCotizados, seq.map(
            "tipoServicio", srv.tipo,
            "proveedor", srv.proveedor,
            "monedaOrigen", srv.moneda,
            "costoNetoUSD", costoEfectivoPasajeros,
            "precioVentaFinalUSD", precioVentaServicio,
            "margenGananciaBrutaUSD", precioVentaServicio - costoEfectivoPasajeros
        ));
    }

    let costoNetoTotalPaqueteUSD = seq.reduce(detalleServiciosCotizados, lambda(acc, item) -> acc + item.costoNetoUSD end, 0.0);
    let precioVentaBasePaqueteUSD = seq.reduce(detalleServiciosCotizados, lambda(acc, item) -> acc + item.precioVentaFinalUSD end, 0.0);
    let valorComisionAgenciaUSD = precioVentaBasePaqueteUSD * parametroComisionAgencia;
    let precioVentaTotalAgenciaUSD = precioVentaBasePaqueteUSD + valorComisionAgenciaUSD;
    let impuestosTurismoLocales = precioVentaTotalAgenciaUSD * 0.05;
    let granTotalPagarUSD = precioVentaTotalAgenciaUSD + impuestosTurismoLocales;
    let totalPasajerosPago = numAdultos + numNinos;

    return seq.map(
        "cotizacionId", cotizacionId,
        "resumenPasajeros", seq.map("adultos", numAdultos, "ninos", numNinos, "infants", numInfants, "totalFacturable", totalPasajerosPago),
        "multiplicadorYieldGlobal", multiplicadorYieldGlobal,
        "desgloseServicios", detalleServiciosCotizados,
        "costoNetoTotalUSD", costoNetoTotalPaqueteUSD,
        "comisionAgenciaUSD", valorComisionAgenciaUSD,
        "impuestosTurismoUSD", impuestosTurismoLocales,
        "granTotalCotizacionUSD", granTotalPagarUSD,
        "precioPromedioPorPersonaUSD", granTotalPagarUSD / totalPasajerosPago
    );
    $$,
    TRUE,
    'Cotiza paquetes turisticos con conversion de moneda, yield, pasajeros y servicios.',
    $$
{
  "idSolicitud": "COT-TRAVEL-2026-8801",
  "codigoFormula": "FORM-TURISMO-DYNAMIC-PACKAGING-V1",
  "parametros": {
    "cotizacionId": "COT-TRAVEL-2026-8801",
    "diasHastaViaje": 12,
    "temporada": "ALTA",
    "tasasCambioUSD": {
      "USD": 1.0,
      "EUR": 1.08,
      "BRL": 0.18
    },
    "pasajeros": [
      { "id": "PAX-01", "tipo": "ADULTO", "edad": 35 },
      { "id": "PAX-02", "tipo": "ADULTO", "edad": 33 },
      { "id": "PAX-03", "tipo": "NINO", "edad": 7 },
      { "id": "PAX-04", "tipo": "INFANT", "edad": 1 }
    ],
    "servicios": [
      { "tipo": "VUELO", "proveedor": "LATAM", "costoNetoUnitario": 350.0, "moneda": "USD", "markupEsperado": 0.12 },
      { "tipo": "HOTEL", "proveedor": "MARRIOTT", "costoNetoUnitario": 120.0, "moneda": "EUR", "markupEsperado": 0.18, "noches": 5 },
      { "tipo": "TOUR", "proveedor": "CIVITATIS", "costoNetoUnitario": 250.0, "moneda": "BRL", "markupEsperado": 0.25 }
    ],
    "parametroComisionAgencia": 0.08
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
    'FORM-TRANSPORTE-TARIFICACION-V1',
    'Motor de Tarificacion Dinamica de Boletos y Cargo Volumetrico',
    1,
    $$
    if (viajeId == nil) { throw "Viaje no especificado"; }
    if (capacidadBus.asientosOcupadosActuales >= capacidadBus.totalAsientos) { throw "No hay asientos disponibles"; }

    let porcentajeOcupacion = (capacidadBus.asientosOcupadosActuales * 1.0) / capacidadBus.totalAsientos;
    let factorDynamicPricing = porcentajeOcupacion >= 0.90 ? 1.40 : (porcentajeOcupacion >= 0.70 ? 1.20 : (porcentajeOcupacion < 0.30 ? 0.90 : 1.0));
    let recargoCategoriaAsiento = boletoSolicitado.categoriaAsiento == "VIP_PISO_1" ? 1.25 : 1.0;
    let tarifaSubtotalAsiento = boletoSolicitado.tarifaBaseRuta * factorDynamicPricing * recargoCategoriaAsiento;
    let porcentajeDescuentoLegal = (boletoSolicitado.tipoPasajero == "TERCERA_EDAD" || boletoSolicitado.tipoPasajero == "DISCAPACIDAD") ? 0.50 : (boletoSolicitado.tipoPasajero == "NINO" ? 0.30 : 0.0);
    let valorDescuentoLegal = tarifaSubtotalAsiento * porcentajeDescuentoLegal;
    let tarifaFinalBoletoPasajero = tarifaSubtotalAsiento - valorDescuentoLegal;

    let detalleCargaCalculada = seq.list();
    let totalCargaEquipajeUSD = 0.0;
    for item in encomiendasYEquipaje {
        let esGratis = item.esEquipajeMano || item.pesoKg <= 15.0;
        let pesoVolumetrico = (item.largoCm * item.anchoCm * item.altoCm) / 5000.0;
        let pesoFacturable = math.max(item.pesoKg * 1.0, pesoVolumetrico);
        let costoItemCarga = 0.0;
        if (!esGratis) {
            let pesoExcedente = math.max(0.0, pesoFacturable - 15.0);
            costoItemCarga = (pesoExcedente * 0.75) + (ruta.distanciaKm * 0.01);
        }
        totalCargaEquipajeUSD = totalCargaEquipajeUSD + costoItemCarga;
        seq.add(detalleCargaCalculada, seq.map(
            "descripcion", item.descripcion,
            "pesoRealKg", item.pesoKg,
            "pesoVolumetricoKg", pesoVolumetrico,
            "pesoFacturableKg", pesoFacturable,
            "exentoPago", esGratis,
            "costoFleteUSD", costoItemCarga
        ));
    }

    let galonesEstimadosRuta = ruta.distanciaKm / combustibleParametros.rendimientoKmPorGalon;
    let costoTotalCombustibleRuta = galonesEstimadosRuta * combustibleParametros.precioGalonDiesel;
    let costoTotalPeajesRuta = ruta.numeroPeajes * ruta.costoPromedioPeaje;
    let recargoOperativoPorPasajero = (costoTotalCombustibleRuta + costoTotalPeajesRuta) / capacidadBus.totalAsientos;
    let seguroPasajeroObligatorio = 1.25;
    let granTotalTicketUSD = tarifaFinalBoletoPasajero + totalCargaEquipajeUSD + recargoOperativoPorPasajero + seguroPasajeroObligatorio;

    return seq.map(
        "viajeId", viajeId,
        "resumenRuta", seq.map("origen", ruta.origen, "destino", ruta.destino, "distanciaKm", ruta.distanciaKm, "ocupacionBusPorcentaje", porcentajeOcupacion * 100.0),
        "liquidacionBoleto", seq.map("tarifaBase", boletoSolicitado.tarifaBaseRuta, "factorOcupacionAplicado", factorDynamicPricing, "subtotalSinDescuento", tarifaSubtotalAsiento, "descuentoLegalAplicado", valorDescuentoLegal, "tarifaNetaPasaje", tarifaFinalBoletoPasajero),
        "desgloseCargaYEncomiendas", detalleCargaCalculada,
        "totalFleteCargaUSD", totalCargaEquipajeUSD,
        "cuotaOperativaCombustiblePeajeUSD", recargoOperativoPorPasajero,
        "seguroObligatorioPasajeroUSD", seguroPasajeroObligatorio,
        "montoTotalTicketUSD", granTotalTicketUSD
    );
    $$,
    TRUE,
    'Calcula tarifa de pasajeros, carga volumetrica y recargos operativos.',
    $$
{
  "idSolicitud": "VIAJE-EXPRESO-2026-402",
  "codigoFormula": "FORM-TRANSPORTE-TARIFICACION-V1",
  "parametros": {
    "viajeId": "VIAJE-EXPRESO-2026-402",
    "ruta": {
      "origen": "QUITO",
      "destino": "GUAYAQUIL",
      "distanciaKm": 420.0,
      "numeroPeajes": 5,
      "costoPromedioPeaje": 1.50
    },
    "capacidadBus": {
      "totalAsientos": 40,
      "asientosOcupadosActuales": 32
    },
    "boletoSolicitado": {
      "categoriaAsiento": "VIP_PISO_1",
      "tipoPasajero": "TERCERA_EDAD",
      "tarifaBaseRuta": 18.00
    },
    "encomiendasYEquipaje": [
      { "descripcion": "Maleta Viaje", "pesoKg": 18.0, "largoCm": 60, "anchoCm": 40, "altoCm": 30, "esEquipajeMano": true },
      { "descripcion": "Caja Repuestos", "pesoKg": 32.0, "largoCm": 80, "anchoCm": 60, "altoCm": 50, "esEquipajeMano": false }
    ],
    "combustibleParametros": {
      "precioGalonDiesel": 1.90,
      "rendimientoKmPorGalon": 12.0
    }
  }
}
    $$::jsonb
)
ON CONFLICT (codigo, version) DO NOTHING;
