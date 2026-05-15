interface TimeSlot {
  start_time: string;
  end_time: string;
}

interface TimeSlotPickerProps {
  businessHours: { start: string; end: string };
  occupied: TimeSlot[];
  available: TimeSlot[];
}

/**
 * Componente visual que exibe a agenda do dia de uma sala.
 * Mostra intervalos ocupados (vermelho) e disponíveis (verde) dentro do horário comercial.
 */
export default function TimeSlotPicker({
  businessHours,
  occupied,
  available,
}: TimeSlotPickerProps) {
  const startHour = parseTimeToMinutes(businessHours.start);
  const endHour = parseTimeToMinutes(businessHours.end);
  const totalMinutes = endHour - startHour;

  function parseTimeToMinutes(time: string): number {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  function getSlotStyle(
    slot: TimeSlot,
    type: "occupied" | "available",
  ): React.CSSProperties {
    const slotStart = parseTimeToMinutes(slot.start_time);
    const slotEnd = parseTimeToMinutes(slot.end_time);
    const left = ((slotStart - startHour) / totalMinutes) * 100;
    const width = ((slotEnd - slotStart) / totalMinutes) * 100;

    return {
      position: "absolute",
      left: `${left}%`,
      width: `${width}%`,
      top: 0,
      bottom: 0,
      backgroundColor: type === "occupied" ? "#ffcdd2" : "#c8e6c9",
      borderLeft:
        type === "occupied" ? "2px solid #e53935" : "2px solid #43a047",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "0.7rem",
      color: type === "occupied" ? "#b71c1c" : "#1b5e20",
      fontWeight: 500,
      overflow: "hidden",
      whiteSpace: "nowrap",
    };
  }

  function generateHourMarkers(): string[] {
    const markers: string[] = [];
    const startH = Math.floor(startHour / 60);
    const endH = Math.ceil(endHour / 60);
    for (let h = startH; h <= endH; h++) {
      markers.push(`${h.toString().padStart(2, "0")}:00`);
    }
    return markers;
  }

  const hourMarkers = generateHourMarkers();

  return (
    <div style={styles.container}>
      <div style={styles.legend}>
        <span style={styles.legendItem}>
          <span style={{ ...styles.legendColor, backgroundColor: "#c8e6c9" }} />
          Disponível
        </span>
        <span style={styles.legendItem}>
          <span style={{ ...styles.legendColor, backgroundColor: "#ffcdd2" }} />
          Ocupado
        </span>
      </div>

      <div style={styles.timeline}>
        <div style={styles.timelineBar}>
          {available.map((slot, index) => (
            <div
              key={`available-${index}`}
              style={getSlotStyle(slot, "available")}
              title={`Disponível: ${slot.start_time} - ${slot.end_time}`}
              aria-label={`Disponível das ${slot.start_time} às ${slot.end_time}`}
            >
              {slot.start_time} - {slot.end_time}
            </div>
          ))}
          {occupied.map((slot, index) => (
            <div
              key={`occupied-${index}`}
              style={getSlotStyle(slot, "occupied")}
              title={`Ocupado: ${slot.start_time} - ${slot.end_time}`}
              aria-label={`Ocupado das ${slot.start_time} às ${slot.end_time}`}
            >
              {slot.start_time} - {slot.end_time}
            </div>
          ))}
        </div>
      </div>

      <div style={styles.hoursRow}>
        {hourMarkers.map((marker) => {
          const markerMinutes = parseTimeToMinutes(marker);
          const left = ((markerMinutes - startHour) / totalMinutes) * 100;
          return (
            <span
              key={marker}
              style={{ ...styles.hourLabel, left: `${left}%` }}
            >
              {marker}
            </span>
          );
        })}
      </div>

      <div style={styles.slotsList}>
        <h4 style={styles.slotsTitle}>Detalhes dos Horários</h4>
        {available.length === 0 && occupied.length === 0 && (
          <p style={styles.emptyMessage}>Nenhum horário para exibir.</p>
        )}
        {available.map((slot, index) => (
          <div key={`list-avail-${index}`} style={styles.slotItem}>
            <span style={styles.slotAvailable}>●</span>
            {slot.start_time} - {slot.end_time}{" "}
            <span style={styles.slotLabel}>(Disponível)</span>
          </div>
        ))}
        {occupied.map((slot, index) => (
          <div key={`list-occ-${index}`} style={styles.slotItem}>
            <span style={styles.slotOccupied}>●</span>
            {slot.start_time} - {slot.end_time}{" "}
            <span style={styles.slotLabel}>(Ocupado)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: "1rem",
  },
  legend: {
    display: "flex",
    gap: "1.5rem",
    marginBottom: "0.75rem",
    fontSize: "0.85rem",
    color: "#555",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
  },
  legendColor: {
    display: "inline-block",
    width: "14px",
    height: "14px",
    borderRadius: "3px",
  },
  timeline: {
    position: "relative",
    marginBottom: "1.5rem",
  },
  timelineBar: {
    position: "relative",
    height: "40px",
    backgroundColor: "#f0f0f0",
    borderRadius: "4px",
    overflow: "hidden",
    border: "1px solid #ddd",
  },
  hoursRow: {
    position: "relative",
    height: "20px",
    marginTop: "0.25rem",
  },
  hourLabel: {
    position: "absolute",
    transform: "translateX(-50%)",
    fontSize: "0.7rem",
    color: "#888",
  },
  slotsList: {
    marginTop: "1.5rem",
  },
  slotsTitle: {
    fontSize: "0.95rem",
    fontWeight: 600,
    color: "#333",
    margin: "0 0 0.5rem 0",
  },
  slotItem: {
    fontSize: "0.85rem",
    color: "#555",
    padding: "0.25rem 0",
  },
  slotAvailable: {
    color: "#43a047",
    marginRight: "0.5rem",
  },
  slotOccupied: {
    color: "#e53935",
    marginRight: "0.5rem",
  },
  slotLabel: {
    color: "#888",
    fontSize: "0.8rem",
  },
  emptyMessage: {
    fontSize: "0.85rem",
    color: "#888",
    fontStyle: "italic",
  },
};
