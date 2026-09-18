"use client";

import {
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import {
  BusFront,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Layers,
  MapPin,
  Plus,
  RefreshCw,
  Route as RouteIcon,
  Trash2
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type TabKey = "terminals" | "routes" | "bus-types" | "buses" | "layouts" | "departures";
type DepartureStatus = "SCHEDULED" | "CLOSED" | "CANCELLED";
type SeatPosition = "WINDOW" | "AISLE" | "MIDDLE" | "DRIVER" | "BLOCKED";
type BackendStatus = "loading" | "online" | "offline";

type PageMeta = {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
};

type PageResponse<T> = {
  data: T[];
  meta: PageMeta;
};

type Terminal = {
  id: string;
  legacy_id?: number | null;
  local_code?: string | null;
  name: string;
  manager_name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type RouteItem = {
  id: string;
  origin_terminal_id: string;
  origin_terminal_name: string;
  destination_terminal_id: string;
  destination_terminal_name: string;
  name: string;
  active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type BusType = {
  id: string;
  legacy_id?: number | null;
  name: string;
  description?: string | null;
  active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type SeatDefinition = {
  id?: string;
  seat_number: number;
  label: string;
  row_number: number;
  column_number: number;
  position: SeatPosition;
  active: boolean;
};

type SeatLayout = {
  id: string;
  name: string;
  seat_count: number;
  active: boolean;
  seats: SeatDefinition[];
  created_at?: string | null;
  updated_at?: string | null;
};

type Bus = {
  id: string;
  legacy_id?: number | null;
  code: string;
  plate: string;
  description?: string | null;
  default_destination?: string | null;
  bus_type_id: string;
  bus_type_name: string;
  terminal_id: string;
  terminal_name: string;
  seat_layout_id: string;
  seat_layout_name: string;
  seat_count: number;
  active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type Departure = {
  id: string;
  legacy_id?: number | null;
  bus_id: string;
  bus_code: string;
  bus_plate: string;
  route_id: string;
  route_name: string;
  origin_terminal_id: string;
  origin_terminal_name: string;
  destination_terminal_id: string;
  destination_terminal_name: string;
  departure_at: string;
  status: DepartureStatus;
  notes?: string | null;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type DispatchResources = {
  buses: Bus[];
  busTypes: BusType[];
  departures: Departure[];
  layouts: SeatLayout[];
  routes: RouteItem[];
  terminals: Terminal[];
};

const apiBase = "/api/dispatch";
const actorUserId = "00000000-0000-0000-0000-000000000025";
const dispatchQueryKeys = {
  resources: ["dispatch", "resources"] as const
};

function parseApiError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string") {
      return error.message;
    }
  }

  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  return fallback;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const hasBody = options.body !== undefined && options.body !== null;

  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  headers.set("X-Actor-User-Id", actorUserId);
  headers.set("X-Correlation-Id", crypto.randomUUID());

  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    cache: "no-store",
    headers
  });

  const responseText = await response.text();
  let payload: unknown = null;

  if (responseText) {
    try {
      payload = JSON.parse(responseText) as unknown;
    } catch {
      payload = responseText;
    }
  }

  if (!response.ok) {
    throw new Error(parseApiError(payload, `HTTP ${response.status}`));
  }

  return payload as T;
}

async function fetchDispatchResources(): Promise<DispatchResources> {
  const [nextTerminals, nextRoutes, nextBusTypes, nextLayouts, nextBuses, nextDepartures] = await Promise.all([
    apiRequest<PageResponse<Terminal>>("/terminals?page=1&page_size=100"),
    apiRequest<PageResponse<RouteItem>>("/routes?page=1&page_size=100"),
    apiRequest<PageResponse<BusType>>("/bus-types?page=1&page_size=100"),
    apiRequest<PageResponse<SeatLayout>>("/seat-layouts?page=1&page_size=100"),
    apiRequest<PageResponse<Bus>>("/buses?page=1&page_size=100"),
    apiRequest<PageResponse<Departure>>("/departures?page=1&page_size=100")
  ]);

  return {
    buses: nextBuses.data,
    busTypes: nextBusTypes.data,
    departures: nextDepartures.data,
    layouts: nextLayouts.data,
    routes: nextRoutes.data,
    terminals: nextTerminals.data
  };
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function optionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function futureDateTimeLocal() {
  const next = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const offset = next.getTimezoneOffset() * 60 * 1000;
  return new Date(next.getTime() - offset).toISOString().slice(0, 16);
}

function seatPositionForColumn(column: number): SeatPosition {
  if (column === 1 || column === 4) {
    return "WINDOW";
  }

  return column === 2 || column === 3 ? "AISLE" : "MIDDLE";
}

function generateSeats(count: number): SeatDefinition[] {
  return Array.from({ length: count }, (_, index) => {
    const seatNumber = index + 1;
    const column = (index % 4) + 1;

    return {
      active: true,
      column_number: column,
      label: String(seatNumber),
      position: seatPositionForColumn(column),
      row_number: Math.floor(index / 4) + 1,
      seat_number: seatNumber
    };
  });
}

export default function EmbeddedDispatch() {
  const [activeTab, setActiveTab] = useState<TabKey>("departures");
  const [statusMessage, setStatusMessage] = useState("Inicializando");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shellName, setShellName] = useState("directo");

  const [terminalForm, setTerminalForm] = useState({
    active: true,
    address: "Av. Dia 25",
    email: "terminal25@example.local",
    legacy_id: "2501",
    local_code: "D25",
    manager_name: "Operador Dia 25",
    name: "Terminal Dia 25",
    phone: "022500001"
  });

  const [routeForm, setRouteForm] = useState({
    active: true,
    destination_terminal_id: "",
    name: "Ruta Dia 25",
    origin_terminal_id: ""
  });

  const [busTypeForm, setBusTypeForm] = useState({
    active: true,
    description: "Tipo operativo creado desde mfe-dispatch",
    legacy_id: "2501",
    name: "Ejecutivo Dia 25"
  });

  const [layoutForm, setLayoutForm] = useState({
    active: true,
    name: "Layout Dia 25",
    seat_count: "25"
  });

  const [busForm, setBusForm] = useState({
    active: true,
    bus_type_id: "",
    code: "BUS-D25",
    default_destination: "Operacion Dia 25",
    description: "Bus creado desde mfe-dispatch",
    legacy_id: "2501",
    plate: "PBD-2501",
    seat_layout_id: "",
    terminal_id: ""
  });

  const [departureForm, setDepartureForm] = useState({
    bus_id: "",
    departure_at: futureDateTimeLocal(),
    legacy_id: "2501",
    notes: "Salida creada desde mfe-dispatch",
    route_id: ""
  });

  const queryClient = useQueryClient();
  const resourcesQuery = useQuery({
    queryKey: dispatchQueryKeys.resources,
    queryFn: fetchDispatchResources
  });
  const resources = resourcesQuery.data;
  const terminals = resources?.terminals ?? [];
  const routes = resources?.routes ?? [];
  const busTypes = resources?.busTypes ?? [];
  const layouts = resources?.layouts ?? [];
  const buses = resources?.buses ?? [];
  const departures = resources?.departures ?? [];
  const actionMutation = useMutation({
    mutationFn: async ({ action }: { action: () => Promise<void>; successMessage: string }) => {
      await action();
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "Operacion no completada");
      setStatusMessage("Backend no disponible");
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: dispatchQueryKeys.resources });
      setErrorMessage(null);
      setStatusMessage(variables.successMessage);
    }
  });
  const busy = resourcesQuery.isFetching || actionMutation.isPending;
  const backendStatus: BackendStatus = resourcesQuery.isLoading ? "loading" : resourcesQuery.isError ? "offline" : "online";

  const tabs = useMemo(
    () => [
      { key: "terminals" as const, label: "Terminales", icon: MapPin },
      { key: "routes" as const, label: "Rutas", icon: RouteIcon },
      { key: "bus-types" as const, label: "Tipos", icon: ClipboardList },
      { key: "buses" as const, label: "Buses", icon: BusFront },
      { key: "layouts" as const, label: "Layouts", icon: Layers },
      { key: "departures" as const, label: "Salidas", icon: CalendarClock }
    ],
    []
  );

  const stats = useMemo(
    () => [
      { label: "Terminales", value: terminals.length.toString(), tone: "green" },
      { label: "Rutas", value: routes.length.toString(), tone: "blue" },
      { label: "Buses", value: buses.length.toString(), tone: "amber" },
      { label: "Salidas", value: departures.length.toString(), tone: "coral" }
    ],
    [buses.length, departures.length, routes.length, terminals.length]
  );

  async function refreshData() {
    setErrorMessage(null);

    try {
      const result = await resourcesQuery.refetch();
      if (result.error) {
        throw result.error;
      }
      setStatusMessage("Datos actualizados");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "dispatch-service no disponible");
      setStatusMessage("Backend no disponible");
    }
  }

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setErrorMessage(null);
    try {
      await actionMutation.mutateAsync({ action, successMessage });
    } catch {
      // Error state is set by the mutation callback.
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setShellName(params.get("shell") ?? "directo");
  }, []);

  useEffect(() => {
    if (resourcesQuery.isError) {
      setErrorMessage(resourcesQuery.error instanceof Error ? resourcesQuery.error.message : "dispatch-service no disponible");
      setStatusMessage("Backend no disponible");
    }
  }, [resourcesQuery.error, resourcesQuery.isError]);

  useEffect(() => {
    if (resourcesQuery.isSuccess && (statusMessage === "Inicializando" || statusMessage === "Backend no disponible")) {
      setErrorMessage(null);
      setStatusMessage("Datos actualizados");
    }
  }, [resourcesQuery.isSuccess, statusMessage]);

  useEffect(() => {
    if (!routeForm.origin_terminal_id && terminals[0]) {
      setRouteForm((current) => ({
        ...current,
        origin_terminal_id: terminals[0]?.id ?? "",
        destination_terminal_id: terminals[1]?.id ?? terminals[0]?.id ?? ""
      }));
    }
  }, [routeForm.origin_terminal_id, terminals]);

  useEffect(() => {
    if (!busForm.bus_type_id && busTypes[0]) {
      setBusForm((current) => ({ ...current, bus_type_id: busTypes[0]?.id ?? "" }));
    }
  }, [busForm.bus_type_id, busTypes]);

  useEffect(() => {
    if (!busForm.terminal_id && terminals[0]) {
      setBusForm((current) => ({ ...current, terminal_id: terminals[0]?.id ?? "" }));
    }
  }, [busForm.terminal_id, terminals]);

  useEffect(() => {
    if (!busForm.seat_layout_id && layouts[0]) {
      setBusForm((current) => ({ ...current, seat_layout_id: layouts[0]?.id ?? "" }));
    }
  }, [busForm.seat_layout_id, layouts]);

  useEffect(() => {
    if (!departureForm.bus_id && buses[0]) {
      setDepartureForm((current) => ({ ...current, bus_id: buses[0]?.id ?? "" }));
    }
  }, [buses, departureForm.bus_id]);

  useEffect(() => {
    if (!departureForm.route_id && routes[0]) {
      setDepartureForm((current) => ({ ...current, route_id: routes[0]?.id ?? "" }));
    }
  }, [departureForm.route_id, routes]);

  async function createTerminal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(async () => {
      await apiRequest<Terminal>("/terminals", {
        body: JSON.stringify({
          active: terminalForm.active,
          address: optionalText(terminalForm.address),
          email: optionalText(terminalForm.email),
          legacy_id: optionalNumber(terminalForm.legacy_id),
          local_code: optionalText(terminalForm.local_code),
          manager_name: optionalText(terminalForm.manager_name),
          name: terminalForm.name,
          phone: optionalText(terminalForm.phone)
        }),
        method: "POST"
      });
    }, "Terminal creada");
  }

  async function createRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(async () => {
      await apiRequest<RouteItem>("/routes", {
        body: JSON.stringify(routeForm),
        method: "POST"
      });
    }, "Ruta creada");
  }

  async function createBusType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(async () => {
      await apiRequest<BusType>("/bus-types", {
        body: JSON.stringify({
          active: busTypeForm.active,
          description: optionalText(busTypeForm.description),
          legacy_id: optionalNumber(busTypeForm.legacy_id),
          name: busTypeForm.name
        }),
        method: "POST"
      });
    }, "Tipo de bus creado");
  }

  async function createLayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const seatCount = optionalNumber(layoutForm.seat_count) ?? 0;

    if (seatCount < 1) {
      setErrorMessage("El layout necesita al menos un asiento.");
      return;
    }

    await runAction(async () => {
      await apiRequest<SeatLayout>("/seat-layouts", {
        body: JSON.stringify({
          active: layoutForm.active,
          name: layoutForm.name,
          seats: generateSeats(seatCount)
        }),
        method: "POST"
      });
    }, "Layout creado");
  }

  async function createBus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(async () => {
      await apiRequest<Bus>("/buses", {
        body: JSON.stringify({
          active: busForm.active,
          bus_type_id: busForm.bus_type_id,
          code: busForm.code,
          default_destination: optionalText(busForm.default_destination),
          description: optionalText(busForm.description),
          legacy_id: optionalNumber(busForm.legacy_id),
          plate: busForm.plate,
          seat_layout_id: busForm.seat_layout_id,
          terminal_id: busForm.terminal_id
        }),
        method: "POST"
      });
    }, "Bus creado");
  }

  async function createDeparture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(async () => {
      await apiRequest<Departure>("/departures", {
        body: JSON.stringify({
          bus_id: departureForm.bus_id,
          departure_at: new Date(departureForm.departure_at).toISOString(),
          legacy_id: optionalNumber(departureForm.legacy_id),
          notes: optionalText(departureForm.notes),
          route_id: departureForm.route_id
        }),
        method: "POST"
      });
    }, "Salida programada");
  }

  async function deactivate(path: string, successMessage: string) {
    await runAction(async () => {
      await apiRequest<void>(path, { method: "DELETE" });
    }, successMessage);
  }

  async function cancelDeparture(departureId: string) {
    await runAction(async () => {
      await apiRequest<Departure>(`/departures/${departureId}/cancel`, {
        body: JSON.stringify({ reason: "Cancelada desde mfe-dispatch" }),
        method: "POST"
      });
    }, "Salida cancelada");
  }

  const selectedLayout = layouts[0];
  const backendOnline = backendStatus === "online";

  return (
    <main className="dispatch-module">
      <header className="module-header">
        <div>
          <p className="eyebrow">MFE Dispatch</p>
          <h1>Despacho operativo</h1>
        </div>
        <div className="module-actions">
          <span className={backendOnline ? "status-chip status-chip-ok" : "status-chip"}>
            {backendOnline ? "Conectado" : backendStatus === "loading" ? "Cargando" : "Sin backend"}
          </span>
          <button className="icon-button" disabled={busy} onClick={refreshData} title="Actualizar datos" type="button">
            <RefreshCw aria-hidden="true" size={18} />
          </button>
        </div>
      </header>

      <section className="system-strip" aria-label="Estado">
        <span>Shell: {shellName}</span>
        <span>API: {apiBase}</span>
        <span>{statusMessage}</span>
      </section>

      {errorMessage ? (
        <div className="alert alert-error" role="alert">
          <CircleAlert aria-hidden="true" size={18} />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <section className="stat-grid" aria-label="Resumen de despacho">
        {stats.map((stat) => (
          <article className={`stat-card stat-card-${stat.tone}`} key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </section>

      <nav className="tab-list" aria-label="Vistas de despacho">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              className={activeTab === tab.key ? "tab-button tab-button-active" : "tab-button"}
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              <Icon aria-hidden="true" size={17} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {activeTab === "terminals" ? (
        <section className="work-grid">
          <form className="form-panel" onSubmit={createTerminal}>
            <div className="panel-heading">
              <MapPin aria-hidden="true" size={19} />
              <h2>Terminal</h2>
            </div>
            <div className="compact-grid">
              <label>
                Legacy ID
                <input onChange={(event) => setTerminalForm((current) => ({ ...current, legacy_id: event.target.value }))} value={terminalForm.legacy_id} />
              </label>
              <label>
                Codigo
                <input onChange={(event) => setTerminalForm((current) => ({ ...current, local_code: event.target.value }))} value={terminalForm.local_code} />
              </label>
            </div>
            <label>
              Nombre
              <input onChange={(event) => setTerminalForm((current) => ({ ...current, name: event.target.value }))} value={terminalForm.name} />
            </label>
            <label>
              Responsable
              <input onChange={(event) => setTerminalForm((current) => ({ ...current, manager_name: event.target.value }))} value={terminalForm.manager_name} />
            </label>
            <label>
              Direccion
              <input onChange={(event) => setTerminalForm((current) => ({ ...current, address: event.target.value }))} value={terminalForm.address} />
            </label>
            <div className="compact-grid">
              <label>
                Telefono
                <input onChange={(event) => setTerminalForm((current) => ({ ...current, phone: event.target.value }))} value={terminalForm.phone} />
              </label>
              <label>
                Correo
                <input onChange={(event) => setTerminalForm((current) => ({ ...current, email: event.target.value }))} value={terminalForm.email} />
              </label>
            </div>
            <label className="checkbox-inline">
              <input checked={terminalForm.active} onChange={(event) => setTerminalForm((current) => ({ ...current, active: event.target.checked }))} type="checkbox" />
              <span>Activo</span>
            </label>
            <button className="primary-action" disabled={busy} type="submit">
              <Plus aria-hidden="true" size={17} />
              <span>Guardar terminal</span>
            </button>
          </form>

          <section className="table-panel" aria-label="Terminales">
            <TableHeader count={terminals.length} icon={<MapPin aria-hidden="true" size={22} />} title="Terminales" />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Terminal</th>
                    <th>Codigo</th>
                    <th>Contacto</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {terminals.map((terminal) => (
                    <tr key={terminal.id}>
                      <td>
                        <strong>{terminal.name}</strong>
                        <span>{shortId(terminal.id)}</span>
                      </td>
                      <td>{terminal.local_code ?? "-"}</td>
                      <td>
                        <strong>{terminal.manager_name ?? "-"}</strong>
                        <span>{terminal.phone ?? terminal.email ?? "-"}</span>
                      </td>
                      <td><StatusPill active={terminal.active} /></td>
                      <td><DeleteButton disabled={busy} onClick={() => void deactivate(`/terminals/${terminal.id}`, "Terminal desactivada")} /></td>
                    </tr>
                  ))}
                  <EmptyRows count={terminals.length} columns={5} />
                </tbody>
              </table>
            </div>
          </section>
        </section>
      ) : null}

      {activeTab === "routes" ? (
        <section className="work-grid">
          <form className="form-panel" onSubmit={createRoute}>
            <div className="panel-heading">
              <RouteIcon aria-hidden="true" size={19} />
              <h2>Ruta</h2>
            </div>
            <label>
              Nombre
              <input onChange={(event) => setRouteForm((current) => ({ ...current, name: event.target.value }))} value={routeForm.name} />
            </label>
            <label>
              Origen
              <select onChange={(event) => setRouteForm((current) => ({ ...current, origin_terminal_id: event.target.value }))} value={routeForm.origin_terminal_id}>
                <ResourceOptions items={terminals} />
              </select>
            </label>
            <label>
              Destino
              <select onChange={(event) => setRouteForm((current) => ({ ...current, destination_terminal_id: event.target.value }))} value={routeForm.destination_terminal_id}>
                <ResourceOptions items={terminals} />
              </select>
            </label>
            <label className="checkbox-inline">
              <input checked={routeForm.active} onChange={(event) => setRouteForm((current) => ({ ...current, active: event.target.checked }))} type="checkbox" />
              <span>Activo</span>
            </label>
            <button className="primary-action" disabled={busy || terminals.length < 2} type="submit">
              <Plus aria-hidden="true" size={17} />
              <span>Guardar ruta</span>
            </button>
          </form>

          <section className="table-panel" aria-label="Rutas">
            <TableHeader count={routes.length} icon={<RouteIcon aria-hidden="true" size={22} />} title="Rutas" />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ruta</th>
                    <th>Origen</th>
                    <th>Destino</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((route) => (
                    <tr key={route.id}>
                      <td>
                        <strong>{route.name}</strong>
                        <span>{shortId(route.id)}</span>
                      </td>
                      <td>{route.origin_terminal_name}</td>
                      <td>{route.destination_terminal_name}</td>
                      <td><StatusPill active={route.active} /></td>
                      <td><DeleteButton disabled={busy} onClick={() => void deactivate(`/routes/${route.id}`, "Ruta desactivada")} /></td>
                    </tr>
                  ))}
                  <EmptyRows count={routes.length} columns={5} />
                </tbody>
              </table>
            </div>
          </section>
        </section>
      ) : null}

      {activeTab === "bus-types" ? (
        <section className="work-grid">
          <form className="form-panel" onSubmit={createBusType}>
            <div className="panel-heading">
              <ClipboardList aria-hidden="true" size={19} />
              <h2>Tipo de bus</h2>
            </div>
            <label>
              Legacy ID
              <input onChange={(event) => setBusTypeForm((current) => ({ ...current, legacy_id: event.target.value }))} value={busTypeForm.legacy_id} />
            </label>
            <label>
              Nombre
              <input onChange={(event) => setBusTypeForm((current) => ({ ...current, name: event.target.value }))} value={busTypeForm.name} />
            </label>
            <label>
              Descripcion
              <textarea onChange={(event) => setBusTypeForm((current) => ({ ...current, description: event.target.value }))} rows={3} value={busTypeForm.description} />
            </label>
            <label className="checkbox-inline">
              <input checked={busTypeForm.active} onChange={(event) => setBusTypeForm((current) => ({ ...current, active: event.target.checked }))} type="checkbox" />
              <span>Activo</span>
            </label>
            <button className="primary-action" disabled={busy} type="submit">
              <Plus aria-hidden="true" size={17} />
              <span>Guardar tipo</span>
            </button>
          </form>

          <section className="table-panel" aria-label="Tipos de bus">
            <TableHeader count={busTypes.length} icon={<ClipboardList aria-hidden="true" size={22} />} title="Tipos de bus" />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Descripcion</th>
                    <th>Legacy</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {busTypes.map((busType) => (
                    <tr key={busType.id}>
                      <td>
                        <strong>{busType.name}</strong>
                        <span>{shortId(busType.id)}</span>
                      </td>
                      <td>{busType.description ?? "-"}</td>
                      <td>{busType.legacy_id ?? "-"}</td>
                      <td><StatusPill active={busType.active} /></td>
                      <td><DeleteButton disabled={busy} onClick={() => void deactivate(`/bus-types/${busType.id}`, "Tipo desactivado")} /></td>
                    </tr>
                  ))}
                  <EmptyRows count={busTypes.length} columns={5} />
                </tbody>
              </table>
            </div>
          </section>
        </section>
      ) : null}

      {activeTab === "layouts" ? (
        <section className="work-grid">
          <form className="form-panel" onSubmit={createLayout}>
            <div className="panel-heading">
              <Layers aria-hidden="true" size={19} />
              <h2>Layout</h2>
            </div>
            <label>
              Nombre
              <input onChange={(event) => setLayoutForm((current) => ({ ...current, name: event.target.value }))} value={layoutForm.name} />
            </label>
            <label>
              Asientos
              <input onChange={(event) => setLayoutForm((current) => ({ ...current, seat_count: event.target.value }))} value={layoutForm.seat_count} />
            </label>
            <label className="checkbox-inline">
              <input checked={layoutForm.active} onChange={(event) => setLayoutForm((current) => ({ ...current, active: event.target.checked }))} type="checkbox" />
              <span>Activo</span>
            </label>
            <button className="primary-action" disabled={busy} type="submit">
              <Plus aria-hidden="true" size={17} />
              <span>Guardar layout</span>
            </button>
            {selectedLayout ? (
              <div className="layout-preview" aria-label="Primer layout disponible">
                <strong>{selectedLayout.name}</strong>
                <div className="seat-map">
                  {selectedLayout.seats.slice(0, 40).map((seat) => (
                    <span className={seat.active ? "seat seat-active" : "seat"} key={`${selectedLayout.id}-${seat.seat_number}`}>
                      {seat.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </form>

          <section className="table-panel" aria-label="Layouts">
            <TableHeader count={layouts.length} icon={<Layers aria-hidden="true" size={22} />} title="Layouts" />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Layout</th>
                    <th>Asientos</th>
                    <th>Actualizado</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {layouts.map((layout) => (
                    <tr key={layout.id}>
                      <td>
                        <strong>{layout.name}</strong>
                        <span>{shortId(layout.id)}</span>
                      </td>
                      <td>{layout.seat_count}</td>
                      <td>{formatDate(layout.updated_at)}</td>
                      <td><StatusPill active={layout.active} /></td>
                      <td><DeleteButton disabled={busy} onClick={() => void deactivate(`/seat-layouts/${layout.id}`, "Layout desactivado")} /></td>
                    </tr>
                  ))}
                  <EmptyRows count={layouts.length} columns={5} />
                </tbody>
              </table>
            </div>
          </section>
        </section>
      ) : null}

      {activeTab === "buses" ? (
        <section className="work-grid">
          <form className="form-panel" onSubmit={createBus}>
            <div className="panel-heading">
              <BusFront aria-hidden="true" size={19} />
              <h2>Bus</h2>
            </div>
            <div className="compact-grid">
              <label>
                Legacy ID
                <input onChange={(event) => setBusForm((current) => ({ ...current, legacy_id: event.target.value }))} value={busForm.legacy_id} />
              </label>
              <label>
                Codigo
                <input onChange={(event) => setBusForm((current) => ({ ...current, code: event.target.value }))} value={busForm.code} />
              </label>
            </div>
            <label>
              Placa
              <input onChange={(event) => setBusForm((current) => ({ ...current, plate: event.target.value }))} value={busForm.plate} />
            </label>
            <label>
              Tipo
              <select onChange={(event) => setBusForm((current) => ({ ...current, bus_type_id: event.target.value }))} value={busForm.bus_type_id}>
                <ResourceOptions items={busTypes} />
              </select>
            </label>
            <label>
              Terminal
              <select onChange={(event) => setBusForm((current) => ({ ...current, terminal_id: event.target.value }))} value={busForm.terminal_id}>
                <ResourceOptions items={terminals} />
              </select>
            </label>
            <label>
              Layout
              <select onChange={(event) => setBusForm((current) => ({ ...current, seat_layout_id: event.target.value }))} value={busForm.seat_layout_id}>
                <ResourceOptions items={layouts} />
              </select>
            </label>
            <label>
              Destino base
              <input onChange={(event) => setBusForm((current) => ({ ...current, default_destination: event.target.value }))} value={busForm.default_destination} />
            </label>
            <label className="checkbox-inline">
              <input checked={busForm.active} onChange={(event) => setBusForm((current) => ({ ...current, active: event.target.checked }))} type="checkbox" />
              <span>Activo</span>
            </label>
            <button className="primary-action" disabled={busy || busTypes.length === 0 || terminals.length === 0 || layouts.length === 0} type="submit">
              <Plus aria-hidden="true" size={17} />
              <span>Guardar bus</span>
            </button>
          </form>

          <section className="table-panel" aria-label="Buses">
            <TableHeader count={buses.length} icon={<BusFront aria-hidden="true" size={22} />} title="Buses" />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Bus</th>
                    <th>Tipo</th>
                    <th>Terminal</th>
                    <th>Layout</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {buses.map((bus) => (
                    <tr key={bus.id}>
                      <td>
                        <strong>{bus.code}</strong>
                        <span>{bus.plate}</span>
                      </td>
                      <td>{bus.bus_type_name}</td>
                      <td>{bus.terminal_name}</td>
                      <td>{bus.seat_layout_name}</td>
                      <td><StatusPill active={bus.active} /></td>
                      <td><DeleteButton disabled={busy} onClick={() => void deactivate(`/buses/${bus.id}`, "Bus desactivado")} /></td>
                    </tr>
                  ))}
                  <EmptyRows count={buses.length} columns={6} />
                </tbody>
              </table>
            </div>
          </section>
        </section>
      ) : null}

      {activeTab === "departures" ? (
        <section className="work-grid">
          <form className="form-panel" onSubmit={createDeparture}>
            <div className="panel-heading">
              <CalendarClock aria-hidden="true" size={19} />
              <h2>Salida</h2>
            </div>
            <label>
              Legacy ID
              <input onChange={(event) => setDepartureForm((current) => ({ ...current, legacy_id: event.target.value }))} value={departureForm.legacy_id} />
            </label>
            <label>
              Bus
              <select onChange={(event) => setDepartureForm((current) => ({ ...current, bus_id: event.target.value }))} value={departureForm.bus_id}>
                <ResourceOptions items={buses.map((bus) => ({ id: bus.id, name: `${bus.code} - ${bus.plate}` }))} />
              </select>
            </label>
            <label>
              Ruta
              <select onChange={(event) => setDepartureForm((current) => ({ ...current, route_id: event.target.value }))} value={departureForm.route_id}>
                <ResourceOptions items={routes} />
              </select>
            </label>
            <label>
              Fecha y hora
              <input
                onChange={(event) => setDepartureForm((current) => ({ ...current, departure_at: event.target.value }))}
                type="datetime-local"
                value={departureForm.departure_at}
              />
            </label>
            <label>
              Notas
              <textarea onChange={(event) => setDepartureForm((current) => ({ ...current, notes: event.target.value }))} rows={3} value={departureForm.notes} />
            </label>
            <button className="primary-action" disabled={busy || buses.length === 0 || routes.length === 0} type="submit">
              <Plus aria-hidden="true" size={17} />
              <span>Programar salida</span>
            </button>
          </form>

          <section className="table-panel" aria-label="Salidas">
            <TableHeader count={departures.length} icon={<CalendarClock aria-hidden="true" size={22} />} title="Salidas" />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Salida</th>
                    <th>Ruta</th>
                    <th>Bus</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {departures.map((departure) => (
                    <tr key={departure.id}>
                      <td>
                        <strong>{departure.legacy_id ?? shortId(departure.id)}</strong>
                        <span>{departure.notes ?? "-"}</span>
                      </td>
                      <td>
                        <strong>{departure.route_name}</strong>
                        <span>{departure.origin_terminal_name} - {departure.destination_terminal_name}</span>
                      </td>
                      <td>
                        <strong>{departure.bus_code}</strong>
                        <span>{departure.bus_plate}</span>
                      </td>
                      <td>{formatDate(departure.departure_at)}</td>
                      <td><DeparturePill status={departure.status} /></td>
                      <td>
                        <button
                          className="row-icon-button"
                          disabled={busy || departure.status === "CANCELLED"}
                          onClick={() => void cancelDeparture(departure.id)}
                          title="Cancelar salida"
                          type="button"
                        >
                          <Trash2 aria-hidden="true" size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <EmptyRows count={departures.length} columns={6} />
                </tbody>
              </table>
            </div>
          </section>
        </section>
      ) : null}
    </main>
  );
}

function TableHeader({ count, icon, title }: Readonly<{ count: number; icon: React.ReactNode; title: string }>) {
  return (
    <div className="table-header">
      <div>
        <h2>{title}</h2>
        <span>{count} registros</span>
      </div>
      {icon}
    </div>
  );
}

function ResourceOptions({ items }: Readonly<{ items: { id: string; name: string }[] }>) {
  if (items.length === 0) {
    return <option value="">Sin registros</option>;
  }

  return (
    <>
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </>
  );
}

function EmptyRows({ columns, count }: Readonly<{ columns: number; count: number }>) {
  if (count > 0) {
    return null;
  }

  return (
    <tr>
      <td className="empty-cell" colSpan={columns}>Sin registros</td>
    </tr>
  );
}

function StatusPill({ active }: Readonly<{ active: boolean }>) {
  return (
    <span className={active ? "pill pill-ok" : "pill pill-wait"}>
      {active ? "ACTIVE" : "INACTIVE"}
    </span>
  );
}

function DeparturePill({ status }: Readonly<{ status: DepartureStatus }>) {
  const className = status === "SCHEDULED" ? "pill pill-ok" : status === "CLOSED" ? "pill pill-info" : "pill pill-wait";

  return <span className={className}>{status}</span>;
}

function DeleteButton({ disabled, onClick }: Readonly<{ disabled: boolean; onClick: () => void }>) {
  return (
    <button className="row-icon-button" disabled={disabled} onClick={onClick} title="Desactivar" type="button">
      <Trash2 aria-hidden="true" size={16} />
    </button>
  );
}
