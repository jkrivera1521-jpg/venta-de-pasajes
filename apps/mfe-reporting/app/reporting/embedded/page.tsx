"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef
} from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download, RefreshCcw, Search, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Money = {
  amount: number | string;
  currency: string;
};

type SalesSummary = {
  ticketsSold: number;
  ticketsCancelled: number;
  grossAmount: Money;
  netAmount: Money;
};

type SaleRow = {
  ticketNumber: string;
  soldAt: string;
  passengerName: string;
  documentNumber: string;
  busCode: string;
  origin: string;
  destination: string;
  seatNumber: number;
  amount: Money;
  status: string;
};

type SalesReport = {
  summary: SalesSummary;
  rows: SaleRow[];
};

type PassengerSaleRow = {
  passengerName: string;
  documentNumber: string;
  ticketNumber: string;
  departureAt: string;
  busCode: string;
  seatNumber: number;
};

type SalesByUserRow = {
  userId: string;
  userDisplayName: string;
  ticketsSold: number;
  netAmount: Money;
};

type SalesGroupRow = {
  groupKey: string;
  groupLabel: string;
  ticketsSold: number;
  netAmount: Money;
};

type ActiveReport = "sales" | "passengers" | "users" | "bus";

type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

function todayInputValue() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function buildQueryString(dateFrom: string, dateTo: string, extra?: Record<string, string>) {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  Object.entries(extra ?? {}).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

async function apiRequest<T>(path: string): Promise<T> {
  const response = await fetch(`/api/reporting${path}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function formatCurrency(money?: Money) {
  if (!money) return "-";
  const amount = Number(money.amount);
  if (Number.isNaN(amount)) return `${money.amount} ${money.currency}`;
  return new Intl.NumberFormat("es-EC", {
    currency: money.currency || "USD",
    style: "currency"
  }).format(amount);
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function escapeCsvValue(value: string | number | null | undefined) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]) {
  const csv = [
    columns.map((column) => escapeCsvValue(column.header)).join(","),
    ...rows.map((row) => columns.map((column) => escapeCsvValue(column.value(row))).join(","))
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function DataTable<T>({
  columns,
  data,
  emptyMessage
}: Readonly<{
  columns: ColumnDef<T>[];
  data: T[];
  emptyMessage: string;
}>) {
  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel()
  });

  if (data.length === 0) {
    return (
      <div className="empty-state">
        <Search size={20} aria-hidden="true" />
        <span>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportingEmbeddedPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeReport, setActiveReport] = useState<ActiveReport>("sales");
  const [passengerQuery, setPassengerQuery] = useState("");
  const [groupBy, setGroupBy] = useState("bus");

  useEffect(() => {
    const today = todayInputValue();
    setDateFrom(today);
    setDateTo(today);
  }, []);

  useEffect(() => {
    const publishHeight = () => {
      window.parent.postMessage(
        {
          height: document.body.scrollHeight,
          name: "mfe-reporting",
          type: "mfe:height"
        },
        "*"
      );
    };

    publishHeight();
    const observer = new ResizeObserver(publishHeight);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  const dateQuery = buildQueryString(dateFrom, dateTo);
  const passengersQuery = buildQueryString(dateFrom, dateTo, { q: passengerQuery });
  const groupedQuery = buildQueryString(dateFrom, dateTo, { group_by: groupBy });

  const salesReport = useQuery({
    queryFn: () => apiRequest<SalesReport>(`/reports/sales${dateQuery}`),
    queryKey: ["reporting", "sales", dateFrom, dateTo]
  });

  const passengersReport = useQuery({
    queryFn: () => apiRequest<PassengerSaleRow[]>(`/reports/passengers${passengersQuery}`),
    queryKey: ["reporting", "passengers", dateFrom, dateTo, passengerQuery]
  });

  const usersReport = useQuery({
    queryFn: () => apiRequest<SalesByUserRow[]>(`/reports/sales/by-user${dateQuery}`),
    queryKey: ["reporting", "users", dateFrom, dateTo]
  });

  const busReport = useQuery({
    queryFn: () => apiRequest<SalesGroupRow[]>(`/reports/sales/by-bus${groupedQuery}`),
    queryKey: ["reporting", "bus", dateFrom, dateTo, groupBy]
  });

  const salesColumns = useMemo<ColumnDef<SaleRow>[]>(
    () => [
      { accessorKey: "ticketNumber", header: "Boleto" },
      { accessorKey: "passengerName", header: "Pasajero" },
      { accessorKey: "documentNumber", header: "Documento" },
      { accessorKey: "busCode", header: "Bus" },
      { accessorFn: (row) => `${row.origin} - ${row.destination}`, header: "Ruta" },
      { accessorKey: "seatNumber", header: "Asiento" },
      { cell: ({ row }) => formatCurrency(row.original.amount), header: "Monto" },
      { cell: ({ row }) => formatDateTime(row.original.soldAt), header: "Vendido" },
      { accessorKey: "status", header: "Estado" }
    ],
    []
  );

  const passengerColumns = useMemo<ColumnDef<PassengerSaleRow>[]>(
    () => [
      { accessorKey: "passengerName", header: "Pasajero" },
      { accessorKey: "documentNumber", header: "Documento" },
      { accessorKey: "ticketNumber", header: "Boleto" },
      { accessorKey: "busCode", header: "Bus" },
      { accessorKey: "seatNumber", header: "Asiento" },
      { cell: ({ row }) => formatDateTime(row.original.departureAt), header: "Salida" }
    ],
    []
  );

  const userColumns = useMemo<ColumnDef<SalesByUserRow>[]>(
    () => [
      { accessorKey: "userDisplayName", header: "Usuario" },
      { accessorKey: "ticketsSold", header: "Boletos" },
      { cell: ({ row }) => formatCurrency(row.original.netAmount), header: "Neto" }
    ],
    []
  );

  const groupColumns = useMemo<ColumnDef<SalesGroupRow>[]>(
    () => [
      { accessorKey: "groupLabel", header: "Grupo" },
      { accessorKey: "ticketsSold", header: "Boletos" },
      { cell: ({ row }) => formatCurrency(row.original.netAmount), header: "Neto" },
      { accessorKey: "groupKey", header: "Clave" }
    ],
    []
  );

  const summary = salesReport.data?.summary;
  const activeError =
    activeReport === "sales"
      ? salesReport.error
      : activeReport === "passengers"
        ? passengersReport.error
        : activeReport === "users"
          ? usersReport.error
          : busReport.error;

  const isFetching =
    salesReport.isFetching ||
    passengersReport.isFetching ||
    usersReport.isFetching ||
    busReport.isFetching;

  function refreshAll() {
    void salesReport.refetch();
    void passengersReport.refetch();
    void usersReport.refetch();
    void busReport.refetch();
  }

  function exportActiveReport() {
    if (activeReport === "sales") {
      downloadCsv("ventas.csv", salesReport.data?.rows ?? [], [
        { header: "Boleto", value: (row) => row.ticketNumber },
        { header: "Pasajero", value: (row) => row.passengerName },
        { header: "Documento", value: (row) => row.documentNumber },
        { header: "Bus", value: (row) => row.busCode },
        { header: "Ruta", value: (row) => `${row.origin} - ${row.destination}` },
        { header: "Asiento", value: (row) => row.seatNumber },
        { header: "Monto", value: (row) => row.amount.amount },
        { header: "Estado", value: (row) => row.status }
      ]);
      return;
    }

    if (activeReport === "passengers") {
      downloadCsv("pasajeros.csv", passengersReport.data ?? [], [
        { header: "Pasajero", value: (row) => row.passengerName },
        { header: "Documento", value: (row) => row.documentNumber },
        { header: "Boleto", value: (row) => row.ticketNumber },
        { header: "Bus", value: (row) => row.busCode },
        { header: "Asiento", value: (row) => row.seatNumber },
        { header: "Salida", value: (row) => row.departureAt }
      ]);
      return;
    }

    if (activeReport === "users") {
      downloadCsv("ventas-por-usuario.csv", usersReport.data ?? [], [
        { header: "Usuario", value: (row) => row.userDisplayName },
        { header: "Boletos", value: (row) => row.ticketsSold },
        { header: "Neto", value: (row) => row.netAmount.amount }
      ]);
      return;
    }

    downloadCsv("ventas-agrupadas.csv", busReport.data ?? [], [
      { header: "Grupo", value: (row) => row.groupLabel },
      { header: "Boletos", value: (row) => row.ticketsSold },
      { header: "Neto", value: (row) => row.netAmount.amount },
      { header: "Clave", value: (row) => row.groupKey }
    ]);
  }

  return (
    <main className="reporting-shell">
      <section className="toolbar">
        <div>
          <p className="eyebrow">MFE REPORTING</p>
          <h1>Reportes operativos</h1>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="ghost-button" onClick={refreshAll}>
            <RefreshCcw size={16} aria-hidden="true" />
            Actualizar
          </button>
          <button type="button" className="primary-button" onClick={exportActiveReport}>
            <Download size={16} aria-hidden="true" />
            Exportar CSV
          </button>
        </div>
      </section>

      <section className="filters" aria-label="Filtros de reportes">
        <label>
          <span>Desde</span>
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>
        <label>
          <span>Hasta</span>
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>
        <label>
          <span>Buscar pasajero</span>
          <input
            type="search"
            value={passengerQuery}
            placeholder="Nombre, documento o boleto"
            onChange={(event) => setPassengerQuery(event.target.value)}
          />
        </label>
        <label>
          <span>Agrupar</span>
          <select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}>
            <option value="bus">Bus</option>
            <option value="route">Ruta</option>
            <option value="terminal">Terminal</option>
          </select>
        </label>
      </section>

      <section className="summary-grid" aria-label="Resumen de ventas">
        <article className="summary-card">
          <span>Boletos vendidos</span>
          <strong>{summary?.ticketsSold ?? 0}</strong>
        </article>
        <article className="summary-card">
          <span>Cancelados</span>
          <strong>{summary?.ticketsCancelled ?? 0}</strong>
        </article>
        <article className="summary-card">
          <span>Venta bruta</span>
          <strong>{formatCurrency(summary?.grossAmount)}</strong>
        </article>
        <article className="summary-card">
          <span>Venta neta</span>
          <strong>{formatCurrency(summary?.netAmount)}</strong>
        </article>
      </section>

      <section className="tabs" aria-label="Tipos de reporte">
        <button className={activeReport === "sales" ? "active" : ""} type="button" onClick={() => setActiveReport("sales")}>
          <BarChart3 size={16} aria-hidden="true" />
          Ventas
        </button>
        <button className={activeReport === "passengers" ? "active" : ""} type="button" onClick={() => setActiveReport("passengers")}>
          <UsersRound size={16} aria-hidden="true" />
          Pasajeros
        </button>
        <button className={activeReport === "users" ? "active" : ""} type="button" onClick={() => setActiveReport("users")}>
          <UsersRound size={16} aria-hidden="true" />
          Usuarios
        </button>
        <button className={activeReport === "bus" ? "active" : ""} type="button" onClick={() => setActiveReport("bus")}>
          <BarChart3 size={16} aria-hidden="true" />
          Bus / ruta
        </button>
      </section>

      <section className="report-panel">
        <div className="panel-header">
          <div>
            <h2>Consulta de reportes</h2>
            <p>{dateFrom || "-"} / {dateTo || "-"}</p>
          </div>
          <span className={isFetching ? "status loading" : "status"}>{isFetching ? "Consultando" : "Listo"}</span>
        </div>

        {activeError ? (
          <div className="error-box">
            No se pudo consultar reporting-service. Valida que este activo en
            http://localhost:8085/api/v1/reporting.
          </div>
        ) : null}

        {activeReport === "sales" ? (
          <DataTable columns={salesColumns} data={salesReport.data?.rows ?? []} emptyMessage="No hay ventas para los filtros seleccionados." />
        ) : null}
        {activeReport === "passengers" ? (
          <DataTable columns={passengerColumns} data={passengersReport.data ?? []} emptyMessage="No hay pasajeros para los filtros seleccionados." />
        ) : null}
        {activeReport === "users" ? (
          <DataTable columns={userColumns} data={usersReport.data ?? []} emptyMessage="No hay ventas por usuario para el periodo." />
        ) : null}
        {activeReport === "bus" ? (
          <DataTable columns={groupColumns} data={busReport.data ?? []} emptyMessage="No hay informacion agrupada para el periodo." />
        ) : null}
      </section>
    </main>
  );
}
