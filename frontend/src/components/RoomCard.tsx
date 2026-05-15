import { useNavigate } from "react-router-dom";

interface Resource {
  id: number;
  room_id: number;
  type: string;
  name: string;
  quantity: number;
}

interface RoomCardProps {
  id: number;
  name: string;
  capacity: number;
  location: string;
  resources: Resource[];
}

/**
 * Card com informações resumidas de uma sala de reunião.
 * Ao clicar, navega para a página de detalhes da sala.
 */
export default function RoomCard({
  id,
  name,
  capacity,
  location,
  resources,
}: RoomCardProps) {
  const navigate = useNavigate();

  function handleClick() {
    navigate(`/rooms/${id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  }

  return (
    <div
      style={styles.card}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Sala ${name}`}
    >
      <h3 style={styles.name}>{name}</h3>
      <p style={styles.info}>
        <span style={styles.infoLabel}>Capacidade:</span> {capacity} pessoas
      </p>
      <p style={styles.info}>
        <span style={styles.infoLabel}>Localização:</span> {location}
      </p>
      {resources.length > 0 && (
        <div style={styles.resourcesSection}>
          <span style={styles.infoLabel}>Recursos:</span>
          <div style={styles.resourcesList}>
            {resources.map((resource) => (
              <span key={resource.id} style={styles.resourceTag}>
                {resource.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    padding: "1.25rem",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    border: "1px solid #e0e0e0",
    cursor: "pointer",
    transition: "box-shadow 0.2s, border-color 0.2s",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  name: {
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "#00A693",
    margin: "0 0 0.75rem 0",
  },
  info: {
    fontSize: "0.875rem",
    color: "#555",
    margin: "0.25rem 0",
  },
  infoLabel: {
    fontWeight: 500,
    color: "#333",
  },
  resourcesSection: {
    marginTop: "0.75rem",
    fontSize: "0.875rem",
    color: "#555",
  },
  resourcesList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.375rem",
    marginTop: "0.375rem",
  },
  resourceTag: {
    display: "inline-block",
    padding: "0.2rem 0.5rem",
    backgroundColor: "#e6f7f5",
    color: "#00A693",
    borderRadius: "4px",
    fontSize: "0.8rem",
    fontWeight: 500,
  },
};
