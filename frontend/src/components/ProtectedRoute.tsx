import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { isAuthenticated, getUserFromToken } from "../utils/auth";

interface ProtectedRouteProps {
  children?: ReactNode;
  requiredRole?: "admin";
}

/**
 * Componente que protege rotas verificando autenticação e perfil.
 * Redireciona para /login se não autenticado.
 * Redireciona para / se o perfil não atende ao requiredRole.
 */
export default function ProtectedRoute({
  children,
  requiredRole,
}: ProtectedRouteProps) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  const user = getUserFromToken();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
