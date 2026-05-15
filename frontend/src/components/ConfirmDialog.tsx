import type { CSSProperties } from "react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

/**
 * Modal de confirmação genérico para ações destrutivas.
 * Renderiza um overlay com caixa de diálogo centralizada.
 */
export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      style={styles.overlay}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      <div
        style={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
      >
        <h2 id="confirm-dialog-title" style={styles.title}>
          {title}
        </h2>
        <p id="confirm-dialog-message" style={styles.message}>
          {message}
        </p>
        <div style={styles.actions}>
          <button
            type="button"
            style={styles.cancelButton}
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            style={styles.confirmButton}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Processando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
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
  dialog: {
    backgroundColor: "#fff",
    borderRadius: "8px",
    padding: "1.5rem 2rem",
    maxWidth: "420px",
    width: "90%",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
  },
  title: {
    margin: "0 0 0.75rem 0",
    fontSize: "1.2rem",
    fontWeight: 600,
    color: "#333",
  },
  message: {
    margin: "0 0 1.5rem 0",
    fontSize: "0.9rem",
    color: "#555",
    lineHeight: 1.5,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
  },
  cancelButton: {
    padding: "0.5rem 1rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#555",
    backgroundColor: "#f5f5f5",
    border: "1px solid #ddd",
    borderRadius: "4px",
    cursor: "pointer",
  },
  confirmButton: {
    padding: "0.5rem 1rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#fff",
    backgroundColor: "#c62828",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
};
