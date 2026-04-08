use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Navaid {
    pub id: String,
    pub ident: String,
    pub name: String,
    #[serde(rename = "type")]
    pub navaid_type: String,
    #[serde(rename = "frequencyKhz")]
    pub frequency_khz: i64,
    pub latitude: f64,
    pub longitude: f64,
    #[serde(rename = "elevationFt")]
    pub elevation_ft: Option<i32>,
    #[serde(rename = "isoCountry")]
    pub iso_country: String,
    #[serde(rename = "magneticVariationDeg")]
    pub magnetic_variation_deg: Option<f64>,
    #[serde(rename = "usageType")]
    pub usage_type: Option<String>,
    pub power: Option<String>,
    #[serde(rename = "associatedAirport")]
    pub associated_airport: Option<String>,
}
