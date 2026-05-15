import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { setToken, isAuthenticated } from "../utils/auth";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface LoginResponse {
  access_token: string;
  token_type: string;
  user: {
    id: number;
    name: string;
    login: string;
    role: string;
    is_active: boolean;
  };
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!login.trim() || !password) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: login.trim(), password }),
      });

      if (!response.ok) {
        const apiError = await response.json().catch(() => ({
          detail: "Erro inesperado no servidor.",
        }));
        throw apiError;
      }

      const data = (await response.json()) as LoginResponse;
      setToken(data.access_token);
      navigate("/", { replace: true });
    } catch (err: unknown) {
      const apiError = err as { detail?: string };
      if (apiError?.detail) {
        setError(apiError.detail);
      } else {
        setError("Erro inesperado. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>EasyMeetings</h1>
        <p style={styles.subtitle}>Sistema de Gestão de Salas</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label htmlFor="login" style={styles.label}>
              Login
            </label>
            <input
              id="login"
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              style={styles.input}
              placeholder="Digite seu login"
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div style={styles.field}>
            <label htmlFor="password" style={styles.label}>
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>

          {error && (
            <p style={styles.error} role="alert">
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    padding: "1rem",
  },
  card: {
    width: "100%",
    maxWidth: "400px",
    padding: "2.5rem 2rem",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
  },
  title: {
    fontSize: "1.75rem",
    fontWeight: 700,
    textAlign: "center" as const,
    color: "#002734",
    marginBottom: "0.25rem",
  },
  subtitle: {
    fontSize: "0.9rem",
    textAlign: "center" as const,
    color: "#666",
    marginBottom: "2rem",
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
  button: {
    padding: "0.75rem",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#fff",
    backgroundColor: "#00A693",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    marginTop: "0.5rem",
  },
  error: {
    color: "#d32f2f",
    fontSize: "0.875rem",
    textAlign: "center" as const,
    margin: 0,
  },
};
