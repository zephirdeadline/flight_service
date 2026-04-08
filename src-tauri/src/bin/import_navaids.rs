use rusqlite::{params, Connection, Result};
use std::env;
use std::error::Error;
use std::fs::File;
use std::path::PathBuf;

fn get_tauri_app_data_dir() -> Result<PathBuf, Box<dyn Error>> {
    let app_id = "com.petrocchim.flight_service";
    let data_dir = dirs::data_dir().ok_or("Failed to get data directory")?;
    let app_data_dir = data_dir.join(app_id);
    std::fs::create_dir_all(&app_data_dir)?;
    Ok(app_data_dir)
}

fn main() -> Result<(), Box<dyn Error>> {
    let args: Vec<String> = env::args().collect();

    let csv_path = if args.len() > 1 {
        args[1].clone()
    } else {
        let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        path.push("..");
        path.push("navaids.csv");
        path.to_string_lossy().to_string()
    };

    let db_path = if args.len() > 2 {
        PathBuf::from(&args[2])
    } else {
        get_tauri_app_data_dir()?.join("flight_service.db")
    };

    println!("📂 CSV file: {}", csv_path);
    println!("💾 Database: {}", db_path.display());
    println!();

    let conn = Connection::open(&db_path)?;
    conn.execute("PRAGMA foreign_keys = ON", [])?;

    // Create navaids table if it doesn't exist
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS navaids (
            id TEXT PRIMARY KEY,
            ident TEXT NOT NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            frequency_khz INTEGER NOT NULL DEFAULT 0,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            elevation_ft INTEGER,
            iso_country TEXT NOT NULL DEFAULT '',
            magnetic_variation_deg REAL,
            usage_type TEXT,
            power TEXT,
            associated_airport TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_navaids_ident ON navaids(ident);
        CREATE INDEX IF NOT EXISTS idx_navaids_type ON navaids(type);
        CREATE INDEX IF NOT EXISTS idx_navaids_airport ON navaids(associated_airport);"
    )?;

    println!("Opening CSV file: {}", csv_path);
    let file = File::open(&csv_path)?;
    let mut rdr = csv::Reader::from_reader(file);

    // CSV columns:
    // 0:id  1:filename  2:ident  3:name  4:type  5:frequency_khz
    // 6:latitude_deg  7:longitude_deg  8:elevation_ft  9:iso_country
    // 10:dme_frequency_khz  11:dme_channel  12:dme_latitude_deg
    // 13:dme_longitude_deg  14:dme_elevation_ft  15:slaved_variation_deg
    // 16:magnetic_variation_deg  17:usageType  18:power  19:associated_airport

    let mut stmt = conn.prepare(
        "INSERT OR IGNORE INTO navaids
         (id, ident, name, type, frequency_khz, latitude, longitude,
          elevation_ft, iso_country, magnetic_variation_deg, usage_type, power, associated_airport)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)"
    )?;

    let mut count = 0;

    for result in rdr.records() {
        let record = result?;

        let id = record.get(0).unwrap_or("").to_string();
        let ident = record.get(2).unwrap_or("").to_string();
        let name = record.get(3).unwrap_or("").to_string();
        let navaid_type = record.get(4).unwrap_or("").to_string();
        let frequency_khz = record.get(5).unwrap_or("0").parse::<i64>().unwrap_or(0);
        let latitude = record.get(6).unwrap_or("0").parse::<f64>().unwrap_or(0.0);
        let longitude = record.get(7).unwrap_or("0").parse::<f64>().unwrap_or(0.0);
        let elevation_ft = record.get(8).and_then(|s| s.parse::<i32>().ok());
        let iso_country = record.get(9).unwrap_or("").to_string();
        let magnetic_variation_deg = record.get(16).and_then(|s| s.parse::<f64>().ok());
        let usage_type = record.get(17).filter(|s| !s.is_empty()).map(|s| s.to_string());
        let power = record.get(18).filter(|s| !s.is_empty()).map(|s| s.to_string());
        let associated_airport = record.get(19).filter(|s| !s.is_empty()).map(|s| s.to_string());

        if id.is_empty() || ident.is_empty() {
            continue;
        }

        match stmt.execute(params![
            id, ident, name, navaid_type, frequency_khz,
            latitude, longitude, elevation_ft, iso_country,
            magnetic_variation_deg, usage_type, power, associated_airport,
        ]) {
            Ok(_) => {
                count += 1;
                if count % 500 == 0 {
                    println!("Imported {} navaids...", count);
                }
            }
            Err(e) => eprintln!("Error inserting {}: {}", name, e),
        }
    }

    println!("\n✅ Import completed! {} navaids imported", count);
    Ok(())
}
