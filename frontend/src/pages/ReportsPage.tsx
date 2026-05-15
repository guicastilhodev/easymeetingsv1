import { useState, useEffect, useCallback } from "react";
import { apiGet } from "../services/api";
import { getToken } from "../utils/auth";

// --- Types ---

interface RoomOption {
  id: number;
  name: string;
}

interface ByRoomItem {
  room_name: string;
  count: number;
}

interface ByUserItem {
  user_name: string;
  count: number;
}

interface ReportData {
  total_reservations: number;
  by_room: ByRoomItem[];
  by_user: ByUserItem[];
  occupancy_rate: number;
  period: {
    start_date: string;
    end_date: string;
  };
  room_id?: number;
}

// --- Component ---

export default function ReportsPage() {
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [roomId, setRoomId] = useState("");
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  // Fetch rooms for the filter dropdown
  const fetchRooms = useCallback(async () => {
    try {
      const data = await apiGet<RoomOption[]>("/api/rooms");
      setRooms(data);
    } catch {
      // Silently fail — dropdown will just be empty
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // --- Validation ---

  function validateForm(): string | null {
    if (!startDate || !endDate) {
      return "Informe a data de início e a data de fim do período.";
    }

    if (startDate > endDate) {
      return "Período inválido. A data de início deve ser anterior ou igual à data de fim.";
    }

    return null;
  }

  // --- Generate Report ---

  async function handleGenerateReport(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setReport(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const params: Record<string, string> = {
        start_date: startDate,
        end_date: endDate,
      };

      if (roomId) {
        params.room_id = roomId;
      }

      const data = await apiGet<ReportData>(
        "/api/reports/reservations",
        params,
      );
      setReport(data);
    } catch (err: unknown) {
      const apiError = err as { detail?: string };
      setError(apiError?.detail || "Erro ao gerar relatório. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  // --- Export CSV ---

  async function handleExportCsv() {
    if (!startDate || !endDate) return;

    setExporting(true);

    try {
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });

      if (roomId) {
        params.set("room_id", roomId);
      }

      const token = getToken();
      const response = await fetch(
        `${baseUrl}/api/reports/reservations/export?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          detail: "Erro ao exportar relatório.",
        }));
        throw errorData;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `relatorio_reservas_${startDate}_${endDate}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const apiError = err as { detail?: string };
      setError(apiError?.detail || "Erro ao exportar CSV. Tente novamente.");
    } finally {
      setExporting(false);
    }
  }

  // --- Render ---

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Relatórios de Reservas</h1>

      {/* Filter Form */}
      <form onSubmit={handleGenerateReport} style={styles.filterForm}>
        <div style={styles.filterRow}>
          <div style={styles.field}>
            <label htmlFor="report-start-date" style={styles.label}>
              Data Início
            </label>
            <input
              id="report-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.field}>
            <label htmlFor="report-end-date" style={styles.label}>
              Data Fim
            </label>
            <input
              id="report-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.field}>
            <label htmlFor="report-room" style={styles.label}>
              Sala
            </label>
            <select
              id="report-room"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              style={styles.input}
            >
              <option value="">Todas as salas</option>
              {rooms.map((room) => (
                <option key={room.id} value={String(room.id)}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.fieldButton}>
            <button
              type="submit"
              style={styles.primaryButton}
              disabled={loading}
            >
              {loading ? "Gerando..." : "Gerar Relatório"}
            </button>
          </div>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <p style={styles.errorMessage} role="alert">
          {error}
        </p>
      )}

      {/* Report Results */}
      {report && (
        <div style={styles.reportSection}>
          {/* Summary Cards */}
          <div style={styles.summaryRow}>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Total de Reservas</span>
              <span style={styles.summaryValue}>
                {report.total_reservations}
              </span>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Taxa de Ocupação</span>
              <span style={styles.summaryValue}>
                {report.occupancy_rate.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Empty state */}
          {report.total_reservations === 0 && (
            <p style={styles.emptyMessage}>Nenhuma reserva no período.</p>
          )}

          {/* By Room Table */}
          {report.by_room.length > 0 && (
            <div style={styles.tableSection}>
              <h2 style={styles.sectionTitle}>Reservas por Sala</h2>
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Sala</th>
                      <th style={styles.th}>Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.by_room.map((item) => (
                      <tr key={item.room_name} style={styles.tr}>
                        <td style={styles.td}>{item.room_name}</td>
                        <td style={styles.td}>{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* By User Table */}
          {report.by_user.length > 0 && (
            <div style={styles.tableSection}>
              <h2 style={styles.sectionTitle}>Reservas por Usuário</h2>
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Usuário</th>
                      <th style={styles.th}>Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.by_user.map((item) => (
                      <tr key={item.user_name} style={styles.tr}>
                        <td style={styles.td}>{item.user_name}</td>
                        <td style={styles.td}>{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Export Button */}
          <div style={styles.exportRow}>
            <button
              type="button"
              style={styles.exportButton}
              onClick={handleExportCsv}
              disabled={exporting}
            >
              {exporting ? "Exportando..." : "Exportar CSV"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Styles ---

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "1100px",
    margin: "0 auto",
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "#333",
    marginBottom: "1.5rem",
  },
  filterForm: {
    backgroundColor: "#f9f9f9",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    padding: "1.25rem",
    marginBottom: "1.5rem",
  },
  filterRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "1rem",
    alignItems: "flex-end",
  },
  field: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.3rem",
    minWidth: "160px",
  },
  fieldButton: {
    display: "flex",
    alignItems: "flex-end",
  },
  label: {
    fontSize: "0.85rem",
    fontWeight: 500,
    color: "#333",
  },
  input: {
    padding: "0.5rem 0.75rem",
    fontSize: "0.95rem",
    border: "1px solid #ccc",
    borderRadius: "4px",
    outline: "none",
  },
  primaryButton: {
    padding: "0.5rem 1.25rem",
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "#fff",
    backgroundColor: "#00A693",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  errorMessage: {
    color: "#d32f2f",
    backgroundColor: "#fdecea",
    padding: "0.75rem 1rem",
    borderRadius: "4px",
    marginBottom: "1rem",
    fontSize: "0.9rem",
  },
  reportSection: {
    marginTop: "0.5rem",
  },
  summaryRow: {
    display: "flex",
    gap: "1.5rem",
    marginBottom: "1.5rem",
    flexWrap: "wrap" as const,
  },
  summaryCard: {
    display: "flex",
    flexDirection: "column" as const,
    backgroundColor: "#fff",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    padding: "1.25rem 1.5rem",
    minWidth: "180px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  summaryLabel: {
    fontSize: "0.85rem",
    fontWeight: 500,
    color: "#666",
    marginBottom: "0.25rem",
  },
  summaryValue: {
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "#333",
  },
  emptyMessage: {
    textAlign: "center" as const,
    color: "#888",
    padding: "1.5rem 0",
    fontSize: "0.95rem",
  },
  tableSection: {
    marginBottom: "1.5rem",
  },
  sectionTitle: {
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "#333",
    marginBottom: "0.75rem",
  },
  tableWrapper: {
    overflowX: "auto" as const,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    backgroundColor: "#fff",
    borderRadius: "8px",
    overflow: "hidden",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  th: {
    textAlign: "left" as const,
    padding: "0.75rem 1rem",
    backgroundColor: "#f5f7fa",
    fontWeight: 600,
    fontSize: "0.85rem",
    color: "#555",
    borderBottom: "1px solid #e0e0e0",
  },
  tr: {
    borderBottom: "1px solid #f0f0f0",
  },
  td: {
    padding: "0.75rem 1rem",
    fontSize: "0.9rem",
    color: "#333",
  },
  exportRow: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "1rem",
  },
  exportButton: {
    padding: "0.5rem 1.25rem",
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "#00A693",
    backgroundColor: "#fff",
    border: "1px solid #00A693",
    borderRadius: "4px",
    cursor: "pointer",
  },
};
