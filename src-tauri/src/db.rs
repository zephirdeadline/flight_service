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
        // Créer une table de versioning des migrations si elle n'existe pas
        self.conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at TEXT DEFAULT CURRENT_TIMESTAMP
            );"
        )?;

        // Migration 1 : Schéma initial
        if !self.migration_applied(1)? {
            let schema = include_str!("../migrations/001_initial_schema.sql");
            self.conn.execute_batch(schema)?;
            self.mark_migration_applied(1)?;
        }

        // Migration 2 : Ajout passengers_json dans active_missions
        if !self.migration_applied(2)? {
            self.conn.execute_batch(
                "ALTER TABLE active_missions ADD COLUMN passengers_json TEXT;"
            )?;
            self.mark_migration_applied(2)?;
        }

        Ok(())
    }

    /// Vérifie si une migration a déjà été appliquée
    fn migration_applied(&self, version: i32) -> Result<bool> {
        let mut stmt = self.conn.prepare(
            "SELECT 1 FROM schema_migrations WHERE version = ?1"
        )?;
        let exists = stmt.exists([version])?;
        Ok(exists)
    }

    /// Marque une migration comme appliquée
    fn mark_migration_applied(&self, version: i32) -> Result<()> {
        self.conn.execute(
            "INSERT INTO schema_migrations (version) VALUES (?1)",
            [version],
        )?;
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
        assert!(tables.contains(&"players".to_string()));
        assert!(tables.contains(&"player_aircraft".to_string()));
    }
}
