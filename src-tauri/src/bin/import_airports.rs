use rusqlite::{params, Connection, Result};
use std::env;
use std::error::Error;
use std::fs::File;
use std::path::PathBuf;

fn get_tauri_app_data_dir() -> Result<PathBuf, Box<dyn Error>> {
    // Utiliser le même identifiant que dans tauri.conf.json
    let app_id = "com.petrocchim.flight_service";

    let data_dir = dirs::data_dir()
        .ok_or("Failed to get data directory")?;

    let app_data_dir = data_dir.join(app_id);

    // Créer le répertoire s'il n'existe pas
    std::fs::create_dir_all(&app_data_dir)?;

    Ok(app_data_dir)
}

fn main() -> Result<(), Box<dyn Error>> {
    // Récupérer les chemins depuis les arguments ou utiliser les valeurs par défaut
    let args: Vec<String> = env::args().collect();

    let csv_path = if args.len() > 1 {
        args[1].clone()
    } else {
        // Chemin par défaut : ../airports.csv depuis src-tauri/
        let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        path.push("..");
        path.push("airports.csv");
        path.to_string_lossy().to_string()
    };

    let db_path = if args.len() > 2 {
        PathBuf::from(&args[2])
    } else {
        // Chemin par défaut : utiliser le même répertoire que l'app Tauri
        let app_data_dir = get_tauri_app_data_dir()?;
        app_data_dir.join("flight_service.db")
    };

    println!("📂 CSV file: {}", csv_path);
    println!("💾 Database: {}", db_path.display());
    println!();

    let conn = Connection::open(&db_path)?;

    // Activer les clés étrangères
    conn.execute("PRAGMA foreign_keys = ON", [])?;

    // Vérifier si la table airports existe, sinon créer le schéma
    let table_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='airports'",
            [],
            |row| row.get::<_, i32>(0),
        )
        .map(|count| count > 0)
        .unwrap_or(false);

    if !table_exists {
        println!("⚠️  Table 'airports' not found. Creating schema...");

        // Lire et exécuter les migrations
        let schema = include_str!("../../migrations/001_initial_schema.sql");
        conn.execute_batch(schema)?;



        println!("✅ Schema created successfully!");
        println!();
    }

    println!("Opening CSV file: {}", csv_path);
    let file = File::open(csv_path)?;
    let mut rdr = csv::Reader::from_reader(file);

    // Préparer la statement d'insertion
    let mut stmt = conn.prepare(
        "INSERT OR IGNORE INTO airports
         (id, icao, iata_code, name, type, city, country, latitude, longitude, elevation, scheduled_service)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)"
    )?;

    let mut count = 0;

    for result in rdr.records() {
        let record = result?;

        // Extraire les champs du CSV
        let _id = record.get(0).unwrap_or("");
        let ident = record.get(1).unwrap_or("");
        let airport_type = record.get(2).unwrap_or("");
        let name = record.get(3).unwrap_or("");
        let latitude = record.get(4).unwrap_or("0").parse::<f64>().unwrap_or(0.0);
        let longitude = record.get(5).unwrap_or("0").parse::<f64>().unwrap_or(0.0);
        let elevation = record.get(6).unwrap_or("0").parse::<i32>().unwrap_or(0);
        let iso_country = record.get(8).unwrap_or("");
        let municipality = record.get(10).unwrap_or("");
        let scheduled_service = record.get(11).unwrap_or("no");
        let icao_code = record.get(12).unwrap_or("");
        let iata_code = record.get(13).unwrap_or("");

        // Convertir scheduled_service en booléen
        let is_scheduled = scheduled_service == "yes";

        // Utiliser ICAO comme id si disponible, sinon utiliser ident
        let airport_id = if !icao_code.is_empty() {
            icao_code.to_string()
        } else {
            ident.to_string()
        };

        // IATA code peut être vide
        let iata = if iata_code.is_empty() {
            None
        } else {
            Some(iata_code.to_string())
        };

        // Insérer dans la base de données
        match stmt.execute(params![
            airport_id,
            ident,
            iata,
            name,
            airport_type,
            municipality,
            iso_country,
            latitude,
            longitude,
            elevation,
            is_scheduled,
        ]) {
            Ok(_) => {
                count += 1;
                if count % 100 == 0 {
                    println!("Imported {} airports...", count);
                }
            }
            Err(e) => {
                eprintln!("Error inserting {}: {}", name, e);
            }
        }
    }

    println!("\n✅ Import completed!");
    println!("   {} airports imported", count);

    Ok(())
}
