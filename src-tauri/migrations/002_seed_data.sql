-- Seed du catalogue d'avions (données réelles)
INSERT OR IGNORE INTO aircraft_catalog (
    id, name, manufacturer, type, price, capacity, range, cruise_speed,
    maintenance_cost_per_hour, max_flight_hours_before_maintenance
) VALUES
('1', 'Cessna 172 Skyhawk', 'Cessna', 'passenger', 50000, 3, 640, 122, 80, 100),
('2', 'Airbus A320', 'Airbus', 'passenger', 5000000, 180, 3300, 447, 500, 200),
('3', 'Boeing 737-800', 'Boeing', 'passenger', 5500000, 189, 2935, 453, 550, 200),
('4', 'Cessna 208 Caravan', 'Cessna', 'both', 250000, 14, 964, 186, 150, 150),
('5', 'Boeing 747-8F', 'Boeing', 'cargo', 15000000, 140000, 4390, 493, 800, 250),
('6', 'Beechcraft Baron 58', 'Beechcraft', 'passenger', 150000, 5, 1480, 200, 120, 120),
('7', 'Piper PA-28 Cherokee', 'Piper', 'passenger', 40000, 3, 696, 115, 70, 100),
('8', 'Cirrus SR22', 'Cirrus', 'passenger', 200000, 4, 1049, 183, 100, 120),
('9', 'Embraer E175', 'Embraer', 'passenger', 3500000, 88, 2200, 449, 400, 180),
('10', 'ATR 72-600', 'ATR', 'both', 1800000, 70, 825, 276, 250, 160);

-- Les aéroports seront insérés via le script Rust d'import
