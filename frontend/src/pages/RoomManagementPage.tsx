import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "../services/api";

// --- Types ---

interface ResourceResponse {
  id: number;
  room_id: number;
  type: string;
  name: string;
  quantity: number;
}

interface RoomResponse {
  id: number;
  name: string;
  capacity: number;
  location: string;
  is_active: boolean;
  resources: ResourceResponse[];
}

interface RoomFormData {
  name: string;
  capacity: string;
  location: string;
}

interface ResourceFormData {
  type: string;
  name: string;
  quantity: string;
}

interface FieldErrors {
  [key: string]: string;
}

// --- Component ---

export default function RoomManagementPage() {
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Room form state
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomResponse | null>(null);
  const [roomForm, setRoomForm] = useState<RoomFormData>({
    name: "",
    capacity: "",
    location: "",
  });
  const [roomErrors, setRoomErrors] = useState<FieldErrors>({});
  const [roomSubmitting, setRoomSubmitting] = useState(false);

  // Resource form state
  const [expandedRoomId, setExpandedRoomId] = useState<number | null>(null);
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [editingResource, setEditingResource] =
    useState<ResourceResponse | null>(null);
  const [resourceForm, setResourceForm] = useState<ResourceFormData>({
    type: "",
    name: "",
    quantity: "",
  });
  const [resourceErrors, setResourceErrors] = useState<FieldErrors>({});
  const [resourceSubmitting, setResourceSubmitting] = useState(false);

  // Deactivation modal state
  const [deactivatingRoom, setDeactivatingRoom] = useState<RoomResponse | null>(
    null,
  );
  const [deactivating, setDeactivating] = useState(false);

  // --- Data fetching ---

  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiGet<RoomResponse[]>("/api/rooms", {
        include_inactive: "true",
      });
      setRooms(data);
      setError("");
    } catch (err: unknown) {
      const apiErr = err as { detail?: string };
      setError(apiErr?.detail || "Erro ao carregar salas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // --- Room form validation ---

  function validateRoomForm(data: RoomFormData): FieldErrors {
    const errors: FieldErrors = {};
    const name = data.name.trim();
    const capacity = parseInt(data.capacity, 10);
    const location = data.location.trim();

    if (!name || name.length > 100) {
      errors.name = "Nome é obrigatório (máx. 100 caracteres).";
    }
    if (isNaN(capacity) || capacity < 1 || capacity > 200) {
      errors.capacity = "Capacidade deve ser entre 1 e 200.";
    }
    if (!location || location.length > 200) {
      errors.location = "Localização é obrigatória (máx. 200 caracteres).";
    }

    return errors;
  }

  // --- Room CRUD handlers ---

  function handleNewRoom() {
    setEditingRoom(null);
    setRoomForm({ name: "", capacity: "", location: "" });
    setRoomErrors({});
    setShowRoomForm(true);
  }

  function handleEditRoom(room: RoomResponse) {
    setEditingRoom(room);
    setRoomForm({
      name: room.name,
      capacity: String(room.capacity),
      location: room.location,
    });
    setRoomErrors({});
    setShowRoomForm(true);
  }

  function handleCancelRoomForm() {
    setShowRoomForm(false);
    setEditingRoom(null);
    setRoomForm({ name: "", capacity: "", location: "" });
    setRoomErrors({});
  }

  async function handleSubmitRoom(e: React.FormEvent) {
    e.preventDefault();
    const errors = validateRoomForm(roomForm);
    if (Object.keys(errors).length > 0) {
      setRoomErrors(errors);
      return;
    }

    setRoomSubmitting(true);
    setRoomErrors({});

    const payload = {
      name: roomForm.name.trim(),
      capacity: parseInt(roomForm.capacity, 10),
      location: roomForm.location.trim(),
    };

    try {
      if (editingRoom) {
        await apiPut(`/api/rooms/${editingRoom.id}`, payload);
      } else {
        await apiPost("/api/rooms", payload);
      }
      handleCancelRoomForm();
      await fetchRooms();
    } catch (err: unknown) {
      const apiErr = err as {
        detail?: string;
        error_code?: string;
        fields?: string[];
      };
      if (
        apiErr?.error_code === "ROOM_NAME_DUPLICATE" ||
        apiErr?.detail?.toLowerCase().includes("nome")
      ) {
        setRoomErrors({ name: apiErr.detail || "Nome de sala já existe." });
      } else {
        setRoomErrors({ _general: apiErr?.detail || "Erro ao salvar sala." });
      }
    } finally {
      setRoomSubmitting(false);
    }
  }

  // --- Deactivation handlers ---

  function handleDeactivateClick(room: RoomResponse) {
    setDeactivatingRoom(room);
  }

  function handleCancelDeactivation() {
    setDeactivatingRoom(null);
  }

  async function handleConfirmDeactivation() {
    if (!deactivatingRoom) return;
    setDeactivating(true);
    try {
      await apiDelete(`/api/rooms/${deactivatingRoom.id}`);
      setDeactivatingRoom(null);
      await fetchRooms();
    } catch (err: unknown) {
      const apiErr = err as { detail?: string };
      setError(apiErr?.detail || "Erro ao desativar sala.");
      setDeactivatingRoom(null);
    } finally {
      setDeactivating(false);
    }
  }

  async function handleReactivateRoom(roomId: number) {
    try {
      await apiPatch(`/api/rooms/${roomId}/reactivate`);
      await fetchRooms();
    } catch (err: unknown) {
      const apiErr = err as { detail?: string };
      setError(apiErr?.detail || "Erro ao reativar sala.");
    }
  }

  // --- Resource form validation ---

  function validateResourceForm(data: ResourceFormData): FieldErrors {
    const errors: FieldErrors = {};
    const type = data.type.trim();
    const name = data.name.trim();
    const quantity = parseInt(data.quantity, 10);

    if (!type || type.length > 100) {
      errors.type = "Tipo é obrigatório (máx. 100 caracteres).";
    }
    if (!name || name.length > 100) {
      errors.name = "Nome é obrigatório (máx. 100 caracteres).";
    }
    if (isNaN(quantity) || quantity < 1 || quantity > 9999) {
      errors.quantity = "Quantidade deve ser entre 1 e 9999.";
    }

    return errors;
  }

  // --- Resource CRUD handlers ---

  function handleToggleResources(roomId: number) {
    if (expandedRoomId === roomId) {
      setExpandedRoomId(null);
      setShowResourceForm(false);
      setEditingResource(null);
    } else {
      setExpandedRoomId(roomId);
      setShowResourceForm(false);
      setEditingResource(null);
    }
  }

  function handleNewResource() {
    setEditingResource(null);
    setResourceForm({ type: "", name: "", quantity: "" });
    setResourceErrors({});
    setShowResourceForm(true);
  }

  function handleEditResource(resource: ResourceResponse) {
    setEditingResource(resource);
    setResourceForm({
      type: resource.type,
      name: resource.name,
      quantity: String(resource.quantity),
    });
    setResourceErrors({});
    setShowResourceForm(true);
  }

  function handleCancelResourceForm() {
    setShowResourceForm(false);
    setEditingResource(null);
    setResourceForm({ type: "", name: "", quantity: "" });
    setResourceErrors({});
  }

  async function handleSubmitResource(e: React.FormEvent, roomId: number) {
    e.preventDefault();
    const errors = validateResourceForm(resourceForm);
    if (Object.keys(errors).length > 0) {
      setResourceErrors(errors);
      return;
    }

    setResourceSubmitting(true);
    setResourceErrors({});

    const payload = {
      type: resourceForm.type.trim(),
      name: resourceForm.name.trim(),
      quantity: parseInt(resourceForm.quantity, 10),
    };

    try {
      if (editingResource) {
        await apiPut(
          `/api/rooms/${roomId}/resources/${editingResource.id}`,
          payload,
        );
      } else {
        await apiPost(`/api/rooms/${roomId}/resources`, payload);
      }
      handleCancelResourceForm();
      await fetchRooms();
    } catch (err: unknown) {
      const apiErr = err as { detail?: string; error_code?: string };
      if (
        apiErr?.error_code === "RESOURCE_DUPLICATE" ||
        apiErr?.detail?.toLowerCase().includes("duplica")
      ) {
        setResourceErrors({
          _general:
            apiErr.detail ||
            "Recurso com mesmo tipo e nome já existe nesta sala.",
        });
      } else {
        setResourceErrors({
          _general: apiErr?.detail || "Erro ao salvar recurso.",
        });
      }
    } finally {
      setResourceSubmitting(false);
    }
  }

  async function handleDeleteResource(roomId: number, resourceId: number) {
    try {
      await apiDelete(`/api/rooms/${roomId}/resources/${resourceId}`);
      await fetchRooms();
    } catch (err: unknown) {
      const apiErr = err as { detail?: string };
      setError(apiErr?.detail || "Erro ao remover recurso.");
    }
  }

  // --- Render ---

  if (loading) {
    return (
      <div style={styles.container}>
        <p>Carregando salas...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Gestão de Salas</h1>
        <button type="button" style={styles.primaryBtn} onClick={handleNewRoom}>
          Nova Sala
        </button>
      </div>

      {error && (
        <p style={styles.errorMsg} role="alert">
          {error}
        </p>
      )}

      {/* Room Form Modal */}
      {showRoomForm && (
        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>
            {editingRoom ? "Editar Sala" : "Nova Sala"}
          </h2>
          <form onSubmit={handleSubmitRoom} style={styles.form}>
            <div style={styles.field}>
              <label htmlFor="room-name" style={styles.label}>
                Nome
              </label>
              <input
                id="room-name"
                type="text"
                value={roomForm.name}
                onChange={(e) =>
                  setRoomForm({ ...roomForm, name: e.target.value })
                }
                style={styles.input}
                placeholder="Nome da sala"
                disabled={roomSubmitting}
                maxLength={100}
              />
              {roomErrors.name && (
                <span style={styles.fieldError}>{roomErrors.name}</span>
              )}
            </div>

            <div style={styles.field}>
              <label htmlFor="room-capacity" style={styles.label}>
                Capacidade
              </label>
              <input
                id="room-capacity"
                type="number"
                value={roomForm.capacity}
                onChange={(e) =>
                  setRoomForm({ ...roomForm, capacity: e.target.value })
                }
                style={styles.input}
                placeholder="1 a 200"
                disabled={roomSubmitting}
                min={1}
                max={200}
              />
              {roomErrors.capacity && (
                <span style={styles.fieldError}>{roomErrors.capacity}</span>
              )}
            </div>

            <div style={styles.field}>
              <label htmlFor="room-location" style={styles.label}>
                Localização
              </label>
              <input
                id="room-location"
                type="text"
                value={roomForm.location}
                onChange={(e) =>
                  setRoomForm({ ...roomForm, location: e.target.value })
                }
                style={styles.input}
                placeholder="Localização da sala"
                disabled={roomSubmitting}
                maxLength={200}
              />
              {roomErrors.location && (
                <span style={styles.fieldError}>{roomErrors.location}</span>
              )}
            </div>

            {roomErrors._general && (
              <p style={styles.fieldError}>{roomErrors._general}</p>
            )}

            <div style={styles.formActions}>
              <button
                type="submit"
                style={styles.primaryBtn}
                disabled={roomSubmitting}
              >
                {roomSubmitting ? "Salvando..." : "Salvar"}
              </button>
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={handleCancelRoomForm}
                disabled={roomSubmitting}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rooms Table */}
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Nome</th>
            <th style={styles.th}>Capacidade</th>
            <th style={styles.th}>Localização</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {rooms.length === 0 ? (
            <tr>
              <td colSpan={5} style={styles.emptyCell}>
                Nenhuma sala cadastrada.
              </td>
            </tr>
          ) : (
            rooms.map((room) => (
              <RoomRow
                key={room.id}
                room={room}
                isExpanded={expandedRoomId === room.id}
                onToggleResources={() => handleToggleResources(room.id)}
                onEdit={() => handleEditRoom(room)}
                onDeactivate={() => handleDeactivateClick(room)}
                onReactivate={() => handleReactivateRoom(room.id)}
                showResourceForm={
                  showResourceForm && expandedRoomId === room.id
                }
                editingResource={
                  expandedRoomId === room.id ? editingResource : null
                }
                resourceForm={resourceForm}
                resourceErrors={resourceErrors}
                resourceSubmitting={resourceSubmitting}
                onNewResource={handleNewResource}
                onEditResource={handleEditResource}
                onDeleteResource={(resourceId) =>
                  handleDeleteResource(room.id, resourceId)
                }
                onCancelResourceForm={handleCancelResourceForm}
                onResourceFormChange={setResourceForm}
                onSubmitResource={(e) => handleSubmitResource(e, room.id)}
              />
            ))
          )}
        </tbody>
      </table>

      {/* Deactivation Confirmation Modal */}
      {deactivatingRoom && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>Confirmar Desativação</h3>
            <p style={styles.modalText}>
              Tem certeza que deseja desativar a sala{" "}
              <strong>{deactivatingRoom.name}</strong>?
            </p>
            <p style={styles.modalWarning}>
              Todas as reservas futuras desta sala serão canceladas.
            </p>
            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.dangerBtn}
                onClick={handleConfirmDeactivation}
                disabled={deactivating}
              >
                {deactivating ? "Desativando..." : "Desativar"}
              </button>
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={handleCancelDeactivation}
                disabled={deactivating}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// --- RoomRow sub-component ---

interface RoomRowProps {
  room: RoomResponse;
  isExpanded: boolean;
  onToggleResources: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  showResourceForm: boolean;
  editingResource: ResourceResponse | null;
  resourceForm: ResourceFormData;
  resourceErrors: FieldErrors;
  resourceSubmitting: boolean;
  onNewResource: () => void;
  onEditResource: (resource: ResourceResponse) => void;
  onDeleteResource: (resourceId: number) => void;
  onCancelResourceForm: () => void;
  onResourceFormChange: (data: ResourceFormData) => void;
  onSubmitResource: (e: React.FormEvent) => void;
}

function RoomRow({
  room,
  isExpanded,
  onToggleResources,
  onEdit,
  onDeactivate,
  onReactivate,
  showResourceForm,
  editingResource,
  resourceForm,
  resourceErrors,
  resourceSubmitting,
  onNewResource,
  onEditResource,
  onDeleteResource,
  onCancelResourceForm,
  onResourceFormChange,
  onSubmitResource,
}: RoomRowProps) {
  return (
    <>
      <tr style={styles.row}>
        <td style={styles.td}>
          <button
            type="button"
            style={styles.linkBtn}
            onClick={onToggleResources}
          >
            {room.name}
          </button>
        </td>
        <td style={styles.td}>{room.capacity}</td>
        <td style={styles.td}>{room.location}</td>
        <td style={styles.td}>
          <span
            style={room.is_active ? styles.badgeActive : styles.badgeInactive}
          >
            {room.is_active ? "Ativa" : "Inativa"}
          </span>
        </td>
        <td style={styles.td}>
          <button type="button" style={styles.actionBtn} onClick={onEdit}>
            Editar
          </button>
          {room.is_active && (
            <button
              type="button"
              style={styles.dangerSmallBtn}
              onClick={onDeactivate}
            >
              Desativar
            </button>
          )}
          {!room.is_active && (
            <button
              type="button"
              style={styles.actionBtn}
              onClick={onReactivate}
            >
              Ativar
            </button>
          )}
        </td>
      </tr>

      {/* Expanded resources section */}
      {isExpanded && (
        <tr>
          <td colSpan={5} style={styles.resourcesCell}>
            <div style={styles.resourcesSection}>
              <div style={styles.resourcesHeader}>
                <h4 style={styles.resourcesTitle}>Recursos da Sala</h4>
                <button
                  type="button"
                  style={styles.smallPrimaryBtn}
                  onClick={onNewResource}
                >
                  Adicionar Recurso
                </button>
              </div>

              {room.resources.length === 0 ? (
                <p style={styles.emptyText}>Nenhum recurso cadastrado.</p>
              ) : (
                <table style={styles.resourceTable}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Tipo</th>
                      <th style={styles.th}>Nome</th>
                      <th style={styles.th}>Quantidade</th>
                      <th style={styles.th}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {room.resources.map((resource) => (
                      <tr key={resource.id}>
                        <td style={styles.td}>{resource.type}</td>
                        <td style={styles.td}>{resource.name}</td>
                        <td style={styles.td}>{resource.quantity}</td>
                        <td style={styles.td}>
                          <button
                            type="button"
                            style={styles.actionBtn}
                            onClick={() => onEditResource(resource)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            style={styles.dangerSmallBtn}
                            onClick={() => onDeleteResource(resource.id)}
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Resource Form */}
              {showResourceForm && (
                <div style={styles.resourceFormCard}>
                  <h5 style={styles.resourceFormTitle}>
                    {editingResource ? "Editar Recurso" : "Novo Recurso"}
                  </h5>
                  <form
                    onSubmit={onSubmitResource}
                    style={styles.resourceFormInline}
                  >
                    <div style={styles.field}>
                      <label htmlFor="resource-type" style={styles.label}>
                        Tipo
                      </label>
                      <input
                        id="resource-type"
                        type="text"
                        value={resourceForm.type}
                        onChange={(e) =>
                          onResourceFormChange({
                            ...resourceForm,
                            type: e.target.value,
                          })
                        }
                        style={styles.input}
                        placeholder="Ex: Equipamento"
                        disabled={resourceSubmitting}
                        maxLength={100}
                      />
                      {resourceErrors.type && (
                        <span style={styles.fieldError}>
                          {resourceErrors.type}
                        </span>
                      )}
                    </div>

                    <div style={styles.field}>
                      <label htmlFor="resource-name" style={styles.label}>
                        Nome
                      </label>
                      <input
                        id="resource-name"
                        type="text"
                        value={resourceForm.name}
                        onChange={(e) =>
                          onResourceFormChange({
                            ...resourceForm,
                            name: e.target.value,
                          })
                        }
                        style={styles.input}
                        placeholder="Ex: Projetor"
                        disabled={resourceSubmitting}
                        maxLength={100}
                      />
                      {resourceErrors.name && (
                        <span style={styles.fieldError}>
                          {resourceErrors.name}
                        </span>
                      )}
                    </div>

                    <div style={styles.field}>
                      <label htmlFor="resource-quantity" style={styles.label}>
                        Quantidade
                      </label>
                      <input
                        id="resource-quantity"
                        type="number"
                        value={resourceForm.quantity}
                        onChange={(e) =>
                          onResourceFormChange({
                            ...resourceForm,
                            quantity: e.target.value,
                          })
                        }
                        style={styles.input}
                        placeholder="1 a 9999"
                        disabled={resourceSubmitting}
                        min={1}
                        max={9999}
                      />
                      {resourceErrors.quantity && (
                        <span style={styles.fieldError}>
                          {resourceErrors.quantity}
                        </span>
                      )}
                    </div>

                    {resourceErrors._general && (
                      <p style={styles.fieldError}>{resourceErrors._general}</p>
                    )}

                    <div style={styles.formActions}>
                      <button
                        type="submit"
                        style={styles.smallPrimaryBtn}
                        disabled={resourceSubmitting}
                      >
                        {resourceSubmitting ? "Salvando..." : "Salvar"}
                      </button>
                      <button
                        type="button"
                        style={styles.secondaryBtn}
                        onClick={onCancelResourceForm}
                        disabled={resourceSubmitting}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
// --- Styles ---

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "1100px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1.5rem",
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "#333",
    margin: 0,
  },
  errorMsg: {
    color: "#d32f2f",
    backgroundColor: "#fdecea",
    padding: "0.75rem 1rem",
    borderRadius: "4px",
    marginBottom: "1rem",
  },
  formCard: {
    backgroundColor: "#f9f9f9",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    padding: "1.5rem",
    marginBottom: "1.5rem",
  },
  formTitle: {
    fontSize: "1.1rem",
    fontWeight: 600,
    marginBottom: "1rem",
    color: "#333",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  label: {
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#333",
  },
  input: {
    padding: "0.5rem 0.75rem",
    fontSize: "0.95rem",
    border: "1px solid #ccc",
    borderRadius: "4px",
    outline: "none",
    maxWidth: "400px",
  },
  fieldError: {
    color: "#d32f2f",
    fontSize: "0.8rem",
    marginTop: "0.125rem",
  },
  formActions: {
    display: "flex",
    gap: "0.75rem",
    marginTop: "0.5rem",
  },
  primaryBtn: {
    padding: "0.5rem 1.25rem",
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "#fff",
    backgroundColor: "#00A693",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "0.5rem 1.25rem",
    fontSize: "0.9rem",
    fontWeight: 500,
    color: "#333",
    backgroundColor: "#e0e0e0",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  dangerBtn: {
    padding: "0.5rem 1.25rem",
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "#fff",
    backgroundColor: "#d32f2f",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  smallPrimaryBtn: {
    padding: "0.375rem 0.875rem",
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "#fff",
    backgroundColor: "#00A693",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  actionBtn: {
    padding: "0.25rem 0.625rem",
    fontSize: "0.8rem",
    fontWeight: 500,
    color: "#00A693",
    backgroundColor: "transparent",
    border: "1px solid #00A693",
    borderRadius: "4px",
    cursor: "pointer",
    marginRight: "0.5rem",
  },
  dangerSmallBtn: {
    padding: "0.25rem 0.625rem",
    fontSize: "0.8rem",
    fontWeight: 500,
    color: "#d32f2f",
    backgroundColor: "transparent",
    border: "1px solid #d32f2f",
    borderRadius: "4px",
    cursor: "pointer",
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#00A693",
    cursor: "pointer",
    fontWeight: 500,
    fontSize: "0.9rem",
    padding: 0,
    textDecoration: "underline",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    backgroundColor: "#fff",
    borderRadius: "8px",
    overflow: "hidden",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  th: {
    textAlign: "left",
    padding: "0.75rem 1rem",
    backgroundColor: "#f5f5f5",
    fontWeight: 600,
    fontSize: "0.85rem",
    color: "#555",
    borderBottom: "1px solid #e0e0e0",
  },
  td: {
    padding: "0.75rem 1rem",
    fontSize: "0.9rem",
    borderBottom: "1px solid #f0f0f0",
    verticalAlign: "middle",
  },
  row: {
    transition: "background-color 0.15s",
  },
  emptyCell: {
    padding: "2rem",
    textAlign: "center",
    color: "#888",
    fontSize: "0.9rem",
  },
  badgeActive: {
    display: "inline-block",
    padding: "0.2rem 0.6rem",
    fontSize: "0.75rem",
    fontWeight: 600,
    borderRadius: "12px",
    backgroundColor: "#e8f5e9",
    color: "#2e7d32",
  },
  badgeInactive: {
    display: "inline-block",
    padding: "0.2rem 0.6rem",
    fontSize: "0.75rem",
    fontWeight: 600,
    borderRadius: "12px",
    backgroundColor: "#fce4ec",
    color: "#c62828",
  },
  resourcesCell: {
    padding: "0",
    backgroundColor: "#fafafa",
  },
  resourcesSection: {
    padding: "1rem 1.5rem",
    borderTop: "1px solid #e0e0e0",
  },
  resourcesHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.75rem",
  },
  resourcesTitle: {
    fontSize: "0.95rem",
    fontWeight: 600,
    color: "#333",
    margin: 0,
  },
  resourceTable: {
    width: "100%",
    borderCollapse: "collapse",
    marginBottom: "0.75rem",
  },
  emptyText: {
    color: "#888",
    fontSize: "0.85rem",
    fontStyle: "italic",
  },
  resourceFormCard: {
    marginTop: "1rem",
    padding: "1rem",
    backgroundColor: "#fff",
    border: "1px solid #e0e0e0",
    borderRadius: "6px",
  },
  resourceFormTitle: {
    fontSize: "0.9rem",
    fontWeight: 600,
    marginBottom: "0.75rem",
    color: "#333",
  },
  resourceFormInline: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  // Modal styles
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: "8px",
    padding: "2rem",
    maxWidth: "450px",
    width: "90%",
    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
  },
  modalTitle: {
    fontSize: "1.1rem",
    fontWeight: 700,
    color: "#333",
    marginBottom: "0.75rem",
  },
  modalText: {
    fontSize: "0.9rem",
    color: "#555",
    marginBottom: "0.5rem",
  },
  modalWarning: {
    fontSize: "0.85rem",
    color: "#d32f2f",
    fontWeight: 500,
    marginBottom: "1.5rem",
  },
  modalActions: {
    display: "flex",
    gap: "0.75rem",
  },
};
