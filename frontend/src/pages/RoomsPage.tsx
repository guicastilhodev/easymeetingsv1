import { useState, useEffect } from "react";
import { apiGet } from "../services/api";
import FilterPanel, { type FilterValues } from "../components/FilterPanel";
import RoomCard from "../components/RoomCard";
import { getToken } from "../utils/auth";

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

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * Página de listagem e busca de salas de reunião.
 * Exibe um painel de filtros e os resultados como cards.
 */
export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  // Carrega todas as salas ao montar a página
  useEffect(() => {
    loadAllRooms();
  }, []);

  async function loadAllRooms() {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<Room[]>("/api/rooms");
      setRooms(data);
    } catch (err: unknown) {
      const apiError = err as { detail?: string };
      setError(apiError?.detail || "Erro ao carregar salas.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(filters: FilterValues) {
    setLoading(true);
    setError("");
    setSearched(true);

    try {
      // Build URL manually to support repeated query params for resources
      const params = new URLSearchParams();
      params.set("date", filters.date);
      params.set("start_time", filters.startTime);
      params.set("end_time", filters.endTime);

      for (const resource of filters.resources) {
        params.append("resources", resource);
      }

      const url = `${BASE_URL}/api/rooms/available?${params.toString()}`;
      const token = getToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(url, { method: "GET", headers });

      if (!response.ok) {
        const apiError = await response.json().catch(() => ({
          detail: "Erro ao buscar salas disponíveis.",
        }));
        throw apiError;
      }

      const data = (await response.json()) as Room[];
      setRooms(data);
    } catch (err: unknown) {
      const apiError = err as { detail?: string };
      setError(apiError?.detail || "Erro ao buscar salas disponíveis.");
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 style={styles.title}>Salas de Reunião</h1>
      <p style={styles.subtitle}>
        Busque salas disponíveis por período e recursos desejados.
      </p>

      <FilterPanel onSearch={handleSearch} loading={loading} />

      {error && (
        <p style={styles.error} role="alert">
          {error}
        </p>
      )}

      {!loading && rooms.length === 0 && searched && !error && (
        <p style={styles.emptyMessage}>
          Nenhuma sala encontrada para os filtros selecionados.
        </p>
      )}

      {!loading && rooms.length === 0 && !searched && !error && (
        <p style={styles.emptyMessage}>Nenhuma sala cadastrada no sistema.</p>
      )}

      {rooms.length > 0 && (
        <div style={styles.grid}>
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              id={room.id}
              name={room.name}
              capacity={room.capacity}
              location={room.location}
              resources={room.resources}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "#333",
    margin: "0 0 0.25rem 0",
  },
  subtitle: {
    fontSize: "0.9rem",
    color: "#666",
    margin: "0 0 1.5rem 0",
  },
  error: {
    color: "#d32f2f",
    fontSize: "0.875rem",
    padding: "0.75rem",
    backgroundColor: "#ffebee",
    borderRadius: "4px",
    margin: "0 0 1rem 0",
  },
  emptyMessage: {
    fontSize: "0.9rem",
    color: "#888",
    textAlign: "center",
    padding: "2rem",
    backgroundColor: "#f8f9fa",
    borderRadius: "8px",
    border: "1px dashed #ddd",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: "1rem",
  },
};
