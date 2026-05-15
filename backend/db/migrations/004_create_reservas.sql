-- Migration 004: Criar tabelas de reservas e participantes
-- Requisitos: 6.1 (Gerenciamento de Reservas)

CREATE TABLE IF NOT EXISTS reservas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL REFERENCES salas(id),
    organizer_id INTEGER NOT NULL REFERENCES usuarios(id),
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK(start_time < end_time)
);

CREATE TABLE IF NOT EXISTS participantes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_id INTEGER NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
    participant_name TEXT NOT NULL CHECK(length(participant_name) BETWEEN 1 AND 100)
);
