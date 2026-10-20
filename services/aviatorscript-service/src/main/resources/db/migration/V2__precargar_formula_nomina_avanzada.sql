ALTER TABLE calculos.formula
    ADD COLUMN IF NOT EXISTS descripcion TEXT;

INSERT INTO calculos.formula (
    codigo,
    nombre,
    version,
    expresion,
    activa,
    descripcion
)
VALUES (
    'FORM-NOMINA-AVANZADA-001',
    'Calculo avanzado de nomina',
    1,
    $$
if (salarioMensual <= 0) {
    throw "El salario mensual debe ser mayor que cero";
}
if (diasMes <= 0) {
    throw "Los dias del mes deben ser mayores que cero";
}
if (diasTrabajados < 0 || diasTrabajados > diasMes) {
    throw "Los dias trabajados estan fuera del rango permitido";
}
if (calificacionDesempeno < 0 || calificacionDesempeno > 100) {
    throw "La calificacion debe estar entre 0 y 100";
}

let salarioBase = salarioMensual * diasTrabajados / diasMes;
let bonificacionAntiguedad = 0;
if (aniosAntiguedad >= 10) {
    bonificacionAntiguedad = salarioBase * 0.12;
} elsif (aniosAntiguedad >= 5) {
    bonificacionAntiguedad = salarioBase * 0.08;
} elsif (aniosAntiguedad >= 2) {
    bonificacionAntiguedad = salarioBase * 0.04;
} else {
    bonificacionAntiguedad = 0;
}

let bonificacionCargo = 0;
if (tipoEmpleado == "TECNICO") {
    bonificacionCargo = salarioBase * 0.05;
} elsif (tipoEmpleado == "SUPERVISOR") {
    bonificacionCargo = salarioBase * 0.10;
} elsif (tipoEmpleado == "GERENTE") {
    bonificacionCargo = salarioBase * 0.15;
} else {
    bonificacionCargo = 0;
}

let bonificacionDesempeno = 0;
if (calificacionDesempeno >= 95) {
    bonificacionDesempeno = salarioBase * 0.15;
} elsif (calificacionDesempeno >= 90) {
    bonificacionDesempeno = salarioBase * 0.10;
} elsif (calificacionDesempeno >= 80) {
    bonificacionDesempeno = salarioBase * 0.05;
} else {
    bonificacionDesempeno = 0;
}

let valorHora = salarioMensual / 240.0;
let totalHorasExtras = 0;
let detalleHorasExtras = seq.list();
for item in horasExtras {
    let horas = item.horas;
    let multiplicador = 0;
    if (horas <= 0) {
        continue;
    }
    if (item.tipo == "DIURNA") {
        multiplicador = 1.5;
    } elsif (item.tipo == "NOCTURNA") {
        multiplicador = 2.0;
    } elsif (item.tipo == "FERIADO") {
        multiplicador = 2.5;
    } else {
        throw "Tipo de hora extra no reconocido";
    }
    let importe = valorHora * horas * multiplicador;
    totalHorasExtras = totalHorasExtras + importe;
    seq.add(detalleHorasExtras, seq.map(
        "tipo", item.tipo,
        "horas", horas,
        "multiplicador", multiplicador,
        "importe", importe
    ));
}

let totalBonificaciones = bonificacionAntiguedad + bonificacionCargo + bonificacionDesempeno;
let ingresosBrutos = salarioBase + totalBonificaciones + totalHorasExtras;
let descuentoProgresivo = 0;
if (ingresosBrutos <= 1500) {
    descuentoProgresivo = 0;
} elsif (ingresosBrutos <= 2000) {
    descuentoProgresivo = (ingresosBrutos - 1500) * 0.05;
} else {
    descuentoProgresivo = 500 * 0.05 + (ingresosBrutos - 2000) * 0.08;
}

let totalDescuentosAdicionales = 0;
let detalleDescuentos = seq.list();
for descuento in descuentosAdicionales {
    if (descuento.valor < 0) {
        throw "Un descuento no puede ser negativo";
    }
    totalDescuentosAdicionales = totalDescuentosAdicionales + descuento.valor;
    seq.add(detalleDescuentos, seq.map(
        "concepto", descuento.concepto,
        "valor", descuento.valor
    ));
}

let totalDescuentos = descuentoProgresivo + totalDescuentosAdicionales;
let salarioNeto = ingresosBrutos - totalDescuentos;
let clasificacion = "";
if (salarioNeto < 0) {
    clasificacion = "ERROR_SALDO_NEGATIVO";
} elsif (salarioNeto < 1000) {
    clasificacion = "NOMINA_BAJA";
} elsif (salarioNeto <= 2000) {
    clasificacion = "NOMINA_MEDIA";
} else {
    clasificacion = "NOMINA_ALTA";
}

return seq.map(
    "salarioBase", salarioBase,
    "bonificacionAntiguedad", bonificacionAntiguedad,
    "bonificacionCargo", bonificacionCargo,
    "bonificacionDesempeno", bonificacionDesempeno,
    "totalBonificaciones", totalBonificaciones,
    "totalHorasExtras", totalHorasExtras,
    "detalleHorasExtras", detalleHorasExtras,
    "ingresosBrutos", ingresosBrutos,
    "descuentoProgresivo", descuentoProgresivo,
    "detalleDescuentos", detalleDescuentos,
    "totalDescuentosAdicionales", totalDescuentosAdicionales,
    "totalDescuentos", totalDescuentos,
    "salarioNeto", salarioNeto,
    "clasificacion", clasificacion
);
$$,
    TRUE,
    'Calcula una nomina demostrativa: sueldo proporcional, bonificaciones, horas extra, descuentos y salario neto clasificado. Sus tasas son ilustrativas y no representan normativa laboral.'
)
ON CONFLICT (codigo, version) DO NOTHING;
