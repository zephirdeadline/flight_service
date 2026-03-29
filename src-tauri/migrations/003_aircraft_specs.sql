-- Ajouter les spécifications détaillées des avions

ALTER TABLE aircraft_catalog ADD COLUMN max_speed INTEGER NOT NULL DEFAULT 150;
ALTER TABLE aircraft_catalog ADD COLUMN fuel_capacity INTEGER NOT NULL DEFAULT 200; -- en litres
ALTER TABLE aircraft_catalog ADD COLUMN fuel_consumption REAL NOT NULL DEFAULT 30.0; -- litres par heure
ALTER TABLE aircraft_catalog ADD COLUMN empty_weight INTEGER NOT NULL DEFAULT 1000; -- en kg
ALTER TABLE aircraft_catalog ADD COLUMN max_takeoff_weight INTEGER NOT NULL DEFAULT 1500; -- en kg
ALTER TABLE aircraft_catalog ADD COLUMN service_ceiling INTEGER NOT NULL DEFAULT 15000; -- en pieds
ALTER TABLE aircraft_catalog ADD COLUMN rate_of_climb INTEGER NOT NULL DEFAULT 700; -- pieds par minute
ALTER TABLE aircraft_catalog ADD COLUMN wingspan REAL NOT NULL DEFAULT 10.0; -- en mètres
ALTER TABLE aircraft_catalog ADD COLUMN length REAL NOT NULL DEFAULT 8.0; -- en mètres

-- Mettre à jour les spécifications réelles pour chaque avion

-- Cessna 172 Skyhawk
UPDATE aircraft_catalog SET
    max_speed = 163,
    fuel_capacity = 212,
    fuel_consumption = 34.0,
    empty_weight = 767,
    max_takeoff_weight = 1111,
    service_ceiling = 14000,
    rate_of_climb = 721,
    wingspan = 11.0,
    length = 8.3
WHERE id = '1';

-- Airbus A320
UPDATE aircraft_catalog SET
    max_speed = 511,
    fuel_capacity = 24210,
    fuel_consumption = 2500.0,
    empty_weight = 42600,
    max_takeoff_weight = 78000,
    service_ceiling = 39800,
    rate_of_climb = 2500,
    wingspan = 35.8,
    length = 37.6
WHERE id = '2';

-- Boeing 737-800
UPDATE aircraft_catalog SET
    max_speed = 544,
    fuel_capacity = 26020,
    fuel_consumption = 2700.0,
    empty_weight = 41413,
    max_takeoff_weight = 79016,
    service_ceiling = 41000,
    rate_of_climb = 2800,
    wingspan = 35.8,
    length = 39.5
WHERE id = '3';

-- Cessna 208 Caravan
UPDATE aircraft_catalog SET
    max_speed = 214,
    fuel_capacity = 1347,
    fuel_consumption = 160.0,
    empty_weight = 2042,
    max_takeoff_weight = 3969,
    service_ceiling = 25000,
    rate_of_climb = 924,
    wingspan = 15.9,
    length = 12.7
WHERE id = '4';

-- Boeing 747-8F
UPDATE aircraft_catalog SET
    max_speed = 614,
    fuel_capacity = 226095,
    fuel_consumption = 11000.0,
    empty_weight = 197130,
    max_takeoff_weight = 447700,
    service_ceiling = 43000,
    rate_of_climb = 1800,
    wingspan = 68.4,
    length = 76.3
WHERE id = '5';

-- Beechcraft Baron 58
UPDATE aircraft_catalog SET
    max_speed = 242,
    fuel_capacity = 514,
    fuel_consumption = 90.0,
    empty_weight = 1578,
    max_takeoff_weight = 2495,
    service_ceiling = 19700,
    rate_of_climb = 1698,
    wingspan = 11.5,
    length = 9.1
WHERE id = '6';

-- Piper PA-28 Cherokee
UPDATE aircraft_catalog SET
    max_speed = 140,
    fuel_capacity = 189,
    fuel_consumption = 32.0,
    empty_weight = 635,
    max_takeoff_weight = 1043,
    service_ceiling = 13000,
    rate_of_climb = 660,
    wingspan = 9.1,
    length = 7.2
WHERE id = '7';

-- Cirrus SR22
UPDATE aircraft_catalog SET
    max_speed = 211,
    fuel_capacity = 352,
    fuel_consumption = 56.0,
    empty_weight = 1089,
    max_takeoff_weight = 1542,
    service_ceiling = 17500,
    rate_of_climb = 1400,
    wingspan = 11.7,
    length = 7.9
WHERE id = '8';

-- Embraer E175
UPDATE aircraft_catalog SET
    max_speed = 514,
    fuel_capacity = 9950,
    fuel_consumption = 1800.0,
    empty_weight = 23700,
    max_takeoff_weight = 40370,
    service_ceiling = 41000,
    rate_of_climb = 2400,
    wingspan = 28.7,
    length = 31.7
WHERE id = '9';

-- ATR 72-600
UPDATE aircraft_catalog SET
    max_speed = 322,
    fuel_capacity = 5000,
    fuel_consumption = 650.0,
    empty_weight = 13500,
    max_takeoff_weight = 23000,
    service_ceiling = 25000,
    rate_of_climb = 1100,
    wingspan = 27.1,
    length = 27.2
WHERE id = '10';
