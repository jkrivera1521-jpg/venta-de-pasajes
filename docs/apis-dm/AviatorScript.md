Para tu motor de cálculos con Quarkus + AviatorScript + PostgreSQL, vamos a crear un ejemplo bastante más avanzado que una simple operación matemática: una fórmula de cálculo de nómina con estructuras de control de flujo, validaciones, condiciones anidadas, ciclos, acumuladores y reglas de negocio.

La idea es que la fórmula esté guardada en PostgreSQL y que tu API la ejecute usando los parámetros recibidos en una petición REST, sin tener que recompilar ni desplegar Quarkus cada vez que cambie una regla.

## 1. Ejemplo: motor de cálculo de nómina

La fórmula realizará estas operaciones:

- Validará el salario, los días trabajados y las horas extras.
    
- Calculará el sueldo proporcional a los días trabajados.
    
- Aplicará una bonificación según el tipo de empleado y su antigüedad.
    
- Recorrerá una lista de horas extras y aplicará tarifas distintas.
    
- Calculará descuentos progresivos según el sueldo.
    
- Evaluará un incentivo por desempeño.
    
- Determinará el sueldo neto y clasificará el resultado.
    
- Devolverá un objeto con el desglose de cada componente.
    

### Parámetros de entrada

```
{
  "salarioMensual": 1800,
  "diasTrabajados": 26,
  "diasMes": 30,
  "aniosAntiguedad": 8,
  "tipoEmpleado": "TECNICO",
  "calificacionDesempeno": 92,
  "horasExtras": [
    {"horas": 5, "tipo": "DIURNA"},
    {"horas": 3, "tipo": "NOCTURNA"},
    {"horas": 2, "tipo": "FERIADO"}
  ],
  "descuentosAdicionales": [
    {"concepto": "PRESTAMO", "valor": 75},
    {"concepto": "ANTICIPO", "valor": 40}
  ]
}
```

Estos datos son ficticios y las tasas utilizadas son ilustrativas; no representan una nómina legal ecuatoriana. En un sistema real, las reglas laborales, tributarias y de seguridad social deben configurarse según la normativa aplicable.

## 2. Fórmula avanzada en AviatorScript

Esta fórmula incorpora estructuras de control reales del lenguaje: `if / elsif / else`, ciclos `for`, validaciones, acumuladores, `continue` y construcción de un resultado estructurado. AviatorScript admite este tipo de lógica y procesamiento de colecciones.

