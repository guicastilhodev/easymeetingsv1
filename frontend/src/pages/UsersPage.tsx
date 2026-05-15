import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost, apiPut, apiPatch } from "../services/api";

// --- Types ---

interface UserResponse {
  id: number;
  name: string;
  login: string;
  role: string;
  is_active: boolean;
}

interface UserFormData {
  name: string;
  login: string;
  password: string;
  role: "admin" | "scheduler";
}

interface FieldErrors {
  name?: string;
  login?: string;
  password?: string;
  role?: string;
  general?: string;
}

// --- Constants ---

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  scheduler: "Responsável pelo Agendamento",
};

const ITEMS_PER_PAGE = 10;

// --- Component ---

export default function UsersPage() {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    name: "",
    login: "",
    password: "",
    role: "scheduler",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] =
    useState<UserResponse | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<UserResponse[]>("/api/users");
      setUsers(data);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // --- Pagination ---

  const totalPages = Math.max(1, Math.ceil(users.length / ITEMS_PER_PAGE));
  const paginatedUsers = users.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // --- Form Handlers ---

  function openCreateForm() {
    setEditingUser(null);
    setFormData({ name: "", login: "", password: "", role: "scheduler" });
    setFieldErrors({});
    setShowForm(true);
  }

  function openEditForm(user: UserResponse) {
    setEditingUser(user);
    setFormData({
      name: user.name,
      login: user.login,
      password: "",
      role: user.role as "admin" | "scheduler",
    });
    setFieldErrors({});
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingUser(null);
    setFieldErrors({});
  }

  function validateForm(): FieldErrors {
    const errors: FieldErrors = {};

    if (!formData.name.trim() || formData.name.trim().length > 100) {
      errors.name = "Nome deve ter entre 1 e 100 caracteres.";
    }

    if (!editingUser) {
      if (
        formData.login.trim().length < 3 ||
        formData.login.trim().length > 50
      ) {
        errors.login = "Login deve ter entre 3 e 50 caracteres.";
      }
    }

    if (!editingUser) {
      if (formData.password.length < 8 || formData.password.length > 128) {
        errors.password = "Senha deve ter entre 8 e 128 caracteres.";
      }
    } else if (formData.password) {
      if (formData.password.length < 8 || formData.password.length > 128) {
        errors.password = "Senha deve ter entre 8 e 128 caracteres.";
      }
    }

    if (!["admin", "scheduler"].includes(formData.role)) {
      errors.role = "Perfil inválido.";
    }

    return errors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);

    try {
      if (editingUser) {
        const body: Record<string, string> = {
          name: formData.name.trim(),
          role: formData.role,
        };
        if (formData.password) {
          body.password = formData.password;
        }
        await apiPut<UserResponse>(`/api/users/${editingUser.id}`, body);
      } else {
        await apiPost<UserResponse>("/api/users", {
          name: formData.name.trim(),
          login: formData.login.trim(),
          password: formData.password,
          role: formData.role,
        });
      }
      closeForm();
      await fetchUsers();
    } catch (err: unknown) {
      const apiError = err as {
        detail?: string;
        error_code?: string;
        fields?: string[];
      };
      if (
        apiError?.error_code === "USER_LOGIN_DUPLICATE" ||
        apiError?.detail?.toLowerCase().includes("login")
      ) {
        setFieldErrors({ login: apiError.detail || "Login já está em uso." });
      } else if (apiError?.detail) {
        setFieldErrors({ general: apiError.detail });
      } else {
        setFieldErrors({ general: "Erro inesperado. Tente novamente." });
      }
    } finally {
      setSubmitting(false);
    }
  }

  // --- Deactivation ---

  async function handleDeactivate() {
    if (!confirmDeactivate) return;
    setDeactivating(true);
    try {
      await apiPatch<void>(`/api/users/${confirmDeactivate.id}/deactivate`);
      setConfirmDeactivate(null);
      await fetchUsers();
    } catch (err: unknown) {
      const apiError = err as { detail?: string };
      alert(apiError?.detail || "Erro ao desativar usuário.");
      setConfirmDeactivate(null);
    } finally {
      setDeactivating(false);
    }
  }

  async function handleReactivateUser(userId: number) {
    try {
      await apiPatch<void>(`/api/users/${userId}/reactivate`);
      await fetchUsers();
    } catch (err: unknown) {
      const apiError = err as { detail?: string };
      alert(apiError?.detail || "Erro ao reativar usuário.");
    }
  }

  // --- Render ---

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Gestão de Usuários</h1>
        <button
          type="button"
          style={styles.primaryButton}
          onClick={openCreateForm}
        >
          Novo Usuário
        </button>
      </div>

      {loading ? (
        <p style={styles.loadingText}>Carregando...</p>
      ) : (
        <>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Nome</th>
                  <th style={styles.th}>Login</th>
                  <th style={styles.th}>Perfil</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={styles.emptyCell}>
                      Nenhum usuário cadastrado.
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => (
                    <tr key={user.id} style={styles.tr}>
                      <td style={styles.td}>{user.name}</td>
                      <td style={styles.td}>{user.login}</td>
                      <td style={styles.td}>
                        {ROLE_LABELS[user.role] || user.role}
                      </td>
                      <td style={styles.td}>
                        <span
                          style={
                            user.is_active
                              ? styles.badgeActive
                              : styles.badgeInactive
                          }
                        >
                          {user.is_active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <button
                          type="button"
                          style={styles.actionButton}
                          onClick={() => openEditForm(user)}
                          title="Editar usuário"
                        >
                          Editar
                        </button>
                        {user.is_active && (
                          <button
                            type="button"
                            style={styles.dangerButton}
                            onClick={() => setConfirmDeactivate(user)}
                            title="Desativar usuário"
                          >
                            Desativar
                          </button>
                        )}
                        {!user.is_active && (
                          <button
                            type="button"
                            style={styles.actionButton}
                            onClick={() => handleReactivateUser(user.id)}
                            title="Ativar usuário"
                          >
                            Ativar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={styles.pagination}>
              <button
                type="button"
                style={styles.pageButton}
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                Anterior
              </button>
              <span style={styles.pageInfo}>
                Página {currentPage} de {totalPages}
              </span>
              <button
                type="button"
                style={styles.pageButton}
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}

      {/* User Form Modal */}
      {showForm && (
        <div style={styles.overlay} onClick={closeForm}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>
              {editingUser ? "Editar Usuário" : "Novo Usuário"}
            </h2>

            {fieldErrors.general && (
              <p style={styles.errorBanner} role="alert">
                {fieldErrors.general}
              </p>
            )}

            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.field}>
                <label htmlFor="user-name" style={styles.label}>
                  Nome
                </label>
                <input
                  id="user-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  style={
                    fieldErrors.name
                      ? { ...styles.input, ...styles.inputError }
                      : styles.input
                  }
                  placeholder="Nome do usuário"
                  disabled={submitting}
                  maxLength={100}
                />
                {fieldErrors.name && (
                  <span style={styles.fieldError}>{fieldErrors.name}</span>
                )}
              </div>

              <div style={styles.field}>
                <label htmlFor="user-login" style={styles.label}>
                  Login
                </label>
                <input
                  id="user-login"
                  type="text"
                  value={formData.login}
                  onChange={(e) =>
                    setFormData({ ...formData, login: e.target.value })
                  }
                  style={
                    fieldErrors.login
                      ? { ...styles.input, ...styles.inputError }
                      : styles.input
                  }
                  placeholder="Login do usuário"
                  disabled={submitting || !!editingUser}
                  maxLength={50}
                />
                {fieldErrors.login && (
                  <span style={styles.fieldError}>{fieldErrors.login}</span>
                )}
              </div>

              <div style={styles.field}>
                <label htmlFor="user-password" style={styles.label}>
                  Senha{editingUser ? " (deixe vazio para manter)" : ""}
                </label>
                <input
                  id="user-password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  style={
                    fieldErrors.password
                      ? { ...styles.input, ...styles.inputError }
                      : styles.input
                  }
                  placeholder={
                    editingUser ? "Nova senha (opcional)" : "Senha do usuário"
                  }
                  disabled={submitting}
                  maxLength={128}
                  autoComplete="new-password"
                />
                {fieldErrors.password && (
                  <span style={styles.fieldError}>{fieldErrors.password}</span>
                )}
              </div>

              <div style={styles.field}>
                <label htmlFor="user-role" style={styles.label}>
                  Perfil
                </label>
                <select
                  id="user-role"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as "admin" | "scheduler",
                    })
                  }
                  style={
                    fieldErrors.role
                      ? { ...styles.input, ...styles.inputError }
                      : styles.input
                  }
                  disabled={submitting}
                >
                  <option value="admin">Administrador</option>
                  <option value="scheduler">
                    Responsável pelo Agendamento
                  </option>
                </select>
                {fieldErrors.role && (
                  <span style={styles.fieldError}>{fieldErrors.role}</span>
                )}
              </div>

              <div style={styles.formActions}>
                <button
                  type="button"
                  style={styles.cancelButton}
                  onClick={closeForm}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={styles.primaryButton}
                  disabled={submitting}
                >
                  {submitting ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivation Confirmation Modal */}
      {confirmDeactivate && (
        <div
          style={styles.overlay}
          onClick={() => !deactivating && setConfirmDeactivate(null)}
        >
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Confirmar Desativação</h2>
            <p style={styles.confirmText}>
              Tem certeza que deseja desativar o usuário{" "}
              <strong>{confirmDeactivate.name}</strong> (
              {confirmDeactivate.login})?
            </p>
            <p style={styles.confirmWarning}>
              O usuário não poderá mais acessar o sistema após a desativação.
            </p>
            <div style={styles.formActions}>
              <button
                type="button"
                style={styles.cancelButton}
                onClick={() => setConfirmDeactivate(null)}
                disabled={deactivating}
              >
                Cancelar
              </button>
              <button
                type="button"
                style={styles.dangerButtonLarge}
                onClick={handleDeactivate}
                disabled={deactivating}
              >
                {deactivating ? "Desativando..." : "Desativar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
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
  loadingText: {
    textAlign: "center",
    color: "#666",
    padding: "2rem 0",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    backgroundColor: "#fff",
    borderRadius: "8px",
    overflow: "hidden",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  },
  th: {
    textAlign: "left",
    padding: "0.75rem 1rem",
    backgroundColor: "#f5f7fa",
    fontWeight: 600,
    fontSize: "0.85rem",
    color: "#555",
    borderBottom: "1px solid #e0e0e0",
  },
  tr: {
    borderBottom: "1px solid #f0f0f0",
  },
  td: {
    padding: "0.75rem 1rem",
    fontSize: "0.9rem",
    color: "#333",
    verticalAlign: "middle",
  },
  emptyCell: {
    padding: "2rem 1rem",
    textAlign: "center",
    color: "#999",
  },
  badgeActive: {
    display: "inline-block",
    padding: "0.2rem 0.6rem",
    borderRadius: "12px",
    fontSize: "0.75rem",
    fontWeight: 600,
    backgroundColor: "#e8f5e9",
    color: "#2e7d32",
  },
  badgeInactive: {
    display: "inline-block",
    padding: "0.2rem 0.6rem",
    borderRadius: "12px",
    fontSize: "0.75rem",
    fontWeight: 600,
    backgroundColor: "#fbe9e7",
    color: "#c62828",
  },
  actionButton: {
    padding: "0.35rem 0.75rem",
    fontSize: "0.8rem",
    fontWeight: 500,
    color: "#00A693",
    backgroundColor: "transparent",
    border: "1px solid #00A693",
    borderRadius: "4px",
    cursor: "pointer",
    marginRight: "0.5rem",
  },
  dangerButton: {
    padding: "0.35rem 0.75rem",
    fontSize: "0.8rem",
    fontWeight: 500,
    color: "#d32f2f",
    backgroundColor: "transparent",
    border: "1px solid #d32f2f",
    borderRadius: "4px",
    cursor: "pointer",
  },
  dangerButtonLarge: {
    padding: "0.6rem 1.25rem",
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "#fff",
    backgroundColor: "#d32f2f",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  primaryButton: {
    padding: "0.6rem 1.25rem",
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "#fff",
    backgroundColor: "#00A693",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  cancelButton: {
    padding: "0.6rem 1.25rem",
    fontSize: "0.9rem",
    fontWeight: 500,
    color: "#666",
    backgroundColor: "#f5f5f5",
    border: "1px solid #ddd",
    borderRadius: "4px",
    cursor: "pointer",
  },
  pagination: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "1rem",
    marginTop: "1.25rem",
  },
  pageButton: {
    padding: "0.4rem 0.9rem",
    fontSize: "0.85rem",
    fontWeight: 500,
    color: "#00A693",
    backgroundColor: "#fff",
    border: "1px solid #00A693",
    borderRadius: "4px",
    cursor: "pointer",
  },
  pageInfo: {
    fontSize: "0.85rem",
    color: "#666",
  },
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: "8px",
    padding: "2rem",
    width: "100%",
    maxWidth: "480px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
  },
  modalTitle: {
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "#333",
    marginTop: 0,
    marginBottom: "1.25rem",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "0.3rem",
  },
  label: {
    fontSize: "0.85rem",
    fontWeight: 500,
    color: "#333",
  },
  input: {
    padding: "0.6rem 0.75rem",
    fontSize: "0.95rem",
    border: "1px solid #ccc",
    borderRadius: "4px",
    outline: "none",
  },
  inputError: {
    borderColor: "#d32f2f",
  },
  fieldError: {
    fontSize: "0.8rem",
    color: "#d32f2f",
  },
  errorBanner: {
    padding: "0.75rem 1rem",
    backgroundColor: "#fbe9e7",
    color: "#c62828",
    borderRadius: "4px",
    fontSize: "0.85rem",
    marginBottom: "0.75rem",
  },
  formActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
    marginTop: "0.75rem",
  },
  confirmText: {
    fontSize: "0.95rem",
    color: "#333",
    marginBottom: "0.5rem",
  },
  confirmWarning: {
    fontSize: "0.85rem",
    color: "#666",
    marginBottom: "1rem",
  },
};
