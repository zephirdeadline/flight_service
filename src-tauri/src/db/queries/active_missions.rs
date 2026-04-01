use rusqlite::{params, Connection, Result};
use uuid::Uuid;
use crate::models::{ActiveMission, ActiveMissionStatus, Mission};
use super::airports::get_airport_by_id;
use super::player::{update_player_money, update_player_airport};

pub fn accept_mission(
    conn: &Connection,
    player_id: &str,
    from_airport_id: &str,
    to_airport_id: &str,
    mission_type: &str,
    distance: i32,
    reward: i64,
    cargo_weight: Option<i32>,
    cargo_description: Option<String>,
    passenger_count: Option<i32>,
    aircraft_id: &str,
) -> Result<String> {
    let active_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM active_missions WHERE player_id = ?1",
        params![player_id],
        |row| row.get(0),
    )?;

    if active_count > 0 {
        return Err(rusqlite::Error::InvalidQuery);
    }

    let active_mission_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO active_missions
         (id, player_id, from_airport_id, to_airport_id, type, distance, reward,
          cargo_weight, cargo_description, passenger_count, aircraft_id, accepted_at, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'in_progress')",
        params![
            active_mission_id,
            player_id,
            from_airport_id,
            to_airport_id,
            mission_type,
            distance,
            reward,
            cargo_weight,
            cargo_description,
            passenger_count,
            aircraft_id,
            now,
        ],
    )?;

    Ok(active_mission_id)
}

pub fn get_active_missions(conn: &Connection, player_id: &str) -> Result<Vec<ActiveMission>> {
    let mut stmt = conn.prepare(
        "SELECT id, from_airport_id, to_airport_id, type, distance, reward,
                cargo_weight, cargo_description, passenger_count, aircraft_id, accepted_at, status
         FROM active_missions
         WHERE player_id = ?1
         ORDER BY accepted_at DESC"
    )?;

    let missions = stmt.query_map([player_id], |row| {
        let active_mission_id: String = row.get(0)?;
        let from_airport_id: String = row.get(1)?;
        let to_airport_id: String = row.get(2)?;
        let mission_type: String = row.get(3)?;
        let distance: i32 = row.get(4)?;
        let reward: i64 = row.get(5)?;
        let cargo_weight: Option<i32> = row.get(6)?;
        let cargo_description: Option<String> = row.get(7)?;
        let passenger_count: Option<i32> = row.get(8)?;
        let aircraft_id: String = row.get(9)?;
        let accepted_at: String = row.get(10)?;
        let status_str: String = row.get(11)?;

        let from_airport = get_airport_by_id(conn, &from_airport_id)?
            .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)?;
        let to_airport = get_airport_by_id(conn, &to_airport_id)?
            .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)?;

        let mission = if mission_type == "passenger" {
            Mission::new_passenger(
                format!("active-{}", active_mission_id),
                from_airport,
                to_airport,
                distance,
                reward,
                passenger_count.unwrap_or(0),
            )
        } else {
            Mission::new_cargo(
                format!("active-{}", active_mission_id),
                from_airport,
                to_airport,
                distance,
                reward,
                cargo_weight.unwrap_or(0),
                cargo_description.clone().unwrap_or_default(),
            )
        };

        let status = if status_str == "ready_to_complete" {
            ActiveMissionStatus::ReadyToComplete
        } else {
            ActiveMissionStatus::InProgress
        };

        Ok(ActiveMission { id: active_mission_id, mission, aircraft_id, accepted_at, status })
    })?;

    missions.collect()
}

pub fn complete_active_mission(
    conn: &Connection,
    player_id: &str,
    active_mission_id: &str,
) -> Result<i64> {
    let (reward, aircraft_id, to_airport_id): (i64, String, String) = conn.query_row(
        "SELECT reward, aircraft_id, to_airport_id FROM active_missions WHERE id = ?1 AND player_id = ?2",
        params![active_mission_id, player_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )?;

    conn.execute(
        "DELETE FROM active_missions WHERE id = ?1 AND player_id = ?2",
        params![active_mission_id, player_id],
    )?;

    update_player_money(conn, player_id, reward)?;
    update_player_airport(conn, player_id, &to_airport_id)?;

    conn.execute(
        "UPDATE player_aircraft SET current_airport_id = ?1 WHERE id = ?2 AND player_id = ?3",
        params![&to_airport_id, &aircraft_id, player_id],
    )?;

    Ok(reward)
}

pub fn cancel_active_mission(
    conn: &Connection,
    player_id: &str,
    active_mission_id: &str,
    progress_percentage: i32,
) -> Result<i64> {
    let reward: i64 = conn.query_row(
        "SELECT reward FROM active_missions WHERE id = ?1 AND player_id = ?2",
        params![active_mission_id, player_id],
        |row| row.get(0),
    )?;

    let penalty = (reward * progress_percentage as i64) / 100;

    conn.execute(
        "DELETE FROM active_missions WHERE id = ?1 AND player_id = ?2",
        params![active_mission_id, player_id],
    )?;

    if penalty > 0 {
        update_player_money(conn, player_id, -penalty)?;
    }

    Ok(penalty)
}

pub fn mark_mission_ready_to_complete(conn: &Connection, active_mission_id: &str) -> Result<()> {
    conn.execute(
        "UPDATE active_missions SET status = 'ready_to_complete' WHERE id = ?1",
        params![active_mission_id],
    )?;
    Ok(())
}
