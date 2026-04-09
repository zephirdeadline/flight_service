use flate2::read::GzDecoder;
use std::io::Read;
use std::path::{Path, PathBuf};

/// Retourne le nom de la tuile SRTM pour une coordonnée (ex: "N48E002")
fn tile_key(lat: f64, lon: f64) -> String {
    let lat_i = lat.floor() as i32;
    let lon_i = lon.floor() as i32;
    let lat_c = if lat_i >= 0 { 'N' } else { 'S' };
    let lon_c = if lon_i >= 0 { 'E' } else { 'W' };
    format!("{}{:02}{}{:03}", lat_c, lat_i.unsigned_abs(), lon_c, lon_i.unsigned_abs())
}

fn hgt_path(cache_dir: &Path, key: &str) -> PathBuf {
    cache_dir.join(format!("{}.hgt", key))
}

/// Télécharge une tuile depuis le bucket Nextzen/AWS et la décompresse sur disque.
/// Si la tuile n'existe pas (océan, zone sans données), crée un fichier vide sentinel.
fn download_tile(key: &str, dest: &Path) -> Result<(), String> {
    let lat_dir = &key[..3]; // ex: "N48"
    let url = format!(
        "https://elevation-tiles-prod.s3.amazonaws.com/skadi/{}/{}.hgt.gz",
        lat_dir, key
    );

    let resp = reqwest::blocking::get(&url).map_err(|e| e.to_string())?;

    if resp.status().as_u16() == 404 {
        // Pas de données pour cette tuile (océan) — fichier vide comme sentinel
        std::fs::write(dest, b"").map_err(|e| e.to_string())?;
        return Ok(());
    }
    if !resp.status().is_success() {
        return Err(format!("HTTP {} pour {}", resp.status(), url));
    }

    let bytes = resp.bytes().map_err(|e| e.to_string())?;
    let mut gz = GzDecoder::new(&bytes[..]);
    let mut data = Vec::new();
    gz.read_to_end(&mut data).map_err(|e| e.to_string())?;
    std::fs::write(dest, &data).map_err(|e| e.to_string())
}

/// Retourne l'altitude en mètres au point (lat, lon).
/// Télécharge la tuile si elle n'est pas encore en cache local.
/// Retourne None si pas de données (océan, valeur manquante).
pub fn get_elevation_m(lat: f64, lon: f64, cache_dir: &Path) -> Result<Option<i16>, String> {
    let key = tile_key(lat, lon);
    let path = hgt_path(cache_dir, &key);

    if !path.exists() {
        std::fs::create_dir_all(cache_dir).map_err(|e| e.to_string())?;
        download_tile(&key, &path)?;
    }

    let data = std::fs::read(&path).map_err(|e| e.to_string())?;
    if data.is_empty() {
        return Ok(None); // sentinel océan
    }

    // Détecter SRTM1 (3601×3601) ou SRTM3 (1201×1201)
    let size: usize = match data.len() {
        n if n == 3601 * 3601 * 2 => 3601,
        n if n == 1201 * 1201 * 2 => 1201,
        n => return Err(format!("Taille de tuile inattendue: {} octets", n)),
    };

    let row = ((lat.floor() + 1.0 - lat) * (size - 1) as f64).round() as usize;
    let col = ((lon - lon.floor()) * (size - 1) as f64).round() as usize;
    let row = row.min(size - 1);
    let col = col.min(size - 1);

    let offset = (row * size + col) * 2;
    let val = i16::from_be_bytes([data[offset], data[offset + 1]]);
    Ok(if val == -32768 { None } else { Some(val) })
}
