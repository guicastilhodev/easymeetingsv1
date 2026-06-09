import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet, apiPut } from "../services/api";
import { getUserFromToken } from "../utils/auth";
import TimeSlotPicker from "../components/TimeSlotPicker";
import ParticipantsList from "../components/ParticipantsList";

interface RoomOption {
  id: number;
  name: string;
  capacity: number;
  location: string;
  is_active: boolean;
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

interface ReservationData {
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

interface FormErrors {
  room_id?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  participants?: string;
  general?: string;
}

/**
 * Página de edição de uma reserva existente.
 * Carrega os dados atuais e permite alterar sala, data, horário e participantes.
 * Apenas o organizador pode editar. Valida período e participantes antes de enviar.
 */
export default function ReservationEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = getUserFromToken();

  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [roomId, setRoomId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [participants, setParticipants] = useState<string[]>([""]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [conflictError, setConflictError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [schedule, setSchedule] = useState<RoomSchedule | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // Carrega salas e dados da reserva em paralelo
  useEffect(() => {
    async function loadInitialData() {
      setLoadingData(true);
      try {
        const [roomsData, reservation] = await Promise.all([
          apiGet<RoomOption[]>("/api/rooms"),
          apiGet<ReservationData>(`/api/reservations/${id}`),
        ]);

        const activeRooms = roomsData.filter((r) => r.is_active);
        setRooms(activeRooms);

        // Redireciona se não for o organizador
        if (
          currentUser &&
          reservation.organizer_id !== currentUser.id &&
          currentUser.role !== "admin"
        ) {
          navigate("/reservations");
          return;
        }

        // Redireciona se a reserva não estiver ativa
        if (reservation.status !== "active") {
          navigate("/reservations");
          return;
        }

        // Pré-preenche o formulário com os dados existentes
        setRoomId(String(reservation.room_id));
        setDate(reservation.date);
        setStartTime(reservation.start_time);
        setEndTime(reservation.end_time);
        setParticipants(
          reservation.participants.length > 0 ? reservation.participants : [""],
        );
      } catch {
        setErrors({ general: "Erro ao carregar dados da reserva." });
      } finally {
        setLoadingData(false);
      }
    }

    if (id) {
      loadInitialData();
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Busca a agenda da sala quando sala e data estão preenchidos
  useEffect(() => {
    if (!roomId || !date) {
      setSchedule(null);
      return;
    }

    async function fetchSchedule() {
      setLoadingSchedule(true);
      try {
        const data = await apiGet<RoomSchedule>(
          `/api/rooms/${roomId}/schedule`,
          { date },
        );
        setSchedule(data);
      } catch {
        setSchedule(null);
      } finally {
        setLoadingSchedule(false);
      }
    }
    fetchSchedule();
  }, [roomId, date]);

  function parseParticipants(list: string[]): string[] {
    return list.map((p) => p.trim()).filter((p) => p.length > 0);
  }

  function validate(): FormErrors {
    const newErrors: FormErrors = {};

    if (!roomId) newErrors.room_id = "Selecione uma sala.";
    if (!date) newErrors.date = "Informe a data.";
    if (!startTime) newErrors.start_time = "Informe a hora de início.";
    if (!endTime) newErrors.end_time = "Informe a hora de fim.";

    if (startTime && endTime) {
      if (endTime <= startTime) {
        newErrors.end_time =
          "A hora de fim deve ser posterior à hora de início.";
      } else {
        const [startH, startM] = startTime.split(":").map(Number);
        const [endH, endM] = endTime.split(":").map(Number);
        const durationMinutes = endH * 60 + endM - (startH * 60 + startM);
        if (durationMinutes < 15) {
          newErrors.end_time = "A duração mínima da reserva é de 15 minutos.";
        }
      }
    }

    const parsed = parseParticipants(participants);
    if (parsed.length === 0) {
      newErrors.participants = "Informe pelo menos 1 participante.";
    } else if (parsed.length > 50) {
      newErrors.participants = "O máximo é de 50 participantes.";
    } else if (roomId) {
      const selectedRoom = rooms.find((r) => r.id === Number(roomId));
      if (selectedRoom && parsed.length > selectedRoom.capacity) {
        newErrors.participants = `Número de participantes (${parsed.length}) excede a capacidade da sala (${selectedRoom.capacity}).`;
      }
    }

    return newErrors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setConflictError("");
    setErrors({});

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);

    try {
      await apiPut(`/api/reservations/${id}`, {
        room_id: Number(roomId),
        date,
        start_time: startTime,
        end_time: endTime,
        participants: parseParticipants(participants),
      });
      navigate("/reservations");
    } catch (err: unknown) {
      const apiError = err as { detail?: string };
      if (
        apiError?.detail?.toLowerCase().includes("conflito") ||
        apiError?.detail?.toLowerCase().includes("conflict")
      ) {
        setConflictError(apiError.detail || "Conflito de horário detectado.");
      } else if (apiError?.detail) {
        setErrors({ general: apiError.detail });
      } else {
        setErrors({ general: "Erro inesperado ao editar reserva." });
      }
    } finally {
      setLoading(false);
    }
  }

  if (loadingData) {
    return (
      <div style={styles.container}>
        <p style={styles.loadingText}>Carregando reserva...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Editar Reserva</h1>

      {conflictError && (
        <div style={styles.conflictAlert} role="alert">
          <strong>⚠️ Conflito de Horário</strong>
          <p style={{ margin: "0.25rem 0 0" }}>{conflictError}</p>
        </div>
      )}

      {errors.general && (
        <p style={styles.errorText} role="alert">
          {errors.general}
        </p>
      )}

      <form onSubmit={handleSubmit} style={styles.form}>
        {/* Sala */}
        <div style={styles.field}>
          <label htmlFor="room_id" style={styles.label}>
            Sala
          </label>
          <select
            id="room_id"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            style={styles.input}
            disabled={loading}
          >
            <option value="">Selecione uma sala</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} (Cap: {room.capacity} — {room.location})
              </option>
            ))}
          </select>
          {errors.room_id && (
            <span style={styles.fieldError}>{errors.room_id}</span>
          )}
        </div>

        {/* Data */}
        <div style={styles.field}>
          <label htmlFor="date" style={styles.label}>
            Data
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={styles.input}
            disabled={loading}
          />
          {errors.date && <span style={styles.fieldError}>{errors.date}</span>}
        </div>

        {/* Cronograma da sala */}
        {roomId && date && (
          <div style={styles.scheduleSection}>
            <span style={styles.scheduleLabel}>Agenda da sala no dia:</span>
            {loadingSchedule ? (
              <p style={styles.loadingText}>Carregando agenda...</p>
            ) : schedule ? (
              <TimeSlotPicker
                businessHours={schedule.business_hours}
                occupied={schedule.occupied}
                available={schedule.available}
              />
            ) : (
              <p style={styles.loadingText}>
                Não foi possível carregar a agenda.
              </p>
            )}
          </div>
        )}

        {/* Horários */}
        <div style={styles.timeRow}>
          <div style={styles.field}>
            <label htmlFor="start_time" style={styles.label}>
              Hora Início
            </label>
            <input
              id="start_time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              style={styles.input}
              disabled={loading}
            />
            {errors.start_time && (
              <span style={styles.fieldError}>{errors.start_time}</span>
            )}
          </div>
          <div style={styles.field}>
            <label htmlFor="end_time" style={styles.label}>
              Hora Fim
            </label>
            <input
              id="end_time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              style={styles.input}
              disabled={loading}
            />
            {errors.end_time && (
              <span style={styles.fieldError}>{errors.end_time}</span>
            )}
          </div>
        </div>

        {/* Participantes */}
        <ParticipantsList
          participants={participants}
          onChange={setParticipants}
          error={errors.participants}
          disabled={loading}
          maxParticipants={
            roomId
              ? (rooms.find((r) => r.id === Number(roomId))?.capacity ?? 50)
              : 50
          }
        />

        {/* Botões */}
        <div style={styles.buttonRow}>
          <button
            type="button"
            style={styles.cancelButton}
            onClick={() => navigate("/reservations")}
            disabled={loading}
          >
            Voltar
          </button>
          <button type="submit" style={styles.submitButton} disabled={loading}>
            {loading ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "600px",
    margin: "0 auto",
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "#333",
    marginBottom: "1.5rem",
  },
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1.25rem",
  },
  field: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.375rem",
    flex: 1,
  },
  label: {
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#333",
  },
  input: {
    padding: "0.625rem 0.75rem",
    fontSize: "1rem",
    border: "1px solid #ccc",
    borderRadius: "4px",
    outline: "none",
  },
  timeRow: {
    display: "flex",
    gap: "1rem",
  },
  fieldError: {
    fontSize: "0.8rem",
    color: "#d32f2f",
  },
  errorText: {
    color: "#d32f2f",
    fontSize: "0.875rem",
    marginBottom: "0.5rem",
  },
  conflictAlert: {
    backgroundColor: "#fff3e0",
    border: "1px solid #ff9800",
    borderRadius: "6px",
    padding: "0.75rem 1rem",
    marginBottom: "1rem",
    color: "#e65100",
    fontSize: "0.9rem",
  },
  buttonRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "1rem",
    marginTop: "0.5rem",
  },
  cancelButton: {
    padding: "0.625rem 1.25rem",
    fontSize: "0.9rem",
    fontWeight: 500,
    color: "#555",
    backgroundColor: "#f5f5f5",
    border: "1px solid #ccc",
    borderRadius: "4px",
    cursor: "pointer",
  },
  submitButton: {
    padding: "0.625rem 1.25rem",
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "#fff",
    backgroundColor: "#00A693",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  loadingText: {
    fontSize: "0.875rem",
    color: "#666",
    margin: 0,
  },
  scheduleSection: {
    padding: "1rem",
    backgroundColor: "#f8f9fa",
    borderRadius: "6px",
    border: "1px solid #e0e0e0",
  },
  scheduleLabel: {
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "#555",
    display: "block",
    marginBottom: "0.5rem",
  },
};
