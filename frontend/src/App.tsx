import { Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import RoomsPage from "./pages/RoomsPage";
import RoomDetailPage from "./pages/RoomDetailPage";
import ReservationsPage from "./pages/ReservationsPage";
import ReservationFormPage from "./pages/ReservationFormPage";
import HistoryPage from "./pages/HistoryPage";
import UsersPage from "./pages/UsersPage";
import RoomManagementPage from "./pages/RoomManagementPage";
import ReportsPage from "./pages/ReportsPage";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";

/**
 * Layout para páginas protegidas: Navbar no topo + conteúdo abaixo.
 */
function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main style={{ padding: "1.5rem" }}>{children}</main>
    </>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Rotas acessíveis a todos os usuários autenticados */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <DashboardPage />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/rooms"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <RoomsPage />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/rooms/:id"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <RoomDetailPage />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reservations"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <ReservationsPage />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reservations/new"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <ReservationFormPage />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <HistoryPage />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />

      {/* Rotas exclusivas do Administrador */}
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute requiredRole="admin">
            <ProtectedLayout>
              <UsersPage />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/rooms"
        element={
          <ProtectedRoute requiredRole="admin">
            <ProtectedLayout>
              <RoomManagementPage />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute requiredRole="admin">
            <ProtectedLayout>
              <ReportsPage />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
