interface TimeSlot {
  start_time: string;
  end_time: string;
}

interface TimeSlotPickerProps {
  businessHours: { start: string; end: string };
  occupied: TimeSlot[];
  available: TimeSlot[];
}

const DAY_START = "00:00";
const DAY_END = "23:59";

/**
 * Componente visual que exibe a agenda do dia completo de uma sala (00:00–23:59).
 * Slots disponíveis em verde, ocupados em vermelho.
 * Horário comercial indicado por linhas verticais tracejadas na régua de horas.
 */
export default function TimeSlotPicker({
  businessHours,
  occupied,
  available,
}: TimeSlotPickerProps) {
  const dayStartMin = parseTimeToMinutes(DAY_START);
  const dayEndMin = parseTimeToMinutes(DAY_END);
  const totalMinutes = dayEndMin - dayStartMin;

  function parseTimeToMinutes(time: string): number {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  function toPercent(minutes: number): number {
    return ((minutes - dayStartMin) / totalMinutes) * 100;
  }

  function getSlotStyle(
    slot: TimeSlot,
    type: "occupied" | "available",
  ): React.CSSProperties {
    const slotStart = parseTimeToMinutes(slot.start_time);
    const slotEnd = parseTimeToMinutes(slot.end_time);
    const left = toPercent(slotStart);
    const width = toPercent(slotEnd) - toPercent(slotStart);

    return {
      position: "absolute",
      left: `${left}%`,
      width: `${width}%`,
      top: 0,
      bottom: 0,
      backgroundColor: type === "occupied" ? "#ffcdd2" : "#c8e6c9",
      borderLeft: type === "occupied" ? "2px solid #e53935" : "none",
    };
  }

  // Marcadores de hora a cada 3h
  function generateHourMarkers(): number[] {
    const markers: number[] = [];
    for (let h = 0; h <= 23; h += 3) {
      markers.push(h * 60);
    }
    return markers;
  }

  const hourMarkers = generateHourMarkers();
  const bizStartMin = parseTimeToMinutes(businessHours.start);
  const bizEndMin = parseTimeToMinutes(businessHours.end);
  const bizStartPct = toPercent(bizStartMin);
  const bizEndPct = toPercent(bizEndMin);

  function formatTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }

  return (
    <div style={styles.container}>
      {/* Legenda */}
      <div style={styles.legend}>
        <span style={styles.legendItem}>
          <span
            style={{
              ...styles.legendDot,
              backgroundColor: "#c8e6c9",
              border: "1px solid #43a047",
            }}
          />
          Disponível
        </span>
        <span style={styles.legendItem}>
          <span
            style={{
              ...styles.legendDot,
              backgroundColor: "#ffcdd2",
              border: "1px solid #e53935",
            }}
          />
          Ocupado
        </span>
        <span style={styles.legendItem}>
          <span style={styles.legendDash} />
          Horário comercial ({businessHours.start}–{businessHours.end})
        </span>
      </div>

      {/* Barra + régua juntas para alinhar as linhas verticais */}
      <div style={{ position: "relative" }}>
        {/* Barra principal */}
        <div style={styles.timelineBar}>
          {available.map((slot, index) => (
            <div
              key={`av-${index}`}
              style={getSlotStyle(slot, "available")}
              title={`Disponível: ${slot.start_time} – ${slot.end_time}`}
              aria-label={`Disponível das ${slot.start_time} às ${slot.end_time}`}
            />
          ))}
          {occupied.map((slot, index) => (
            <div
              key={`oc-${index}`}
              style={getSlotStyle(slot, "occupied")}
              title={`Ocupado: ${slot.start_time} – ${slot.end_time}`}
              aria-label={`Ocupado das ${slot.start_time} às ${slot.end_time}`}
            />
          ))}
        </div>

        {/* Régua de horas */}
        <div style={styles.hoursRow}>
          {hourMarkers.map((min) => {
            const left = toPercent(min);
            return (
              <span key={min} style={{ ...styles.hourLabel, left: `${left}%` }}>
                {formatTime(min)}
              </span>
            );
          })}
        </div>

        {/* Linhas verticais do horário comercial — atravessam barra + régua */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: `${bizStartPct}%`,
            width: "0",
            height: "100%",
            borderLeft: "2px dashed #e65100",
            pointerEvents: "none",
          }}
          title={`Início do horário comercial: ${businessHours.start}`}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: `${bizEndPct}%`,
            width: "0",
            height: "100%",
            borderLeft: "2px dashed #e65100",
            pointerEvents: "none",
          }}
          title={`Fim do horário comercial: ${businessHours.end}`}
        />
      </div>

      {/* Lista de detalhes */}
      <div style={styles.slotsList}>
        <h4 style={styles.slotsTitle}>Detalhes</h4>
        {occupied.length === 0 && available.length === 0 && (
          <p style={styles.emptyMessage}>Nenhum horário para exibir.</p>
        )}
        {occupied.map((slot, index) => (
          <div key={`list-oc-${index}`} style={styles.slotItem}>
            <span style={{ color: "#e53935", marginRight: "0.4rem" }}>●</span>
            {slot.start_time} – {slot.end_time}
            <span style={styles.slotTag}> Ocupado</span>
          </div>
        ))}
        {available.map((slot, index) => (
          <div key={`list-av-${index}`} style={styles.slotItem}>
            <span style={{ color: "#43a047", marginRight: "0.4rem" }}>●</span>
            {slot.start_time} – {slot.end_time}
            <span style={styles.slotTag}> Disponível</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: "0.75rem",
  },
  legend: {
    display: "flex",
    gap: "1.25rem",
    marginBottom: "0.6rem",
    fontSize: "0.8rem",
    color: "#555",
    flexWrap: "wrap" as const,
    alignItems: "center",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.35rem",
  },
  legendDot: {
    display: "inline-block",
    width: "12px",
    height: "12px",
    borderRadius: "3px",
    flexShrink: 0,
  },
  legendDash: {
    display: "inline-block",
    width: "16px",
    height: "0",
    borderTop: "2px dashed #e65100",
    flexShrink: 0,
  },
  timelineBar: {
    position: "relative",
    height: "36px",
    backgroundColor: "#f5f5f5",
    borderRadius: "4px 4px 0 0",
    overflow: "hidden",
    border: "1px solid #ddd",
    borderBottom: "none",
  },
  hoursRow: {
    position: "relative",
    height: "20px",
    backgroundColor: "#fafafa",
    border: "1px solid #ddd",
    borderTop: "none",
    borderRadius: "0 0 4px 4px",
  },
  hourLabel: {
    position: "absolute",
    transform: "translateX(-50%)",
    fontSize: "0.65rem",
    color: "#999",
    top: "3px",
  },
  slotsList: {
    marginTop: "1rem",
  },
  slotsTitle: {
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "#444",
    margin: "0 0 0.4rem 0",
  },
  slotItem: {
    fontSize: "0.82rem",
    color: "#555",
    padding: "0.2rem 0",
    display: "flex",
    alignItems: "center",
  },
  slotTag: {
    color: "#888",
    fontSize: "0.75rem",
    marginLeft: "0.3rem",
  },
  emptyMessage: {
    fontSize: "0.82rem",
    color: "#888",
    fontStyle: "italic",
  },
};
