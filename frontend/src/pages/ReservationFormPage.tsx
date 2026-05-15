import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiGet, apiPost } from "../services/api";
import TimeSlotPicker from "../components/TimeSlotPicker";

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

interface FormErrors {
  room_id?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  participants?: string;
  general?: string;
}

/**
 * Página de formulário para criação de reserva.
 * Permite selecionar sala, data, horário e participantes.
 * Valida período (end > start, mín 15 min) e participantes (1-50).
 * Exibe erro de conflito (409) de forma destacada.
 */
export default function ReservationFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [roomId, setRoomId] = useState<string>(
    searchParams.get("room_id") || "",
  );
  const [date, setDate] = useState<string>(searchParams.get("date") || "");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [participantsText, setParticipantsText] = useState<string>("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [conflictError, setConflictError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [schedule, setSchedule] = useState<RoomSchedule | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  useEffect(() => {
    async function fetchRooms() {
      try {
        const data = await apiGet<RoomOption[]>("/api/rooms");
        const activeRooms = data.filter((r) => r.is_active);
        setRooms(activeRooms);
      } catch {
        setErrors({ general: "Erro ao carregar salas." });
      } finally {
        setLoadingRooms(false);
      }
    }
    fetchRooms();
  }, []);

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

  function parseParticipants(text: string): string[] {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  function validate(): FormErrors {
    const newErrors: FormErrors = {};

    if (!roomId) {
      newErrors.room_id = "Selecione uma sala.";
    }

    if (!date) {
      newErrors.date = "Informe a data.";
    }

    if (!startTime) {
      newErrors.start_time = "Informe a hora de início.";
    }

    if (!endTime) {
      newErrors.end_time = "Informe a hora de fim.";
    }

    if (startTime && endTime) {
      if (endTime <= startTime) {
        newErrors.end_time =
          "A hora de fim deve ser posterior à hora de início.";
      } else {
        // Verificar duração mínima de 15 minutos
        const [startH, startM] = startTime.split(":").map(Number);
        const [endH, endM] = endTime.split(":").map(Number);
        const durationMinutes = endH * 60 + endM - (startH * 60 + startM);
        if (durationMinutes < 15) {
          newErrors.end_time = "A duração mínima da reserva é de 15 minutos.";
        }
      }
    }

    const participants = parseParticipants(participantsText);
    if (participants.length === 0) {
      newErrors.participants = "Informe pelo menos 1 participante.";
    } else if (participants.length > 50) {
      newErrors.participants = "O máximo é de 50 participantes.";
    } else if (roomId) {
      const selectedRoom = rooms.find((r) => r.id === Number(roomId));
      if (selectedRoom && participants.length > selectedRoom.capacity) {
        newErrors.participants = `Número de participantes (${participants.length}) excede a capacidade da sala (${selectedRoom.capacity}).`;
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
      const participants = parseParticipants(participantsText);
      await apiPost("/api/reservations", {
        room_id: Number(roomId),
        date,
        start_time: startTime,
        end_time: endTime,
        participants,
      });
      navigate("/reservations");
    } catch (err: unknown) {
      const apiError = err as { detail?: string; status_code?: number };
      // Verificar se é erro de conflito (409)
      if (
        apiError?.detail?.toLowerCase().includes("conflito") ||
        apiError?.detail?.toLowerCase().includes("conflict")
      ) {
        setConflictError(apiError.detail || "Conflito de horário detectado.");
      } else if (apiError?.detail) {
        setErrors({ general: apiError.detail });
      } else {
        setErrors({ general: "Erro inesperado ao criar reserva." });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Nova Reserva</h1>

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
          {loadingRooms ? (
            <p style={styles.loadingText}>Carregando salas...</p>
          ) : (
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
          )}
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
        <div style={styles.field}>
          <label htmlFor="participants" style={styles.label}>
            Participantes (um por linha, de 1 a 50)
          </label>
          <textarea
            id="participants"
            value={participantsText}
            onChange={(e) => setParticipantsText(e.target.value)}
            style={styles.textarea}
            placeholder={"João Silva\nMaria Souza\nCarlos Oliveira"}
            rows={5}
            disabled={loading}
          />
          {errors.participants && (
            <span style={styles.fieldError}>{errors.participants}</span>
          )}
          <span style={styles.helperText}>
            {parseParticipants(participantsText).length} participante(s)
          </span>
        </div>

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
            {loading ? "Criando..." : "Criar Reserva"}
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
  textarea: {
    padding: "0.625rem 0.75rem",
    fontSize: "1rem",
    border: "1px solid #ccc",
    borderRadius: "4px",
    outline: "none",
    resize: "vertical" as const,
    fontFamily: "inherit",
  },
  timeRow: {
    display: "flex",
    gap: "1rem",
  },
  fieldError: {
    fontSize: "0.8rem",
    color: "#d32f2f",
  },
  helperText: {
    fontSize: "0.8rem",
    color: "#666",
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
