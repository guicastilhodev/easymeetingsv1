import { NavLink, useNavigate } from "react-router-dom";
import { getUserFromToken, removeToken } from "../utils/auth";
import "./Navbar.css";

/**
 * Barra de navegação principal com itens condicionais por perfil.
 * Itens de admin são ocultados para Responsavel_Agendamento.
 */
export default function Navbar() {
  const navigate = useNavigate();
  const user = getUserFromToken();

  const isAdmin = user?.role === "admin";

  function handleLogout() {
    removeToken();
    navigate("/login");
  }

  return (
    <nav className="navbar" aria-label="Navegação principal">
      <div className="navbar-brand">
        <NavLink to="/" className="navbar-logo">
          EasyMeetings
        </NavLink>
      </div>

      <ul className="navbar-links">
        <li>
          <NavLink to="/" end>
            Dashboard
          </NavLink>
        </li>
        <li>
          <NavLink to="/rooms">Salas</NavLink>
        </li>
        <li>
          <NavLink to="/reservations">Reservas</NavLink>
        </li>
        <li>
          <NavLink to="/history">Histórico</NavLink>
        </li>
        {isAdmin && (
          <>
            <li>
              <NavLink to="/admin/users">Usuários</NavLink>
            </li>
            <li>
              <NavLink to="/admin/rooms">Gestão de Salas</NavLink>
            </li>
            <li>
              <NavLink to="/admin/reports">Relatórios</NavLink>
            </li>
          </>
        )}
      </ul>

      <div className="navbar-user">
        <span className="navbar-username">{user?.login ?? "Usuário"}</span>
        <button
          type="button"
          className="navbar-logout-btn"
          onClick={handleLogout}
        >
          Sair
        </button>
      </div>
    </nav>
  );
}
