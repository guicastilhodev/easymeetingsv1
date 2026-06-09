import type { CSSProperties } from "react";

export interface ReservationData {
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

interface ReservationCardProps {
  reservation: ReservationData;
  currentUserId: number;
  onCancel?: (id: number) => void;
  onEdit?: (id: number) => void;
  onClick?: (id: number) => void;
}

/**
 * Card com informações resumidas de uma reserva.
 * Exibe: sala, data, horário, status, organizador e contagem de participantes.
 */
export default function ReservationCard({
  reservation,
  currentUserId,
  onCancel,
  onEdit,
  onClick,
}: ReservationCardProps) {
  const isActive = reservation.status === "active";
  const isCompleted = reservation.status === "completed";
  const isOrganizer = reservation.organizer_id === currentUserId;
  const canManage = isActive && isOrganizer;

  function handleCancelClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (onCancel) {
      onCancel(reservation.id);
    }
  }

  function handleEditClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (onEdit) {
      onEdit(reservation.id);
    }
  }

  return (
    <div
      style={styles.card}
      onClick={() => onClick?.(reservation.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onClick?.(reservation.id);
        }
      }}
      aria-label={`Reserva na sala ${reservation.room_name} em ${reservation.date}`}
    >
      <div style={styles.header}>
        <h3 style={styles.roomName}>{reservation.room_name}</h3>
        <span
          style={{
            ...styles.statusBadge,
            backgroundColor: isActive
              ? "#e8f5e9"
              : isCompleted
                ? "#e3f2fd"
                : "#fbe9e7",
            color: isActive ? "#2e7d32" : isCompleted ? "#1565c0" : "#c62828",
          }}
        >
          {isActive ? "Ativa" : isCompleted ? "Finalizada" : "Cancelada"}
        </span>
      </div>

      <div style={styles.details}>
        <p style={styles.detailRow}>
          <strong>Data:</strong> {reservation.date}
        </p>
        <p style={styles.detailRow}>
          <strong>Horário:</strong> {reservation.start_time} -{" "}
          {reservation.end_time}
        </p>
        <p style={styles.detailRow}>
          <strong>Organizador:</strong> {reservation.organizer_name}
        </p>
        <p style={styles.detailRow}>
          <strong>Participantes:</strong> {reservation.participants.length}
        </p>
      </div>

      {canManage && (onEdit || onCancel) && (
        <div style={styles.actions}>
          {onEdit && (
            <button
              type="button"
              style={styles.editButton}
              onClick={handleEditClick}
              aria-label="Editar reserva"
            >
              Editar
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              style={styles.cancelButton}
              onClick={handleCancelClick}
              aria-label="Cancelar reserva"
            >
              Cancelar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    padding: "1rem 1.25rem",
    backgroundColor: "#fff",
    cursor: "pointer",
    transition: "box-shadow 0.2s",
    marginBottom: "0.75rem",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.75rem",
  },
  roomName: {
    margin: 0,
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "#333",
  },
  statusBadge: {
    padding: "0.25rem 0.625rem",
    borderRadius: "12px",
    fontSize: "0.75rem",
    fontWeight: 600,
    textTransform: "uppercase" as const,
  },
  details: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.25rem",
  },
  detailRow: {
    margin: 0,
    fontSize: "0.875rem",
    color: "#555",
  },
  actions: {
    marginTop: "0.75rem",
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.5rem",
  },
  editButton: {
    padding: "0.375rem 0.75rem",
    fontSize: "0.8rem",
    fontWeight: 500,
    color: "#00A693",
    backgroundColor: "#fff",
    border: "1px solid #00A693",
    borderRadius: "4px",
    cursor: "pointer",
  },
  cancelButton: {
    padding: "0.375rem 0.75rem",
    fontSize: "0.8rem",
    fontWeight: 500,
    color: "#c62828",
    backgroundColor: "#fff",
    border: "1px solid #c62828",
    borderRadius: "4px",
    cursor: "pointer",
  },
};
