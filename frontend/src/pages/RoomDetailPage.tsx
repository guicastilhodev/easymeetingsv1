import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import TimeSlotPicker from "../components/TimeSlotPicker";

interface Resource {
  id: number;
  room_id: number;
  type: string;
  name: string;
  quantity: number;
}

interface Room {
  id: number;
  name: string;
  capacity: number;
  location: string;
  is_active: boolean;
  resources: Resource[];
}

interface TimeSlot {
  start_time: string;
  end_time: string;
}

interface RoomSchedule {
  room_id: number;
  room_name: string;
  date: string;
  business_hours: { start: string; end: string };
  occupied: TimeSlot[];
  available: TimeSlot[];
}

/**
 * Página de detalhes de uma sala de reunião.
 * Exibe informações da sala, agenda do dia e permite navegar para reserva.
 */
export default function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const today = new Date().toISOString().split("T")[0];
  const [room, setRoom] = useState<Room | null>(null);
  const [schedule, setSchedule] = useState<RoomSchedule | null>(null);
  const [selectedDate, setSelectedDate] = useState(today);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (id) {
      loadRoom(id);
    }
  }, [id]);

  useEffect(() => {
    if (id && selectedDate) {
      loadSchedule(id, selectedDate);
    }
  }, [id, selectedDate]);

  async function loadRoom(roomId: string) {
    setLoadingRoom(true);
    setError("");
    try {
      const data = await apiGet<Room>(`/api/rooms/${roomId}`);
      setRoom(data);
    } catch (err: unknown) {
      const apiError = err as { detail?: string };
      setError(apiError?.detail || "Erro ao carregar dados da sala.");
    } finally {
      setLoadingRoom(false);
    }
  }

  async function loadSchedule(roomId: string, date: string) {
    setLoadingSchedule(true);
    try {
      const data = await apiGet<RoomSchedule>(`/api/rooms/${roomId}/schedule`, {
        date,
      });
      setSchedule(data);
    } catch (err: unknown) {
      const apiError = err as { detail?: string };
      setError(apiError?.detail || "Erro ao carregar agenda da sala.");
    } finally {
      setLoadingSchedule(false);
    }
  }

  function handleReserve() {
    navigate(`/reservations/new?room_id=${id}&date=${selectedDate}`);
  }

  if (loadingRoom) {
    return <p style={styles.loading}>Carregando dados da sala...</p>;
  }

  if (error && !room) {
    return (
      <p style={styles.error} role="alert">
        {error}
      </p>
    );
  }

  if (!room) {
    return <p style={styles.error}>Sala não encontrada.</p>;
  }

  return (
    <div>
      <button onClick={() => navigate("/rooms")} style={styles.backButton}>
        ← Voltar para Salas
      </button>

      <div style={styles.header}>
        <h1 style={styles.title}>{room.name}</h1>
        <div style={styles.infoGrid}>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>Capacidade</span>
            <span style={styles.infoValue}>{room.capacity} pessoas</span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>Localização</span>
            <span style={styles.infoValue}>{room.location}</span>
          </div>
        </div>

        {room.resources.length > 0 && (
          <div style={styles.resourcesSection}>
            <span style={styles.infoLabel}>Recursos disponíveis:</span>
            <div style={styles.resourcesList}>
              {room.resources.map((resource) => (
                <span key={resource.id} style={styles.resourceTag}>
                  {resource.name} ({resource.quantity}x)
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={styles.scheduleSection}>
        <div style={styles.scheduleHeader}>
          <h2 style={styles.scheduleTitle}>Agenda do Dia</h2>
          <div style={styles.datePickerRow}>
            <label htmlFor="schedule-date" style={styles.dateLabel}>
              Data:
            </label>
            <input
              id="schedule-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={styles.dateInput}
            />
          </div>
        </div>

        {loadingSchedule && <p style={styles.loading}>Carregando agenda...</p>}

        {!loadingSchedule && schedule && (
          <TimeSlotPicker
            businessHours={schedule.business_hours}
            occupied={schedule.occupied}
            available={schedule.available}
          />
        )}

        {error && schedule === null && !loadingSchedule && (
          <p style={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>

      <button onClick={handleReserve} style={styles.reserveButton}>
        Reservar
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loading: {
    fontSize: "0.9rem",
    color: "#888",
    textAlign: "center",
    padding: "2rem",
  },
  error: {
    color: "#d32f2f",
    fontSize: "0.875rem",
    padding: "0.75rem",
    backgroundColor: "#ffebee",
    borderRadius: "4px",
  },
  backButton: {
    background: "none",
    border: "none",
    color: "#00A693",
    fontSize: "0.9rem",
    cursor: "pointer",
    padding: "0.25rem 0",
    marginBottom: "1rem",
    fontWeight: 500,
  },
  header: {
    padding: "1.5rem",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    border: "1px solid #e0e0e0",
    marginBottom: "1.5rem",
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "#333",
    margin: "0 0 1rem 0",
  },
  infoGrid: {
    display: "flex",
    gap: "2rem",
    flexWrap: "wrap",
    marginBottom: "1rem",
  },
  infoItem: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  infoLabel: {
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  infoValue: {
    fontSize: "1rem",
    color: "#333",
  },
  resourcesSection: {
    marginTop: "0.75rem",
  },
  resourcesList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
    marginTop: "0.5rem",
  },
  resourceTag: {
    display: "inline-block",
    padding: "0.3rem 0.6rem",
    backgroundColor: "#e6f7f5",
    color: "#00A693",
    borderRadius: "4px",
    fontSize: "0.8rem",
    fontWeight: 500,
  },
  scheduleSection: {
    padding: "1.5rem",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    border: "1px solid #e0e0e0",
    marginBottom: "1.5rem",
  },
  scheduleHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "1rem",
    marginBottom: "1rem",
  },
  scheduleTitle: {
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "#333",
    margin: 0,
  },
  datePickerRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  dateLabel: {
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#555",
  },
  dateInput: {
    padding: "0.4rem 0.6rem",
    fontSize: "0.875rem",
    border: "1px solid #ccc",
    borderRadius: "4px",
    outline: "none",
  },
  reserveButton: {
    padding: "0.75rem 2rem",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#fff",
    backgroundColor: "#00A693",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
};
