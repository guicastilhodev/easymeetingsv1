-- Migration 002: Criar tabela de salas
-- Requisitos: 3.1 (Cadastro de Salas)

CREATE TABLE IF NOT EXISTS salas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    capacity INTEGER NOT NULL CHECK(capacity BETWEEN 1 AND 200),
    location TEXT NOT NULL CHECK(length(location) BETWEEN 1 AND 200),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
