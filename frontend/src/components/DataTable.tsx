import type { CSSProperties, ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

/**
 * Componente de tabela genérico e reutilizável.
 * Renderiza uma tabela estilizada com headers e linhas de dados.
 */
export default function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  onRowClick,
  emptyMessage = "Nenhum dado encontrado.",
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <p style={styles.empty}>{emptyMessage}</p>;
  }

  return (
    <div style={styles.wrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={styles.th}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              style={{
                ...styles.tr,
                ...(onRowClick ? styles.clickableRow : {}),
              }}
              onClick={() => onRowClick?.(row)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && onRowClick) {
                  e.preventDefault();
                  onRowClick(row);
                }
              }}
              tabIndex={onRowClick ? 0 : undefined}
              role={onRowClick ? "button" : undefined}
            >
              {columns.map((col) => (
                <td key={col.key} style={styles.td}>
                  {col.render ? col.render(row) : String(row[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "0.875rem",
  },
  th: {
    textAlign: "left",
    padding: "0.75rem 1rem",
    borderBottom: "2px solid #e0e0e0",
    fontWeight: 600,
    color: "#333",
    backgroundColor: "#f9f9f9",
  },
  td: {
    padding: "0.75rem 1rem",
    borderBottom: "1px solid #eee",
    color: "#555",
  },
  tr: {
    transition: "background-color 0.15s",
  },
  clickableRow: {
    cursor: "pointer",
  },
  empty: {
    textAlign: "center",
    color: "#888",
    padding: "2rem 0",
    fontSize: "0.9rem",
  },
};
