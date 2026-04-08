# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Desktop app (Tauri 2 + React 19 + TypeScript) simulating a Flight Simulator 2024 career mode. Single-player: manage a pilot career, buy aircraft, accept/complete missions, maintain fleet, and integrate with MSFS via SimConnect.

## Tech Stack

- **Frontend**: React 19 + TypeScript 5.8 + Vite 7 + React Router 7
- **Backend**: Rust + Tauri 2 + SQLite (rusqlite 0.30)
- **Package manager**: **pnpm only** — never use npm
- **Styling**: Vanilla CSS (one `.css` file per component/page, no frameworks)

## Commands

```bash
# Frontend dev
pnpm run dev              # Vite dev server at http://localhost:1420
pnpm exec tsc --noEmit    # TypeScript check (run before committing)
pnpm run build

# Full app (Rust + React together)
pnpm tauri dev
pnpm tauri build

# Rust backend only
cd src-tauri && cargo check
cd src-tauri && cargo build

# Import airports from CSV (run once to populate DB)
cd src-tauri && cargo run --bin import_airports
```

Database location:
- Windows: `AppData/Roaming/com.petrocchim.flight_service/flight_service.db`
- Linux/Mac: `~/.local/share/com.petrocchim.flight_service/flight_service.db`

## Architecture

### Frontend State Flow

```
PlayerContext (global state) ← fetched via services → Tauri IPC → Rust commands → SQLite
```

- `src/types/index.ts` — all TypeScript interfaces (`Airport`, `Aircraft`, `OwnedAircraft`, `MarketAircraft`, `Mission`, `Player`, `ActiveMission`, `AircraftMaintenance`, `SimData`)
- `src/context/PlayerContext.tsx` — global player state; use `updateMoney()` instead of `refreshPlayer()` when only money changes (avoids full re-renders)
- `src/context/PopupContext.tsx` — global popup/toast state
- `src/context/SimConnectContext.tsx` — MSFS SimConnect streaming state
- Services (`src/services/`) are thin wrappers around `invoke()` — no local state
- `maintenanceService.ts` is pure calculations (no `invoke` calls)

### Backend Structure

```
src-tauri/src/
├── lib.rs                  # App setup: DB init, register commands, SimConnect init
├── commands.rs             # All Tauri command handlers (~632 lines)
├── simconnect_service.rs   # MSFS integration: streaming, events, payload (~530 lines)
├── models/                 # Rust structs (airport, aircraft, mission, player, maintenance, market)
├── db/
│   ├── queries/            # SQL per domain (airports, aircraft, missions, active_missions,
│   │                       #   player, maintenance, market, geo, cheats)
│   └── queries.rs          # Module re-exports
├── models.rs               # Module re-exports
└── bin/import_airports.rs  # One-time CSV import utility
```

Key patterns:
- `with_db!(state, |db| { ... })` helper macro — acquires `Arc<Mutex<Database>>` and propagates errors
- Aircraft catalog is embedded from `src-tauri/aircraft.yaml` at compile time (not in SQLite)
- Player ID is always `"1"` (single-player)
- All DB mutations use SQLite transactions for atomicity

### SimConnect Integration

`simconnect_service.rs` manages a background thread that streams 80+ telemetry fields (position, altitude, engines, fuel, payload, etc.) every second as `"simconnect-data"` Tauri events. Auto-detects airport on landing and calls `set_player_airport`. The data struct is parsed via unsafe pointer arithmetic over a 1,376-byte binary layout.

Frontend commands: `connect`, `disconnect`, `is_connected`, `get_position`, `send_event`, `start_streaming`, `stop_streaming`, `set_payload`.

### Mission Generation (Deterministic)

```rust
seed = (unix_timestamp / 3600) XOR hash(airport_id)
```

Missions are generated on-the-fly (not stored), identical for 1 hour per airport. 4–10 missions, 50/50 passenger/cargo, destinations 50–300 NM away via SQL bounding box + Haversine filter.

### Database Schema (8 tables)

`airports`, `players`, `player_aircraft`, `aircraft_maintenances`, `maintenance_records`, `missions` (temp), `active_missions` (max 1 per player), `completed_missions`

## Code Conventions

### TypeScript
- Strict mode; no `any` without justification
- Prefix unused params with `_` (e.g., `_playerId`)
- Props and state must be fully typed

### React
- Functional components only; hooks: `useState`, `useEffect`, `useContext`, `useRef`
- Use `useRef` for flags/timers that don't need re-renders

### Rust/Tauri
- Rust 2018+ conventions: no `mod.rs`, declare modules in parent file
- Commands decorated with `#[tauri::command]` and registered in `lib.rs`
- `serde` handles camelCase (TS) ↔ snake_case (Rust) automatically

## Available Tauri Commands

**Airports**: `get_all_airports`, `get_airport_by_id`, `search_airports`  
**Aircraft**: `get_all_aircraft`, `get_aircraft_by_id`, `get_aircraft_by_type`, `get_owned_aircraft`, `select_aircraft`  
**Market**: `get_market_aircraft`, `purchase_market_aircraft`  
**Missions**: `get_missions_by_airport`, `search_missions_to_airport` ($100), `accept_mission`, `get_active_missions`, `complete_active_mission`, `cancel_active_mission`  
**Player**: `create_player`, `get_player`, `purchase_aircraft`  
**Maintenance**: `start_aircraft_maintenance`, `complete_aircraft_maintenance`, `add_maintenance_record`  
**Geo**: `is_within_3km`, `find_airport_near_position`, `set_player_airport`  
**SimConnect**: `connect`, `disconnect`, `is_connected`, `get_position`, `send_event`, `start_streaming`, `stop_streaming`, `set_payload`  
**Cheats**: `teleport_to_airport`, `give_aircraft`, `add_money`, `teleport_aircraft`, `force_complete_mission`, `set_aircraft_wear`, `complete_maintenance`

## Business Rules

**Maintenance**:
- `condition = 100 - (flightHours / maxFlightHoursBeforeMaintenance) × 100`
- Cannot fly if in maintenance or condition < 10%
- Warning states at < 30% (critical) and < 60% (caution)
- Cost = `maintenanceCostPerHour × flightHours` + 50% surcharge if condition < 30%
- Duration = `max(2h, min(48h, flightHours ÷ 10))`

**Mission cancellation penalty**: `penalty = reward × (progressPercentage / 100)`

**Searching missions from other airports costs $100**

**Secondhand market**: deterministic daily seed, condition-based pricing

## Design System

Colors: `#3498db` (primary blue), `#27ae60` (success/money), `#e67e22` (cargo/prices), `#e74c3c` (danger/sell), `#2c3e50` (headings), `#f5f7fa` (background)
