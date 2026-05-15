import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPatch } from "../services/api";
import { getUserFromToken } from "../utils/auth";
import ReservationCard from "../components/ReservationCard";
import type { ReservationData } from "../components/ReservationCard";

const PAGE_SIZE = 50;

/**
 * Página de listagem de reservas do usuário (ou todas, para admin).
 * Exibe cards de reserva com paginação, permite cancelamento com confirmação.
 */
export default function ReservationsPage() {
  const navigate = useNavigate();
  const user = getUserFromToken();

  const [reservations, setReservations] = useState<ReservationData[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [cancelConfirmId, setCancelConfirmId] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchReservations = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<ReservationData[]>("/api/reservations", {
        page: String(pageNum),
      });
      setReservations(data);
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      setError("Erro ao carregar reservas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations(page);
  }, [page, fetchReservations]);

  function handleCardClick(id: number) {
    // Navegar para detalhes (pode ser expandido futuramente)
    const reservation = reservations.find((r) => r.id === id);
    if (reservation) {
      setCancelConfirmId(null);
      // Exibir detalhes inline ou navegar — por ora, não há rota de detalhe separada
    }
  }

  function handleCancelRequest(id: number) {
    setCancelConfirmId(id);
  }

  async function handleConfirmCancel() {
    if (cancelConfirmId === null) return;

    setCancelling(true);
    try {
      await apiPatch(`/api/reservations/${cancelConfirmId}/cancel`);
      // Atualizar a lista localmente
      setReservations((prev) =>
        prev.map((r) =>
          r.id === cancelConfirmId ? { ...r, status: "cancelled" } : r,
        ),
      );
      setCancelConfirmId(null);
    } catch (err: unknown) {
      const apiError = err as { detail?: string };
      setError(apiError?.detail || "Erro ao cancelar reserva.");
    } finally {
      setCancelling(false);
    }
  }

  function handleDismissCancel() {
    setCancelConfirmId(null);
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Reservas</h1>
        <button
          type="button"
          style={styles.newButton}
          onClick={() => navigate("/reservations/new")}
        >
          + Nova Reserva
        </button>
      </div>

      {error && (
        <p style={styles.errorText} role="alert">
          {error}
        </p>
      )}

      {/* Diálogo de confirmação de cancelamento */}
      {cancelConfirmId !== null && (
        <div
          style={styles.confirmDialog}
          role="alertdialog"
          aria-label="Confirmar cancelamento"
        >
          <p style={styles.confirmText}>
            Tem certeza que deseja cancelar esta reserva? Esta ação não pode ser
            desfeita.
          </p>
          <div style={styles.confirmButtons}>
            <button
              type="button"
              style={styles.confirmNoButton}
              onClick={handleDismissCancel}
              disabled={cancelling}
            >
              Não
            </button>
            <button
              type="button"
              style={styles.confirmYesButton}
              onClick={handleConfirmCancel}
              disabled={cancelling}
            >
              {cancelling ? "Cancelando..." : "Sim, cancelar"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={styles.loadingText}>Carregando reservas...</p>
      ) : reservations.length === 0 ? (
        <p style={styles.emptyText}>Nenhuma reserva encontrada.</p>
      ) : (
        <>
          <div style={styles.list}>
            {reservations.map((reservation) => (
              <ReservationCard
                key={reservation.id}
                reservation={reservation}
                currentUserId={user?.id ?? 0}
                onCancel={handleCancelRequest}
                onClick={handleCardClick}
              />
            ))}
          </div>

          {/* Paginação */}
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
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "800px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1.5rem",
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "#333",
    margin: 0,
  },
  newButton: {
    padding: "0.5rem 1rem",
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
  list: {
    display: "flex",
    flexDirection: "column" as const,
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
  confirmDialog: {
    backgroundColor: "#fff3e0",
    border: "1px solid #ff9800",
    borderRadius: "6px",
    padding: "1rem 1.25rem",
    marginBottom: "1rem",
  },
  confirmText: {
    margin: "0 0 0.75rem",
    fontSize: "0.9rem",
    color: "#e65100",
  },
  confirmButtons: {
    display: "flex",
    gap: "0.75rem",
    justifyContent: "flex-end",
  },
  confirmNoButton: {
    padding: "0.375rem 0.75rem",
    fontSize: "0.85rem",
    fontWeight: 500,
    color: "#555",
    backgroundColor: "#f5f5f5",
    border: "1px solid #ccc",
    borderRadius: "4px",
    cursor: "pointer",
  },
  confirmYesButton: {
    padding: "0.375rem 0.75rem",
    fontSize: "0.85rem",
    fontWeight: 500,
    color: "#fff",
    backgroundColor: "#c62828",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
};
