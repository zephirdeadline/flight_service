use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

static CACHE: OnceLock<Mutex<HashMap<String, Vec<Airspace>>>> = OnceLock::new();
fn cache() -> &'static Mutex<HashMap<String, Vec<Airspace>>> {
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AirspaceLimit {
    pub value: f64,
    pub unit: i32,   // 1 = ft, 0 = m
    pub datum: i32,  // 0 = GND, 1 = MSL, 2 = FL
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Airspace {
    pub name: String,
    pub airspace_type: i32,
    pub icao_class: i32,
    pub upper: AirspaceLimit,
    pub lower: AirspaceLimit,
    /// Polygon rings: coordinates[ring][point] = [lon, lat]
    pub coordinates: Vec<Vec<[f64; 2]>>,
}

fn download_country(cc: &str, dest: &Path) -> Result<(), String> {
    let url = format!(
        "https://storage.googleapis.com/29f98e10-a489-4c82-ae5e-489dbcd4912f/{}_asp.geojson",
        cc
    );
    let resp = reqwest::blocking::get(&url).map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        // Pas de données pour ce pays — sentinel vide
        std::fs::write(dest, b"{}").map_err(|e| e.to_string())?;
        return Ok(());
    }
    let bytes = resp.bytes().map_err(|e| e.to_string())?;
    std::fs::write(dest, &bytes).map_err(|e| e.to_string())
}

fn parse_limit(v: &Value) -> AirspaceLimit {
    AirspaceLimit {
        value: v["value"].as_f64().unwrap_or(0.0),
        unit: v["unit"].as_i64().unwrap_or(1) as i32,
        datum: v["referenceDatum"].as_i64().unwrap_or(1) as i32,
    }
}

fn parse_geojson(data: &str) -> Vec<Airspace> {
    let Ok(v) = serde_json::from_str::<Value>(data) else { return vec![] };
    let Some(features) = v["features"].as_array() else { return vec![] };

    let mut result = Vec::new();
    for f in features {
        let props = &f["properties"];
        let geom = &f["geometry"];

        if geom["type"].as_str() != Some("Polygon") { continue; }
        let Some(raw) = geom["coordinates"].as_array() else { continue };

        let mut rings: Vec<Vec<[f64; 2]>> = Vec::new();
        for ring in raw {
            let Some(pts) = ring.as_array() else { continue };
            let points: Vec<[f64; 2]> = pts.iter().filter_map(|p| {
                let a = p.as_array()?;
                Some([a.first()?.as_f64()?, a.get(1)?.as_f64()?])
            }).collect();
            if !points.is_empty() { rings.push(points); }
        }
        if rings.is_empty() { continue; }

        result.push(Airspace {
            name: props["name"].as_str().unwrap_or("").to_string(),
            airspace_type: props["type"].as_i64().unwrap_or(0) as i32,
            icao_class: props["icaoClass"].as_i64().unwrap_or(8) as i32,
            upper: parse_limit(&props["upperLimit"]),
            lower: parse_limit(&props["lowerLimit"]),
            coordinates: rings,
        });
    }
    result
}

/// Vérifie si le bounding box du premier ring chevauche la viewport
fn bbox_overlaps(lat1: f64, lon1: f64, lat2: f64, lon2: f64, ring: &[[f64; 2]]) -> bool {
    let (mut pln_min, mut pln_max) = (f64::INFINITY, f64::NEG_INFINITY);
    let (mut plt_min, mut plt_max) = (f64::INFINITY, f64::NEG_INFINITY);
    for p in ring {
        pln_min = pln_min.min(p[0]); pln_max = pln_max.max(p[0]);
        plt_min = plt_min.min(p[1]); plt_max = plt_max.max(p[1]);
    }
    !(pln_max < lon1 || pln_min > lon2 || plt_max < lat1 || plt_min > lat2)
}

pub fn get_airspaces(
    countries: &[String],
    lat1: f64, lon1: f64, lat2: f64, lon2: f64,
    cache_dir: &Path,
) -> Result<Vec<Airspace>, String> {
    std::fs::create_dir_all(cache_dir).map_err(|e| e.to_string())?;
    let mut result = Vec::new();

    for cc in countries {
        let cc = cc.to_lowercase();

        // Cache mémoire
        {
            let mem = cache().lock().unwrap();
            if let Some(cached) = mem.get(&cc) {
                result.extend(cached.iter()
                    .filter(|a| a.coordinates.first().map_or(false, |r| bbox_overlaps(lat1, lon1, lat2, lon2, r)))
                    .cloned());
                continue;
            }
        }

        // Cache disque
        let path: PathBuf = cache_dir.join(format!("{}_asp.geojson", cc));
        if !path.exists() {
            download_country(&cc, &path)?;
        }

        let data = std::fs::read_to_string(&path).unwrap_or_default();
        let airspaces = parse_geojson(&data);

        // Stocker en mémoire
        cache().lock().unwrap().insert(cc.clone(), airspaces.clone());

        result.extend(airspaces.into_iter()
            .filter(|a| a.coordinates.first().map_or(false, |r| bbox_overlaps(lat1, lon1, lat2, lon2, r))));
    }

    Ok(result)
}
