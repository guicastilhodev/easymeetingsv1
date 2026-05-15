import { getToken, removeToken } from "../utils/auth";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface RequestOptions {
  method: string;
  headers: Record<string, string>;
  body?: string;
}

/**
 * Monta os headers padrão, incluindo Authorization se houver token.
 */
function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Trata a resposta HTTP. Em caso de 401, limpa o token e redireciona para /login.
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    removeToken();
    window.location.href = "/login";
    throw new Error("Sessão expirada. Redirecionando para login.");
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      detail: "Erro inesperado no servidor.",
    }));
    throw error;
  }

  // Respostas 204 (No Content) não possuem body
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

/**
 * Realiza uma requisição GET.
 */
export async function apiGet<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  let url = `${BASE_URL}${path}`;

  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const options: RequestOptions = {
    method: "GET",
    headers: buildHeaders(),
  };

  const response = await fetch(url, options);
  return handleResponse<T>(response);
}

/**
 * Realiza uma requisição POST.
 */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const options: RequestOptions = {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(body),
  };

  const response = await fetch(`${BASE_URL}${path}`, options);
  return handleResponse<T>(response);
}

/**
 * Realiza uma requisição PUT.
 */
export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const options: RequestOptions = {
    method: "PUT",
    headers: buildHeaders(),
    body: JSON.stringify(body),
  };

  const response = await fetch(`${BASE_URL}${path}`, options);
  return handleResponse<T>(response);
}

/**
 * Realiza uma requisição PATCH.
 */
export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const options: RequestOptions = {
    method: "PATCH",
    headers: buildHeaders(),
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, options);
  return handleResponse<T>(response);
}

/**
 * Realiza uma requisição DELETE.
 */
export async function apiDelete<T>(path: string): Promise<T> {
  const options: RequestOptions = {
    method: "DELETE",
    headers: buildHeaders(),
  };

  const response = await fetch(`${BASE_URL}${path}`, options);
  return handleResponse<T>(response);
}
