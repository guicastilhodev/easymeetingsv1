-- Migration 003: Criar tabela de recursos
-- Requisitos: 4.1 (Gestão de Recursos das Salas)

CREATE TABLE IF NOT EXISTS recursos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL REFERENCES salas(id),
    type TEXT NOT NULL CHECK(length(type) BETWEEN 1 AND 100),
    name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
    quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 9999),
    UNIQUE(room_id, type, name)
);
