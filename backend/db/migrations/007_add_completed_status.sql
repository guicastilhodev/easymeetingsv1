-- Migration 007: Adiciona status 'completed' às reservas
-- Recria a tabela reservas para incluir 'completed' no CHECK constraint

-- Passo 1: Criar tabela temporária com o novo constraint
CREATE TABLE IF NOT EXISTS reservas_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL REFERENCES salas(id),
    organizer_id INTEGER NOT NULL REFERENCES usuarios(id),
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'cancelled', 'completed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK(start_time < end_time)
);

-- Passo 2: Copiar dados existentes
INSERT INTO reservas_new SELECT * FROM reservas;

-- Passo 3: Remover tabela antiga
DROP TABLE reservas;

-- Passo 4: Renomear nova tabela
ALTER TABLE reservas_new RENAME TO reservas;

-- Passo 5: Recriar índices
CREATE INDEX IF NOT EXISTS idx_reservas_room_date ON reservas(room_id, date, status);
CREATE INDEX IF NOT EXISTS idx_reservas_organizer ON reservas(organizer_id);

-- Passo 6: Finalizar reservas já expiradas que ainda estejam como 'active'
UPDATE reservas
SET status = 'completed', updated_at = datetime('now')
WHERE status = 'active'
  AND (date || ' ' || end_time) <= datetime('now', 'localtime');
