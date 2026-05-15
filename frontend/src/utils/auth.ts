const TOKEN_KEY = "easymeetings_token";

export interface TokenPayload {
  id: number;
  login: string;
  role: string;
  exp?: number;
}

/**
 * Recupera o token JWT do localStorage.
 */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Armazena o token JWT no localStorage.
 */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Remove o token JWT do localStorage.
 */
export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Verifica se existe um token armazenado (usuário autenticado).
 */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}

/**
 * Decodifica o payload do JWT (sem verificação de assinatura).
 * Retorna null se o token for inválido ou não existir.
 */
export function getUserFromToken(): TokenPayload | null {
  const token = getToken();
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const parsed = JSON.parse(decoded);

    return {
      id: Number(parsed.id ?? parsed.sub),
      login: parsed.login,
      role: parsed.role,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}
