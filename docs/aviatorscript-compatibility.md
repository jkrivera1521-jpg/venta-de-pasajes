# Compatibilidad semantica AviatorScript

## Objetivo

Las formulas que se ejecutan en produccion tienen como referencia el motor
AviatorScript Java 5.8.0 del servicio Quarkus. El evaluador TypeScript del MFE
solo es una representacion local del AST y no sustituye al backend.

Esta estrategia evita presentar un resultado local como definitivo cuando la
semantica no esta garantizada. La prueba de usuario del MFE usa siempre
POST /api/v1/calculos/probar; los fixtures de este documento cubren la
compatibilidad del evaluador local para desarrollo y regresiones.

## Contrato de fixtures

El archivo compartido es
test-fixtures/aviatorscript-compatibility.json. Cada fixture contiene:

- id: identificador estable del caso.
- description: comportamiento que se cubre.
- formula: fuente AviatorScript ejecutada por ambos motores.
- inputs: mapa de parametros identico para ambos motores.
- typescript.support: program, expression o unsupported.
- typescript.reason: explicacion obligatoria cuando el MFE no puede evaluar
  el caso localmente.
- expected: resultado esperado, con outcome, type y value, o el
  comportamiento de error.

Los tipos JSON comparables son number, boolean, string, null, list, map y
error. Los valores numericos se comparan exactamente, sin epsilon ni
redondeo de prueba. Una diferencia de 0.01 o una diferencia de precision
binaria hace fallar el fixture.

## Ejecucion de las pruebas

Primero se ejecuta el conjunto compartido con AviatorScript Java. La prueba
genera services/aviatorscript-service/target/aviator-compatibility/java-results.json.
Despues el runner TypeScript ejecuta los mismos fixtures, lee ese reporte y
genera compatibility-report.json con los estados passed, failed y
unsupported.

El informe base versionado con el resultado actual esta en
docs/aviatorscript-compatibility-report.md. El reporte generado por CI es la
fuente dinamica para cada cambio.

Comandos desde la raiz del repositorio:

    mvn -B -Dtest=AviatorCompatibilityFixtureTest test -f services/aviatorscript-service/pom.xml
    $env:AVIATOR_REQUIRE_JAVA_REPORT = "true"
    npm run test:compatibility -w @venta-pasajes/mfe-aviatorscript

El comando npm test del MFE tambien ejecuta el runner. Si no existe el reporte
Java, verifica la semantica local y deja el estado como java-report-missing;
CI usa AVIATOR_REQUIRE_JAVA_REPORT=true para convertir la ausencia del reporte
en un error.

## Cobertura actual

Los fixtures cubren:

- aritmetica, comparaciones, logica, ternarios y funciones matematicas;
- seq.filter, seq.reduce, seq.count, seq.include, seq.map y listas;
- mapas, valores nil/null y tipos JSON;
- for, continue, while, asignaciones y return;
- errores de negocio mediante throw y errores de ejecucion;
- la formula integral de nomina con antiguedad, cargo, desempeno, horas extra
  y descuentos;
- una funcion real del motor, math.log10, que se reporta como unsupported en
  TypeScript para forzar la ejecucion mediante backend.

## Diferencias conocidas

| Area | Evaluador TypeScript | AviatorScript Java | Regla |
| --- | --- | --- | --- |
| Numeros | number IEEE-754 de JavaScript | Numeros dinamicos Aviator, serializados por Jackson | Comparar exactamente; no usar tolerancia |
| Moneda | Las variables AST tipadas como currency se redondean a centavos al leerlas | No aplica ese redondeo implicitamente | El backend es la referencia; marcar el caso como no soportado localmente si depende de ese redondeo |
| Igualdad | Comparacion estricta de JavaScript | Igualdad definida por AviatorScript | Solo declarar compatible una combinacion cubierta por fixture |
| Funciones | Conjunto visual limitado a las funciones de aviator-contract.ts | AviatorScript incluye funciones adicionales, por ejemplo math.log10 y mas operaciones seq.* | Si TypeScript no puede representar la funcion, no devuelve resultado: reporta unsupported y se usa backend |
| Ciclos | while tiene un limite local de 10.000 iteraciones | La ejecucion oficial queda bajo los controles del servicio | El limite local no se usa para afirmar equivalencia |
| Errores | Mensajes locales propios del AST | Mensajes y excepciones propios de AviatorScript | Los throw de negocio comparan mensaje; errores tecnicos comparan categoria |

No se modifica la semantica Java para hacer pasar una prueba local. Cuando
aparece una discrepancia, el fixture falla, el reporte conserva ambos
resultados y la correccion debe hacerse en el contrato o en el MFE, nunca
ocultando la diferencia con una tolerancia.

## Integracion CI/CD

El job aviatorscript-compatibility de .github/workflows/ci.yml:

1. instala Node 24 y Java 21;
2. ejecuta AviatorCompatibilityFixtureTest con el motor Java;
3. compara el reporte contra el evaluador TypeScript;
4. publica el reporte como artefacto de CI.

Una nueva formula o una modificacion del evaluador debe agregar o actualizar
un fixture. Los casos failed bloquean CI. Los casos unsupported no bloquean
mientras tengan una razon explicita y el resultado Java sea valido; su
funcion es impedir que el MFE entregue accidentalmente un resultado local como
definitivo.
