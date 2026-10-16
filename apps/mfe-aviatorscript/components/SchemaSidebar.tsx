"use client";

import { Database, GripVertical, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { SchemaField } from "../lib/types";

type SchemaSidebarProps = {
  fields: SchemaField[];
  open: boolean;
  onClose: () => void;
  onInsert: (field: SchemaField) => void;
};

export function SchemaSidebar({ fields, open, onClose, onInsert }: SchemaSidebarProps) {
  const [search, setSearch] = useState("");
  const visibleFields = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return fields;
    return fields.filter((field) => `${field.key} ${field.label} ${field.description ?? ""}`.toLowerCase().includes(query));
  }, [fields, search]);

  return (
    <aside aria-label="Esquema de variables" className={`schema-sidebar ${open ? "is-open" : ""}`}>
      <div className="sidebar-heading">
        <div>
          <span className="eyebrow"><Database size={14} /> Contexto JVM</span>
          <h2>Variables disponibles</h2>
        </div>
        <button className="icon-button sidebar-close" onClick={onClose} title="Cerrar variables" type="button">
          <X size={17} />
        </button>
      </div>
      <p className="sidebar-description">Arrastra una variable o insertala en la condicion activa.</p>
      <label className="search-field">
        <Search size={16} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar variable" />
      </label>
      <div className="schema-list">
        {visibleFields.map((field) => (
          <button
            className="schema-field"
            draggable
            key={field.key}
            onClick={() => onInsert(field)}
            onDragStart={(event) => event.dataTransfer.setData("application/x-rule-field", field.key)}
            title={`Insertar ${field.label}`}
            type="button"
          >
            <GripVertical className="drag-handle" size={15} />
            <span className="schema-field-copy">
              <strong>{field.label}</strong>
              <code>{field.key}</code>
            </span>
            <span className="type-badge">{field.type}</span>
          </button>
        ))}
        {visibleFields.length === 0 && <p className="empty-state">No encontramos variables con ese texto.</p>}
      </div>
      <div className="schema-note">
        <strong>Contrato de contexto</strong>
        <span>Estas claves representan los datos que la JVM entregara al motor.</span>
      </div>
    </aside>
  );
}
