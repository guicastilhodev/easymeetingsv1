import { useState } from "react";

interface FilterPanelProps {
  onSearch: (filters: FilterValues) => void;
  loading?: boolean;
}

export interface FilterValues {
  date: string;
  startTime: string;
  endTime: string;
  resources: string[];
}

/**
 * Painel de filtros reutilizável para busca de salas disponíveis.
 * Permite filtrar por data, horário de início/fim e recursos desejados.
 */
export default function FilterPanel({ onSearch, loading }: FilterPanelProps) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [resourcesInput, setResourcesInput] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const resources = resourcesInput
      .split(",")
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    onSearch({ date, startTime, endTime, resources });
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.fieldsRow}>
        <div style={styles.field}>
          <label htmlFor="filter-date" style={styles.label}>
            Data
          </label>
          <input
            id="filter-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={styles.input}
            required
            disabled={loading}
          />
        </div>

        <div style={styles.field}>
          <label htmlFor="filter-start-time" style={styles.label}>
            Hora Início
          </label>
          <input
            id="filter-start-time"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            style={styles.input}
            required
            disabled={loading}
          />
        </div>

        <div style={styles.field}>
          <label htmlFor="filter-end-time" style={styles.label}>
            Hora Fim
          </label>
          <input
            id="filter-end-time"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            style={styles.input}
            required
            disabled={loading}
          />
        </div>

        <div style={styles.fieldWide}>
          <label htmlFor="filter-resources" style={styles.label}>
            Recursos (separados por vírgula)
          </label>
          <input
            id="filter-resources"
            type="text"
            value={resourcesInput}
            onChange={(e) => setResourcesInput(e.target.value)}
            style={styles.input}
            placeholder="Ex: Projetor, Ar-condicionado"
            disabled={loading}
          />
        </div>
      </div>

      <button type="submit" style={styles.button} disabled={loading}>
        {loading ? "Buscando..." : "Buscar"}
      </button>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
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
    flex: 1,
    minWidth: "140px",
  },
  fieldWide: {
    display: "flex",
    flexDirection: "column",
    gap: "0.375rem",
    flex: 1,
    minWidth: "140px",
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
  button: {
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
};
