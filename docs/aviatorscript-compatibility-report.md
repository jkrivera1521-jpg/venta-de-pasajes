# Informe base de compatibilidad AviatorScript

Fecha de referencia: 2026-10-22

Motor de referencia: AviatorScript Java 5.8.0  
Fixtures ejecutados: 12  
Resultado: 11 passed, 0 failed, 1 unsupported

## Fixtures aprobados

| Fixture | Cobertura |
| --- | --- |
| arithmetic-basico | Operaciones aritmeticas |
| comparaciones-y-logica | Comparaciones y operadores logicos |
| condicional-y-texto | Ternario y texto |
| funciones-matematicas | pow, sqrt y round |
| colecciones-y-seq | filter, reduce, count, include y map |
| valores-nulos-y-listas | nil/null, mapas y salida estructurada |
| ciclo-for-continue | for, continue y acumulacion |
| ciclo-while | while y actualizacion |
| error-de-negocio | throw con mensaje controlado |
| error-division-por-cero | Error de ejecucion |
| nomina-completa | Antiguedad, cargo, desempeno, horas extra y descuentos |

Los valores numericos fueron comparados exactamente, sin tolerancia. Las
listas y mapas se compararon de forma recursiva; el orden de las claves de
mapa no afecta el resultado.

## Funcionalidad no soportada localmente

| Fixture | Diferencia | Comportamiento |
| --- | --- | --- |
| funcion-no-soportada-localmente | AviatorScript Java ejecuta math.log10, pero el evaluador TypeScript no la representa | No se produce resultado local; el caso se debe ejecutar mediante el backend |

## Diferencias fallidas

No hay diferencias fallidas en el baseline actual. Si aparece una, el test
Java o la comparacion TypeScript fallan y el reporte dinamico conserva el
resultado de ambos motores para diagnostico.

El informe dinamico se genera en
services/aviatorscript-service/target/aviator-compatibility/compatibility-report.json
y se publica como artefacto del job aviatorscript-compatibility de CI.
