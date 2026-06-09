import { useRef } from "react";

interface ParticipantsListProps {
  participants: string[];
  onChange: (participants: string[]) => void;
  error?: string;
  disabled?: boolean;
  maxParticipants?: number;
}

/**
 * Campo dinâmico de participantes.
 * Cada participante tem seu próprio input com botão de remover (×).
 * O botão + adiciona uma nova linha vazia e foca nela automaticamente.
 */
export default function ParticipantsList({
  participants,
  onChange,
  error,
  disabled = false,
  maxParticipants = 50,
}: ParticipantsListProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function handleChange(index: number, value: string) {
    const updated = [...participants];
    updated[index] = value;
    onChange(updated);
  }

  function handleAdd() {
    const updated = [...participants, ""];
    onChange(updated);
    // Foca no novo input no próximo ciclo de render
    setTimeout(() => {
      inputRefs.current[updated.length - 1]?.focus();
    }, 0);
  }

  function handleRemove(index: number) {
    const updated = participants.filter((_, i) => i !== index);
    onChange(updated.length > 0 ? updated : [""]);
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    // Enter adiciona novo participante (sem submeter o form)
    if (e.key === "Enter") {
      e.preventDefault();
      if (participants.length < maxParticipants) {
        const updated = [
          ...participants.slice(0, index + 1),
          "",
          ...participants.slice(index + 1),
        ];
        onChange(updated);
        setTimeout(() => {
          inputRefs.current[index + 1]?.focus();
        }, 0);
      }
    }
    // Backspace em campo vazio remove a linha e volta ao anterior
    if (
      e.key === "Backspace" &&
      participants[index] === "" &&
      participants.length > 1
    ) {
      e.preventDefault();
      handleRemove(index);
      setTimeout(() => {
        inputRefs.current[Math.max(0, index - 1)]?.focus();
      }, 0);
    }
  }

  const atLimit = participants.length >= maxParticipants;

  return (
    <div style={styles.wrapper}>
      <div style={styles.labelRow}>
        <span style={styles.label}>
          Participantes{" "}
          <span style={styles.count}>
            ({participants.filter((p) => p.trim()).length}/{maxParticipants})
          </span>
        </span>
        <button
          type="button"
          onClick={handleAdd}
          disabled={disabled || atLimit}
          style={{
            ...styles.addButton,
            ...(disabled || atLimit ? styles.addButtonDisabled : {}),
          }}
          aria-label="Adicionar participante"
          title={
            atLimit
              ? `Máximo de ${maxParticipants} participantes`
              : "Adicionar participante"
          }
        >
          + Adicionar
        </button>
      </div>

      <div style={styles.list}>
        {participants.map((name, index) => (
          <div key={index} style={styles.row}>
            <input
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              value={name}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              placeholder={`Participante ${index + 1}`}
              style={styles.input}
              disabled={disabled}
              aria-label={`Nome do participante ${index + 1}`}
              maxLength={100}
            />
            <button
              type="button"
              onClick={() => handleRemove(index)}
              disabled={disabled}
              style={{
                ...styles.removeButton,
                ...(disabled ? styles.removeButtonDisabled : {}),
              }}
              aria-label={`Remover participante ${index + 1}`}
              title="Remover"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {error && <span style={styles.fieldError}>{error}</span>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  labelRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#333",
  },
  count: {
    fontWeight: 400,
    color: "#888",
  },
  addButton: {
    padding: "0.3rem 0.75rem",
    fontSize: "0.82rem",
    fontWeight: 600,
    color: "#00A693",
    backgroundColor: "#fff",
    border: "1px solid #00A693",
    borderRadius: "4px",
    cursor: "pointer",
  },
  addButtonDisabled: {
    color: "#aaa",
    borderColor: "#ccc",
    cursor: "not-allowed",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
  },
  row: {
    display: "flex",
    gap: "0.5rem",
    alignItems: "center",
  },
  input: {
    flex: 1,
    padding: "0.5rem 0.75rem",
    fontSize: "0.9rem",
    border: "1px solid #ccc",
    borderRadius: "4px",
    outline: "none",
  },
  removeButton: {
    width: "2rem",
    height: "2rem",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.1rem",
    fontWeight: 700,
    lineHeight: 1,
    color: "#c62828",
    backgroundColor: "#fff",
    border: "1px solid #e0e0e0",
    borderRadius: "4px",
    cursor: "pointer",
    padding: 0,
  },
  removeButtonDisabled: {
    color: "#aaa",
    borderColor: "#e0e0e0",
    cursor: "not-allowed",
  },
  fieldError: {
    fontSize: "0.8rem",
    color: "#d32f2f",
  },
};
