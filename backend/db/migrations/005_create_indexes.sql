-- Migration 005: Criar índices para otimização de consultas
-- Índices definidos no design document

CREATE INDEX IF NOT EXISTS idx_reservas_room_date ON reservas(room_id, date, status);
CREATE INDEX IF NOT EXISTS idx_reservas_organizer ON reservas(organizer_id);
CREATE INDEX IF NOT EXISTS idx_recursos_room ON recursos(room_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_login ON usuarios(login);