![](https://www.google.com/s2/favicons?domain=https://github.com&sz=32)

GitHub

+1

Guarda el siguiente script como la expresión de la fórmula en tu tabla `calculos.formula`.

```

if (salarioMensual <= 0) {
    throw "El salario mensual debe ser mayor que cero";
}

if (diasMes <= 0) {
    throw "Los días del mes deben ser mayores que cero";
}

if (diasTrabajados < 0 || diasTrabajados > diasMes) {
    throw "Los días trabajados están fuera del rango permitido";
}

if (calificacionDesempeno < 0 ||
    calificacionDesempeno > 100) {
    throw "La calificación debe estar entre 0 y 100";
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

    seq.add(
        detalleHorasExtras,
        seq.map(
            "tipo", item.tipo,
            "horas", horas,
            "multiplicador", multiplicador,
            "importe", importe
        )
    );
}

let totalBonificaciones =
    bonificacionAntiguedad +
    bonificacionCargo +
    bonificacionDesempeno;

let ingresosBrutos =
    salarioBase +
    totalBonificaciones +
    totalHorasExtras;

let descuentoProgresivo = 0;

if (ingresosBrutos <= 1500) {
    descuentoProgresivo = 0;
} elsif (ingresosBrutos <= 2000) {
    descuentoProgresivo =
        (ingresosBrutos - 1500) * 0.05;
} else {
    descuentoProgresivo =
        500 * 0.05 +
        (ingresosBrutos - 2000) * 0.08;
}

let totalDescuentosAdicionales = 0;
let detalleDescuentos = seq.list();

for descuento in descuentosAdicionales {

    if (descuento.valor < 0) {
        throw "Un descuento no puede ser negativo";
    }

    totalDescuentosAdicionales =
        totalDescuentosAdicionales + descuento.valor;

    seq.add(
        detalleDescuentos,
        seq.map(
            "concepto", descuento.concepto,
            "valor", descuento.valor
        )
    );
}

let totalDescuentos =
    descuentoProgresivo +
    totalDescuentosAdicionales;

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
```

## 3. Registrar la fórmula en PostgreSQL

Si tu esquema y tabla tienen las columnas que definimos anteriormente, puedes insertarla con SQL. El delimitador `$$` permite guardar el script multilínea sin tener que escapar cada salto de línea.

```

INSERT INTO calculos.formula (
    codigo,
    nombre,
    version,
    expresion,
    activa
)
VALUES (
    'FORM-NOMINA-AVANZADA-001',
    'Cálculo avanzado de nómina',
    1,
    $$
    if (salarioMensual <= 0) {
        throw "El salario debe ser mayor que cero";
    }

    let salarioBase =
        salarioMensual * diasTrabajados / diasMes;

    let bonificacion = 0;

    if (aniosAntiguedad >= 10) {
        bonificacion = salarioBase * 0.12;
    } elsif (aniosAntiguedad >= 5) {
        bonificacion = salarioBase * 0.08;
    } elsif (aniosAntiguedad >= 2) {
        bonificacion = salarioBase * 0.04;
    }

    let totalExtras = 0;

    for item in horasExtras {
        let factor = 0;

        if (item.tipo == "DIURNA") {
            factor = 1.5;
        } elsif (item.tipo == "NOCTURNA") {
            factor = 2.0;
        } elsif (item.tipo == "FERIADO") {
            factor = 2.5;
        } else {
            throw "Tipo de hora extra no reconocido";
        }

        totalExtras = totalExtras +
            (salarioMensual / 240) *
            item.horas * factor;
    }

    let bruto =
        salarioBase + bonificacion + totalExtras;

    return seq.map(
        "salarioBase", salarioBase,
        "bonificacion", bonificacion,
        "horasExtras", totalExtras,
        "ingresosBrutos", bruto
    );
    $$,
    TRUE
);
```

Importante: este segundo `INSERT` es una versión reducida para facilitar una primera prueba. Para ejecutar la fórmula completa, registra el script completo del apartado 2. Si ya tienes una fórmula con ese código, crea una nueva versión en lugar de sobrescribir una versión que tenga ejecuciones históricas.

## 4. Ejecutar la fórmula desde tu API REST

Con la fórmula completa registrada, prueba el endpoint que definimos para tu proyecto Quarkus.

```

curl -X POST "http://localhost:8080/api/v1/calculos/ejecutar" \
  -H "Content-Type: application/json" \
  -d '{
    "idSolicitud": "NOMINA-2026-0001",
    "codigoFormula": "FORM-NOMINA-AVANZADA-001",
    "parametros": {
      "salarioMensual": 1800,
      "diasTrabajados": 26,
      "diasMes": 30,
      "aniosAntiguedad": 8,
      "tipoEmpleado": "TECNICO",
      "calificacionDesempeno": 92,
      "horasExtras": [
        {"horas": 5, "tipo": "DIURNA"},
        {"horas": 3, "tipo": "NOCTURNA"},
        {"horas": 2, "tipo": "FERIADO"}
      ],
      "descuentosAdicionales": [
        {"concepto": "PRESTAMO", "valor": 75},
        {"concepto": "ANTICIPO", "valor": 40}
      ]
    }
  }'
```

La respuesta de tu API debería incluir el resultado calculado dentro de la estructura que maneja tu servicio. Los importes aproximados esperados son:

|Concepto|Importe|
|---|---|
|Sueldo base proporcional|1.560,00|
|Bonificación por antigüedad|124,80|
|Bonificación por cargo|78,00|
|Incentivo por desempeño|156,00|
|Horas extras|138,75|
|Ingresos brutos|2.057,55|
|Descuento progresivo|29,604|
|Descuentos adicionales|115,00|
|Total descuentos|144,604|
|Sueldo neto|1.912,946|

Los valores están sin redondear a dos decimales para que puedas contrastar la aritmética de la fórmula. En producción deberías definir explícitamente la política de precisión y redondeo.

## 5. ¿Qué hace que este ejemplo sea un motor de reglas?

Decisiones condicionales

`if`, `elsif` y `else` seleccionan diferentes reglas según la antigüedad, el cargo y el desempeño.

Iteraciones

`for` recorre las horas extras y los descuentos, por lo que puedes recibir una cantidad variable de elementos.

Acumuladores

Variables como `totalHorasExtras` y `totalDescuentosAdicionales` acumulan importes durante los ciclos.

Persistencia y trazabilidad

PostgreSQL conserva la fórmula y tu servicio registra cada ejecución con su versión, parámetros, resultado y estado.

## 6. Consideraciones importantes para implementarlo en Quarkus

- Tipos de datos: convierte el JSON de entrada en mapas y listas compatibles con AviatorScript. Los elementos de `horasExtras` y `descuentosAdicionales` deben poder consultarse como propiedades.
    
- Precisión monetaria: para cálculos financieros, define una política de precisión y redondeo; no asumas que los `double` son suficientes para todos los importes.
    
- Seguridad: no permitas que cualquier usuario escriba y active scripts arbitrarios. Restringe las funciones disponibles, establece límites de ejecución y valida las fórmulas antes de activarlas.
    
- Versionamiento: cada cambio en una fórmula debería crear una nueva versión. Así puedes reproducir una ejecución histórica con la versión exacta que se utilizó.
    
- Pruebas: verifica que la expresión se compile y se ejecute con la versión concreta de AviatorScript instalada en tu proyecto. La sintaxis del lenguaje y sus funciones deben probarse en esa versión.
    
    ![](https://www.google.com/s2/favicons?domain=https://github.com&sz=32)
    
    aviatorscript/aviatorscript · GitHub
    
    +1
    

Mi recomendación: mantén separados el motor que ejecuta las fórmulas, el repositorio que las recupera y el servicio que registra las ejecuciones. De esa manera, tu API podrá ejecutar fórmulas de nómina, impuestos, comisiones, cuotas o cualquier otro cálculo sin implementar una clase Java nueva por cada regla de negocio.

todo OK. by DM
