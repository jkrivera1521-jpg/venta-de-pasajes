-- dispatch_db - initial legacy seat layout
-- Owner service: dispatch-service

INSERT INTO seat_layouts (id, name, seat_count, active, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000025', 'Legacy 25 asientos', 25, true, now(), now())
ON CONFLICT (name) DO NOTHING;

INSERT INTO seat_layout_seats (seat_layout_id, seat_number, label, row_number, column_number, position, active)
SELECT layout.id, seat.seat_number, seat.label, seat.row_number, seat.column_number, seat.position, true
FROM seat_layouts layout
CROSS JOIN (VALUES
    (1, '1', 2, 1, 'WINDOW'),
    (2, '2', 2, 2, 'AISLE'),
    (3, '3', 1, 5, 'WINDOW'),
    (4, '4', 1, 4, 'AISLE'),
    (5, '5', 2, 5, 'WINDOW'),
    (6, '6', 2, 4, 'AISLE'),
    (7, '7', 3, 1, 'WINDOW'),
    (8, '8', 3, 2, 'AISLE'),
    (9, '9', 4, 5, 'WINDOW'),
    (10, '10', 4, 4, 'AISLE'),
    (11, '11', 4, 1, 'WINDOW'),
    (12, '12', 4, 2, 'AISLE'),
    (13, '13', 5, 5, 'WINDOW'),
    (14, '14', 5, 4, 'AISLE'),
    (15, '15', 5, 1, 'WINDOW'),
    (16, '16', 5, 2, 'AISLE'),
    (17, '17', 6, 5, 'WINDOW'),
    (18, '18', 6, 4, 'AISLE'),
    (19, '19', 6, 1, 'WINDOW'),
    (20, '20', 6, 2, 'AISLE'),
    (21, '21', 7, 5, 'WINDOW'),
    (22, '22', 7, 4, 'AISLE'),
    (23, '23', 7, 1, 'WINDOW'),
    (24, '24', 7, 2, 'AISLE'),
    (25, '25', 7, 3, 'MIDDLE')
) AS seat(seat_number, label, row_number, column_number, position)
WHERE layout.name = 'Legacy 25 asientos'
ON CONFLICT (seat_layout_id, seat_number) DO NOTHING;
