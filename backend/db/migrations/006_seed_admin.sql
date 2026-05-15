-- Migration 006: Seed - Criar usuário administrador padrão
-- Login: admin / Senha: admin123 (apenas para POC)
-- Hash gerado com bcrypt

INSERT OR IGNORE INTO usuarios (name, login, password_hash, role, is_active)
VALUES (
    'Administrador',
    'admin',
    '$2b$12$RzaaVOhp3A5ilOsDxXYRluT052a/e1dCKSvAua2OMpeU1p34XHxeq',
    'admin',
    1
);
