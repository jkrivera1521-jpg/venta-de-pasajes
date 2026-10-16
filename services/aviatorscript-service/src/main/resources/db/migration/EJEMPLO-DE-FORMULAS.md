
EJEMPLO 1

INSERT INTO calculos.formula (
    codigo,
    nombre,
    version,
    expresion,
    activa
)
VALUES (
    'FORM-IVA-001',
    'Cálculo de IVA',
    1,
    'subtotal * 0.15',
    TRUE
);


EJEMPLO 2

INSERT INTO calculos.formula (
    codigo,
    nombre,
    version,
    expresion,
    activa
)
VALUES (
    'FORM-PRECIO-001',
    'Precio final con IVA y descuento',
    1,
    '(subtotal - descuento) * 1.15',
    TRUE
);






