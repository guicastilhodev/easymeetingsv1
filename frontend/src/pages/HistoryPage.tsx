import { useState, useEffect, useCallback } from "react";
import { apiGet } from "../services/api";
import { getUserFromToken } from "../utils/auth";

const PAGE_SIZE = 50;

interface HistoryItem {
  id: number;
  room_id: number;
  room_name: string;
  organizer_id: number;
  organizer_name: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  participants: string[];
}

interface HistoryResponse {
  data: HistoryItem[];
  page: number;
  page_size: number;
}

interface Room {
  id: number;
  name: string;
}

interface User {
  id: number;
  name: string;
}

/**
 * Página de histórico de reservas com filtros combinados e paginação.
 * Exibe reservas passadas ou canceladas com filtros por período, sala e organizador.
 */
export default function HistoryPage() {
  const user = getUserFromToken();
  const isAdmin = user?.role === "admin";

  // Filter state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [roomId, setRoomId] = useState("");
  const [organizerId, setOrganizerId] = useState("");

  // Dropdown options
  const [rooms, setRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Data state
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [searched, setSearched] = useState(false);

  // Load dropdown options on mount
  useEffect(() => {
    async function loadOptions() {
      try {
        const roomsData = await apiGet<Room[]>("/api/rooms");
        setRooms(roomsData);
      } catch {
        // Silently fail — rooms dropdown will be empty
      }

      if (isAdmin) {
        try {
          const usersData = await apiGet<User[]>("/api/users");
          setUsers(usersData);
        } catch {
          // Silently fail — users dropdown will be empty
        }
      }
    }
    loadOptions();
  }, [isAdmin]);

  const fetchHistory = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      setError("");
      try {
        const params: Record<string, string> = {
          page: String(pageNum),
        };
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
        if (roomId) params.room_id = roomId;
        if (organizerId && isAdmin) params.organizer_id = organizerId;

        const response = await apiGet<HistoryResponse>("/api/history", params);
        setHistory(response.data);
        setHasMore(response.data.length === PAGE_SIZE);
        setSearched(true);
      } catch (err: unknown) {
        const apiError = err as { detail?: string };
        setError(apiError?.detail || "Erro ao carregar histórico.");
        setHistory([]);
      } finally {
        setLoading(false);
      }
    },
    [startDate, endDate, roomId, organizerId, isAdmin],
  );

  // Fetch on page change (only if already searched)
  useEffect(() => {
    if (searched) {
      fetchHistory(page);
    }
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load initial data on mount
  useEffect(() => {
    fetchHistory(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    fetchHistory(1);
  }

  function formatStatus(status: string): string {
    if (status === "cancelled") return "Cancelada";
    return "Ativa";
  }

  function getStatusStyle(status: string): React.CSSProperties {
    if (status === "cancelled") {
      return {
        ...styles.badge,
        backgroundColor: "#ffebee",
        color: "#c62828",
      };
    }
    return {
      ...styles.badge,
      backgroundColor: "#e8f5e9",
      color: "#2e7d32",
    };
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Histórico de Reservas</h1>

      {/* Filter Panel */}
      <form onSubmit={handleFilter} style={styles.filterPanel}>
        <div style={styles.fieldsRow}>
          <div style={styles.field}>
            <label htmlFor="history-start-date" style={styles.label}>
              Data Início
            </label>
            <input
              id="history-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={styles.input}
              disabled={loading}
            />
          </div>

          <div style={styles.field}>
            <label htmlFor="history-end-date" style={styles.label}>
              Data Fim
            </label>
            <input
              id="history-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={styles.input}
              disabled={loading}
            />
          </div>

          <div style={styles.field}>
            <label htmlFor="history-room" style={styles.label}>
              Sala
            </label>
            <select
              id="history-room"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              style={styles.input}
              disabled={loading}
            >
              <option value="">Todas</option>
              {rooms.map((room) => (
                <option key={room.id} value={String(room.id)}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>

          {isAdmin && (
            <div style={styles.field}>
              <label htmlFor="history-organizer" style={styles.label}>
                Organizador
              </label>
              <select
                id="history-organizer"
                value={organizerId}
                onChange={(e) => setOrganizerId(e.target.value)}
                style={styles.input}
                disabled={loading}
              >
                <option value="">Todos</option>
                {users.map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <button type="submit" style={styles.filterButton} disabled={loading}>
          {loading ? "Filtrando..." : "Filtrar"}
        </button>
      </form>

      {/* Error message */}
      {error && (
        <p style={styles.errorText} role="alert">
          {error}
        </p>
      )}

      {/* Results */}
      {loading ? (
        <p style={styles.loadingText}>Carregando histórico...</p>
      ) : history.length === 0 && searched ? (
        <p style={styles.emptyText}>Nenhum resultado encontrado.</p>
      ) : history.length > 0 ? (
        <>
          {/* Table */}
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Data</th>
                  <th style={styles.th}>Sala</th>
                  <th style={styles.th}>Organizador</th>
                  <th style={styles.th}>Horário</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Participantes</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} style={styles.tr}>
                    <td style={styles.td}>{item.date}</td>
                    <td style={styles.td}>{item.room_name}</td>
                    <td style={styles.td}>{item.organizer_name}</td>
                    <td style={styles.td}>
                      {item.start_time} - {item.end_time}
                    </td>
                    <td style={styles.td}>
                      <span style={getStatusStyle(item.status)}>
                        {formatStatus(item.status)}
                      </span>
                    </td>
                    <td style={styles.td}>{item.participants.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={styles.pagination}>
            <button
              type="button"
              style={styles.pageButton}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              ← Anterior
            </button>
            <span style={styles.pageInfo}>Página {page}</span>
            <button
              type="button"
              style={styles.pageButton}
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
            >
              Próxima →
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "1000px",
    margin: "0 auto",
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "#333",
    marginBottom: "1.5rem",
  },
  filterPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    padding: "1.25rem",
    backgroundColor: "#f8f9fa",
    borderRadius: "8px",
    border: "1px solid #e0e0e0",
    marginBottom: "1.5rem",
  },
  fieldsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "1rem",
    alignItems: "flex-end",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "0.375rem",
    minWidth: "160px",
  },
  label: {
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#333",
  },
  input: {
    padding: "0.5rem 0.75rem",
    fontSize: "0.9rem",
    border: "1px solid #ccc",
    borderRadius: "4px",
    outline: "none",
  },
  filterButton: {
    alignSelf: "flex-start",
    padding: "0.625rem 1.5rem",
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "#fff",
    backgroundColor: "#00A693",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  errorText: {
    color: "#d32f2f",
    fontSize: "0.875rem",
    marginBottom: "0.75rem",
    padding: "0.75rem",
    backgroundColor: "#ffebee",
    borderRadius: "4px",
  },
  loadingText: {
    fontSize: "0.9rem",
    color: "#666",
    textAlign: "center" as const,
    marginTop: "2rem",
  },
  emptyText: {
    fontSize: "0.9rem",
    color: "#666",
    textAlign: "center" as const,
    marginTop: "2rem",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "0.875rem",
  },
  th: {
    textAlign: "left" as const,
    padding: "0.75rem 0.5rem",
    borderBottom: "2px solid #e0e0e0",
    fontWeight: 600,
    color: "#333",
    whiteSpace: "nowrap",
  },
  tr: {
    borderBottom: "1px solid #f0f0f0",
  },
  td: {
    padding: "0.75rem 0.5rem",
    color: "#555",
    whiteSpace: "nowrap",
  },
  badge: {
    display: "inline-block",
    padding: "0.25rem 0.5rem",
    borderRadius: "12px",
    fontSize: "0.75rem",
    fontWeight: 600,
  },
  pagination: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "1rem",
    marginTop: "1.5rem",
  },
  pageButton: {
    padding: "0.5rem 1rem",
    fontSize: "0.85rem",
    fontWeight: 500,
    color: "#00A693",
    backgroundColor: "#fff",
    border: "1px solid #00A693",
    borderRadius: "4px",
    cursor: "pointer",
  },
  pageInfo: {
    fontSize: "0.875rem",
    color: "#555",
  },
};
