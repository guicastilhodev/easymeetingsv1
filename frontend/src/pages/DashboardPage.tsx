import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../services/api";
import { getUserFromToken } from "../utils/auth";
import DataTable from "../components/DataTable";
import type { Column } from "../components/DataTable";
import type { CSSProperties } from "react";

interface ReservationResponse {
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
  room_resources: {
    id: number;
    room_id: number;
    type: string;
    name: string;
    quantity: number;
  }[];
}

interface RoomResponse {
  id: number;
  name: string;
  capacity: number;
  location: string;
  is_active: boolean;
  resources: {
    id: number;
    room_id: number;
    type: string;
    name: string;
    quantity: number;
  }[];
}

/**
 * Página principal (Dashboard) com visão geral:
 * - Reservas do dia do usuário (ou todas para admin)
 * - Salas disponíveis no momento
 * - Botões de ação rápida
 */
export default function DashboardPage() {
  const [todayReservations, setTodayReservations] = useState<
    ReservationResponse[]
  >([]);
  const [availableRooms, setAvailableRooms] = useState<RoomResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const user = getUserFromToken();
  const userName = user?.login ?? "";

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      try {
        const today = new Date().toISOString().split("T")[0];
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

        // Buscar reservas do usuário (admin vê todas)
        const reservationsData = await apiGet<ReservationResponse[]>(
          "/api/reservations",
          { page: "1" },
        );

        // Filtrar apenas reservas de hoje (ativas ou finalizadas)
        const todayActive = reservationsData.filter(
          (r) =>
            r.date === today &&
            (r.status === "active" || r.status === "completed"),
        );
        setTodayReservations(todayActive);

        // Buscar salas disponíveis agora
        // Usa o horário atual até a próxima hora cheia (slot de 1h)
        const businessEnd = "18:00";
        if (currentTime < businessEnd) {
          // Calcula o fim do próximo slot de 1 hora
          const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
          const nextHourTime = `${String(nextHour.getHours()).padStart(2, "0")}:${String(nextHour.getMinutes()).padStart(2, "0")}`;
          const slotEnd =
            nextHourTime > businessEnd ? businessEnd : nextHourTime;

          const rooms = await apiGet<RoomResponse[]>("/api/rooms/available", {
            date: today,
            start_time: currentTime,
            end_time: slotEnd,
          });
          setAvailableRooms(rooms);
        } else {
          setAvailableRooms([]);
        }
      } catch {
        // Erros de API são tratados pelo interceptor global (401 → redirect)
        setTodayReservations([]);
        setAvailableRooms([]);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const reservationColumns: Column<Record<string, unknown>>[] = [
    { key: "room_name", header: "Sala" },
    {
      key: "time",
      header: "Horário",
      render: (row) => `${row["start_time"]} - ${row["end_time"]}`,
    },
    {
      key: "participants",
      header: "Participantes",
      render: (row) => {
        const participants = row["participants"] as string[];
        return String(participants.length);
      },
    },
    {
      key: "status",
      header: "Status",
      render: (row) => {
        const status = row["status"] as string;
        const label =
          status === "active"
            ? "Ativa"
            : status === "completed"
              ? "Finalizada"
              : "Cancelada";
        const color =
          status === "active"
            ? "#2e7d32"
            : status === "completed"
              ? "#1565c0"
              : "#c62828";
        const bg =
          status === "active"
            ? "#e8f5e9"
            : status === "completed"
              ? "#e3f2fd"
              : "#fbe9e7";
        return (
          <span
            style={{
              padding: "0.2rem 0.5rem",
              borderRadius: "10px",
              fontSize: "0.75rem",
              fontWeight: 600,
              backgroundColor: bg,
              color,
            }}
          >
            {label}
          </span>
        );
      },
    },
  ];

  const roomColumns: Column<Record<string, unknown>>[] = [
    { key: "name", header: "Nome" },
    {
      key: "capacity",
      header: "Capacidade",
      render: (row) => `${row["capacity"]} pessoas`,
    },
    { key: "location", header: "Localização" },
  ];

  if (loading) {
    return (
      <div style={styles.container}>
        <p style={styles.loadingText}>Carregando...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.welcome}>
        {userName ? `Bem-vindo(a), ${userName}!` : "Bem-vindo(a)!"}
      </h1>

      {/* Botões de ação rápida */}
      <div style={styles.quickActions}>
        <Link to="/reservations/new" style={styles.actionButton}>
          Nova Reserva
        </Link>
        <Link to="/rooms" style={styles.actionButtonSecondary}>
          Buscar Salas
        </Link>
      </div>

      {/* Seção: Reservas de Hoje */}
      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Reservas de Hoje</h2>
          <Link to="/reservations" style={styles.seeAllLink}>
            Ver todas →
          </Link>
        </div>

        {todayReservations.length === 0 ? (
          <p style={styles.emptyMessage}>Nenhuma reserva para hoje.</p>
        ) : (
          <DataTable
            columns={reservationColumns}
            rows={todayReservations as unknown as Record<string, unknown>[]}
          />
        )}
      </section>

      {/* Seção: Salas Disponíveis Agora */}
      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Salas Disponíveis (próxima hora)</h2>
          <Link to="/rooms" style={styles.seeAllLink}>
            Ver todas →
          </Link>
        </div>

        {availableRooms.length === 0 ? (
          <p style={styles.emptyMessage}>Nenhuma sala disponível no momento.</p>
        ) : (
          <DataTable
            columns={roomColumns}
            rows={availableRooms as unknown as Record<string, unknown>[]}
          />
        )}
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    maxWidth: "960px",
    margin: "0 auto",
  },
  welcome: {
    fontSize: "1.5rem",
    fontWeight: 600,
    color: "#333",
    marginBottom: "1rem",
  },
  loadingText: {
    textAlign: "center",
    color: "#888",
    padding: "2rem 0",
  },
  quickActions: {
    display: "flex",
    gap: "0.75rem",
    marginBottom: "2rem",
    flexWrap: "wrap",
  },
  actionButton: {
    display: "inline-block",
    padding: "0.625rem 1.25rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#fff",
    backgroundColor: "#00A693",
    borderRadius: "6px",
    textDecoration: "none",
    transition: "background-color 0.2s",
  },
  actionButtonSecondary: {
    display: "inline-block",
    padding: "0.625rem 1.25rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#00A693",
    backgroundColor: "#e6f7f5",
    borderRadius: "6px",
    textDecoration: "none",
    transition: "background-color 0.2s",
  },
  section: {
    marginBottom: "2rem",
    backgroundColor: "#fff",
    borderRadius: "8px",
    border: "1px solid #e0e0e0",
    padding: "1.25rem",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
  },
  sectionTitle: {
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "#333",
    margin: 0,
  },
  seeAllLink: {
    fontSize: "0.85rem",
    color: "#00A693",
    textDecoration: "none",
    fontWeight: 500,
  },
  emptyMessage: {
    textAlign: "center",
    color: "#888",
    padding: "1.5rem 0",
    fontSize: "0.9rem",
    margin: 0,
  },
};
