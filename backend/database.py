"""
Módulo de conexão e helpers para o banco de dados SQLite.
Fornece funções utilitárias para execução de queries e inicialização do banco.
"""

import os
import sqlite3
from pathlib import Path
from typing import Any, Optional

# Caminho do arquivo do banco de dados
DATABASE_PATH = os.environ.get(
    "DATABASE_PATH",
    str(Path(__file__).parent / "db" / "easymeetings.db"),
)

# Diretório das migrations SQL
MIGRATIONS_DIR = Path(__file__).parent / "db" / "migrations"


def get_connection() -> sqlite3.Connection:
    """
    Cria e retorna uma conexão com o banco SQLite.
    Habilita foreign keys e configura row_factory para retornar dicts.
    """
    conn = sqlite3.connect(DATABASE_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    return conn


def execute(query: str, params: tuple | list = ()) -> int:
    """
    Executa uma query de escrita (INSERT, UPDATE, DELETE).
    Retorna o lastrowid para INSERTs ou rowcount para UPDATE/DELETE.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(query, params)
        conn.commit()
        return cursor.lastrowid if cursor.lastrowid else cursor.rowcount
    finally:
        conn.close()


def fetch_one(query: str, params: tuple | list = ()) -> Optional[dict[str, Any]]:
    """
    Executa uma query e retorna a primeira linha como dicionário.
    Retorna None se nenhum resultado for encontrado.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(query, params)
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def fetch_all(query: str, params: tuple | list = ()) -> list[dict[str, Any]]:
    """
    Executa uma query e retorna todas as linhas como lista de dicionários.
    Retorna lista vazia se nenhum resultado for encontrado.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def execute_script(sql: str) -> None:
    """Executa um script SQL completo (múltiplas statements)."""
    conn = get_connection()
    try:
        conn.executescript(sql)
        conn.commit()
    finally:
        conn.close()


def initialize_database() -> None:
    """
    Inicializa o banco de dados executando todas as migrations SQL
    em ordem sequencial. Cria o diretório do banco se não existir.
    Utiliza uma tabela de controle para evitar re-execução de migrations.
    """
    # Garante que o diretório do banco existe
    db_dir = Path(DATABASE_PATH).parent
    db_dir.mkdir(parents=True, exist_ok=True)

    conn = get_connection()
    try:
        # Cria tabela de controle de migrations
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS _migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL UNIQUE,
                applied_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """
        )
        conn.commit()

        # Busca migrations já aplicadas
        cursor = conn.cursor()
        cursor.execute("SELECT filename FROM _migrations")
        applied = {row["filename"] for row in cursor.fetchall()}

        # Executa migrations pendentes em ordem
        if not MIGRATIONS_DIR.exists():
            MIGRATIONS_DIR.mkdir(parents=True, exist_ok=True)
            return

        migration_files = sorted(
            f
            for f in MIGRATIONS_DIR.iterdir()
            if f.suffix == ".sql" and f.name not in applied
        )

        for migration_file in migration_files:
            sql = migration_file.read_text(encoding="utf-8")
            conn.executescript(sql)
            conn.execute(
                "INSERT INTO _migrations (filename) VALUES (?)",
                (migration_file.name,),
            )
            conn.commit()
    finally:
        conn.close()
