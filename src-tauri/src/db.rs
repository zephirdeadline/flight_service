// Convention Rust 2018+ : pas de mod.rs, juste db.rs qui déclare les sous-modules

use rusqlite::{Connection, Result};
use std::path::PathBuf;

pub mod queries;

pub struct Database {
    conn: Connection,
}

impl Database {
    /// Crée une nouvelle connexion à la base de données
    pub fn new(db_path: PathBuf) -> Result<Self> {
        let conn = Connection::open(db_path)?;

        // Activer les clés étrangères
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;

        Ok(Self { conn })
    }

    /// Initialise la base de données avec les migrations
    pub fn init(&self) -> Result<()> {
        // Lire et exécuter les migrations
        let schema = include_str!("../migrations/001_initial_schema.sql");
        self.conn.execute_batch(schema)?;

        let seed = include_str!("../migrations/002_seed_data.sql");
        self.conn.execute_batch(seed)?;

        let aircraft_specs = include_str!("../migrations/003_aircraft_specs.sql");
        self.conn.execute_batch(aircraft_specs)?;

        Ok(())
    }

    /// Retourne une référence à la connexion
    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    /// Effectue une transaction
    pub fn transaction<F, T>(&mut self, f: F) -> Result<T>
    where
        F: FnOnce(&rusqlite::Transaction) -> Result<T>,
    {
        let tx = self.conn.transaction()?;
        let result = f(&tx)?;
        tx.commit()?;
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_database_creation() {
        let db = Database::new(PathBuf::from(":memory:")).unwrap();
        db.init().unwrap();

        // Vérifier que les tables existent
        let tables: Vec<String> = db
            .conn()
            .prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<Vec<_>>>()
            .unwrap();

        assert!(tables.contains(&"airports".to_string()));
        assert!(tables.contains(&"aircraft_catalog".to_string()));
        assert!(tables.contains(&"players".to_string()));
    }
}
