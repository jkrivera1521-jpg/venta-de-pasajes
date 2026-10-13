"use client";

import {
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import {
  Armchair,
  BusFront,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  DatabaseZap,
  DoorOpen,
  RefreshCw,
  Search,
  Ticket,
  UserRound
} from "lucide-react";
import type { CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type BackendStatus = "loading" | "online" | "offline";
type DepartureStatus = "SCHEDULED" | "CLOSED" | "CANCELLED";
type SeatStatus = "AVAILABLE" | "RESERVED" | "SOLD" | "BLOCKED" | "CANCELLED";
type PassengerSeatFlag = "DISABILITY" | "CHILD" | "OLDER_ADULT";
type TicketStatus = "ISSUED" | "VOIDED" | "REFUNDED" | "REPRINTED";
type DocumentType = "CEDULA" | "PASSPORT" | "RUC" | "OTHER";

type AvailableDeparture = {
  dispatch_departure_id: string;
  legacy_id?: number | null;
  bus_id: string;
  bus_code: string;
  bus_plate?: string | null;
  route_id: string;
  route_name: string;
  origin_terminal_id: string;
  origin_terminal_name: string;
  destination_terminal_id: string;
  destination_terminal_name: string;
  departure_at: string;
  status: DepartureStatus;
  total_seats: number;
  available_seats: number;
  reserved_seats: number;
  sold_seats: number;
  blocked_seats: number;
  cancelled_seats: number;
  sellable: boolean;
  synced_at?: string | null;
};

type SeatAvailability = {
  seat_id: string;
  seat_number: string;
  status: SeatStatus;
  available: boolean;
  reservation_id?: string | null;
  passenger_id?: string | null;
  hold_expires_at?: string | null;
  passenger_category?: PassengerSeatFlag | null;
  passenger_flags?: PassengerSeatFlag[] | null;
  passenger_type?: PassengerSeatFlag | null;
};

type SeatMap = {
  dispatch_departure_id: string;
  route_name: string;
  origin_terminal_name: string;
  destination_terminal_name: string;
  departure_at: string;
  status: DepartureStatus;
  total_seats: number;
  available_seats: number;
  reserved_seats: number;
  sold_seats: number;
  blocked_seats: number;
  cancelled_seats: number;
  seats: SeatAvailability[];
};

type SeatPosition = "WINDOW" | "AISLE" | "MIDDLE";
type SeatLayoutProfile = "legacy25" | "generated";
type SeatLayoutCellKind = "seat" | "driver" | "entry" | "aisle";

type SeatLayoutCell = {
  column: number;
  key: string;
  kind: SeatLayoutCellKind;
  label?: string;
  position?: SeatPosition;
  row: number;
  seat?: SeatAvailability;
};

type SeatLayoutModel = {
  columns: number;
  cells: SeatLayoutCell[];
  name: string;
  profile: SeatLayoutProfile;
  rows: number;
};

type SeatCoordinate = {
  column: number;
  position: SeatPosition;
  row: number;
};

type TicketResponse = {
  ticket_id: string;
  ticket_number: string;
  passenger_id: string;
  reservation_id?: string | null;
  dispatch_departure_id: string;
  departure_seat_id: string;
  seat_number: string;
  fare_amount: number;
  currency: string;
  status: TicketStatus;
  issued_at: string;
  event_id?: string | null;
};

type PassengerForm = {
  document_type: DocumentType;
  document_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
};

const apiBase = "/api/ticketing";
const currencyFormatter = new Intl.NumberFormat("es-EC", {
  currency: "USD",
  style: "currency"
});
const ticketingQueryKeys = {
  all: ["ticketing"] as const,
  departuresRoot: ["ticketing", "departures"] as const,
  departures: (dateFrom: string, dateTo: string) => ["ticketing", "departures", dateFrom, dateTo] as const,
  seatMap: (dispatchDepartureId: string) => ["ticketing", "seat-map", dispatchDepartureId] as const
};

const LEGACY_25_SEAT_COORDINATES: Record<string, SeatCoordinate> = {
  "1": { column: 1, position: "WINDOW", row: 2 },
  "2": { column: 2, position: "AISLE", row: 2 },
  "3": { column: 5, position: "WINDOW", row: 1 },
  "4": { column: 4, position: "AISLE", row: 1 },
  "5": { column: 5, position: "WINDOW", row: 2 },
  "6": { column: 4, position: "AISLE", row: 2 },
  "7": { column: 1, position: "WINDOW", row: 3 },
  "8": { column: 2, position: "AISLE", row: 3 },
  "9": { column: 5, position: "WINDOW", row: 4 },
  "10": { column: 4, position: "AISLE", row: 4 },
  "11": { column: 1, position: "WINDOW", row: 4 },
  "12": { column: 2, position: "AISLE", row: 4 },
  "13": { column: 5, position: "WINDOW", row: 5 },
  "14": { column: 4, position: "AISLE", row: 5 },
  "15": { column: 1, position: "WINDOW", row: 5 },
  "16": { column: 2, position: "AISLE", row: 5 },
  "17": { column: 5, position: "WINDOW", row: 6 },
  "18": { column: 4, position: "AISLE", row: 6 },
  "19": { column: 1, position: "WINDOW", row: 6 },
  "20": { column: 2, position: "AISLE", row: 6 },
  "21": { column: 5, position: "WINDOW", row: 7 },
  "22": { column: 4, position: "AISLE", row: 7 },
  "23": { column: 1, position: "WINDOW", row: 7 },
  "24": { column: 2, position: "AISLE", row: 7 },
  "25": { column: 3, position: "MIDDLE", row: 7 }
};

const PASSENGER_FLAG_LABELS: Record<PassengerSeatFlag, string> = {
  CHILD: "N",
  DISABILITY: "D",
  OLDER_ADULT: "AM"
};

const PASSENGER_FLAG_TITLES: Record<PassengerSeatFlag, string> = {
  CHILD: "Niño",
  DISABILITY: "Discapacidad",
  OLDER_ADULT: "Adulto mayor"
};

const DEMO_SOLD_SEAT_FLAGS: Record<string, PassengerSeatFlag[]> = {
  "6": ["DISABILITY"],
  "22": ["CHILD"],
  "39": ["OLDER_ADULT"]
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

async function fetchDepartures(filters: { date_from: string; date_to: string }) {
  const params = new URLSearchParams();
  if (filters.date_from) {
    params.set("date_from", filters.date_from);
  }
  if (filters.date_to) {
    params.set("date_to", filters.date_to);
  }

  await apiRequest<{ status: string }>("/health");
  return apiRequest<AvailableDeparture[]>(`/availability/departures${params.size > 0 ? `?${params.toString()}` : ""}`);
}

function fetchSeatMap(dispatchDepartureId: string) {
  return apiRequest<SeatMap>(`/availability/departures/${dispatchDepartureId}/seats`);
}

function todayInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
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

function shortId(value: string) {
  return value.slice(0, 8);
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function seatStatusLabel(status: SeatStatus) {
  if (status === "AVAILABLE") {
    return "Libre";
  }

  if (status === "RESERVED") {
    return "Reservado";
  }

  if (status === "SOLD") {
    return "Vendido";
  }

  if (status === "CANCELLED") {
    return "Cancelado";
  }

  return "Bloqueado";
}

function seatTone(status: SeatStatus) {
  if (status === "AVAILABLE") {
    return "available";
  }

  if (status === "RESERVED") {
    return "reserved";
  }

  if (status === "SOLD") {
    return "sold";
  }

  if (status === "CANCELLED") {
    return "cancelled";
  }

  return "blocked";
}

function normalizePassengerFlag(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase().replaceAll("-", "_");
  if (normalized === "DISABILITY" || normalized === "DISABLED" || normalized === "PERSON_WITH_DISABILITY") {
    return "DISABILITY";
  }

  if (normalized === "CHILD" || normalized === "MINOR" || normalized === "KID") {
    return "CHILD";
  }

  if (normalized === "OLDER_ADULT" || normalized === "SENIOR" || normalized === "ELDERLY") {
    return "OLDER_ADULT";
  }

  return null;
}

function seatPassengerFlags(seat: SeatAvailability): PassengerSeatFlag[] {
  if (seat.status !== "SOLD") {
    return [];
  }

  const backendFlags = [
    ...(seat.passenger_flags ?? []),
    seat.passenger_category,
    seat.passenger_type
  ]
    .map((flag) => normalizePassengerFlag(flag))
    .filter((flag): flag is PassengerSeatFlag => Boolean(flag));

  if (backendFlags.length > 0) {
    return Array.from(new Set(backendFlags));
  }

  return DEMO_SOLD_SEAT_FLAGS[seat.seat_number] ?? [];
}

function passengerFlagText(flags: PassengerSeatFlag[]) {
  return flags.map((flag) => PASSENGER_FLAG_TITLES[flag]).join(", ");
}

function saleErrorText(message: string) {
  if (/409|conflict|no disponible|not available|already/i.test(message)) {
    return `${message}. Se refresco el mapa; seleccione otro asiento libre.`;
  }

  return message;
}

function compareSeats(first: SeatAvailability, second: SeatAvailability) {
  return first.seat_number.localeCompare(second.seat_number, "es", {
    numeric: true,
    sensitivity: "base"
  });
}

function gridCellStyle(cell: SeatLayoutCell): CSSProperties {
  return {
    gridColumn: cell.column,
    gridRow: cell.row
  };
}

function sortLayoutCells(first: SeatLayoutCell, second: SeatLayoutCell) {
  if (first.row !== second.row) {
    return first.row - second.row;
  }

  return first.column - second.column;
}

function hasLegacy25Layout(seats: SeatAvailability[]) {
  if (seats.length !== 25) {
    return false;
  }

  const seatNumbers = new Set(seats.map((seat) => seat.seat_number));
  return Object.keys(LEGACY_25_SEAT_COORDINATES).every((seatNumber) => seatNumbers.has(seatNumber));
}

function baseCabinCells(): SeatLayoutCell[] {
  return [
    { column: 1, key: "driver", kind: "driver", label: "Chofer", row: 1 },
    { column: 2, key: "entry", kind: "entry", label: "Entrada", row: 1 },
    { column: 3, key: "aisle-front", kind: "aisle", row: 1 }
  ];
}

function buildLegacy25SeatLayout(seats: SeatAvailability[]): SeatLayoutModel {
  const seatsByNumber = new Map(seats.map((seat) => [seat.seat_number, seat]));
  const cells: SeatLayoutCell[] = [
    ...baseCabinCells(),
    ...Array.from({ length: 5 }, (_, index) => ({
      column: 3,
      key: `aisle-${index + 2}`,
      kind: "aisle" as const,
      label: index === 0 ? "Pasillo" : undefined,
      row: index + 2
    }))
  ];

  Object.entries(LEGACY_25_SEAT_COORDINATES).forEach(([seatNumber, coordinate]) => {
    const seat = seatsByNumber.get(seatNumber);
    if (!seat) {
      return;
    }

    cells.push({
      column: coordinate.column,
      key: `seat-${seat.seat_id}`,
      kind: "seat",
      position: coordinate.position,
      row: coordinate.row,
      seat
    });
  });

  return {
    cells: cells.sort(sortLayoutCells),
    columns: 5,
    name: "Legacy 25 asientos",
    profile: "legacy25",
    rows: 7
  };
}

function buildGeneratedSeatLayout(seats: SeatAvailability[]): SeatLayoutModel {
  const seatColumns = [1, 2, 4, 5];
  const sortedSeats = [...seats].sort(compareSeats);
  const rows = Math.max(2, Math.ceil(sortedSeats.length / seatColumns.length) + 1);
  const cells: SeatLayoutCell[] = [
    ...baseCabinCells(),
    ...Array.from({ length: rows - 1 }, (_, index) => ({
      column: 3,
      key: `aisle-${index + 2}`,
      kind: "aisle" as const,
      label: index === 0 ? "Pasillo" : undefined,
      row: index + 2
    }))
  ];

  sortedSeats.forEach((seat, index) => {
    const column = seatColumns[index % seatColumns.length];

    cells.push({
      column,
      key: `seat-${seat.seat_id}`,
      kind: "seat",
      position: column === 1 || column === 5 ? "WINDOW" : "AISLE",
      row: Math.floor(index / seatColumns.length) + 2,
      seat
    });
  });

  return {
    cells: cells.sort(sortLayoutCells),
    columns: 5,
    name: `${seats.length} asientos`,
    profile: "generated",
    rows
  };
}

function buildSeatLayout(seats: SeatAvailability[]): SeatLayoutModel {
  if (hasLegacy25Layout(seats)) {
    return buildLegacy25SeatLayout(seats);
  }

  return buildGeneratedSeatLayout(seats);
}

function nextDemoDeparturePayload() {
  const now = new Date();
  const departureAt = new Date(Date.now() + 26 * 60 * 60 * 1000);

  return {
    dispatch_departure_id: crypto.randomUUID(),
    legacy_id: Math.floor(Date.now() / 1000) % 100000,
    bus_id: crypto.randomUUID(),
    bus_code: "BUS-TK",
    bus_plate: "PBT-3301",
    route_id: crypto.randomUUID(),
    route_name: "Quito - Guayaquil",
    origin_terminal_id: crypto.randomUUID(),
    origin_terminal_name: "Terminal Quito",
    destination_terminal_id: crypto.randomUUID(),
    destination_terminal_name: "Terminal Guayaquil",
    departure_at: departureAt.toISOString(),
    status: "SCHEDULED",
    seats: Array.from({ length: 25 }, (_, index) => ({
      seat_number: String(index + 1),
      status: index === 1
        ? "RESERVED"
        : index === 5
          ? "SOLD"
          : index === 12
            ? "BLOCKED"
            : index === 20
              ? "CANCELLED"
              : "AVAILABLE"
    })),
    source_updated_at: now.toISOString()
  };
}

export default function EmbeddedTicketing() {
  const [statusMessage, setStatusMessage] = useState("Inicializando");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shellName, setShellName] = useState("directo");

  const [selectedDepartureId, setSelectedDepartureId] = useState("");
  const [selectedSeatNumber, setSelectedSeatNumber] = useState("");
  const [issuedTicket, setIssuedTicket] = useState<TicketResponse | null>(null);

  const [filters, setFilters] = useState({
    date_from: todayInputValue(),
    date_to: "",
    query: ""
  });

  const [passengerForm, setPassengerForm] = useState<PassengerForm>({
    document_type: "CEDULA",
    document_number: "1919191919",
    email: "marta.cliente@example.com",
    first_name: "Marta",
    last_name: "Cliente",
    phone: "0977777777"
  });

  const [fareForm, setFareForm] = useState({
    currency: "USD",
    fare_amount: "25.50"
  });

  const queryClient = useQueryClient();
  const departuresQuery = useQuery({
    queryKey: ticketingQueryKeys.departures(filters.date_from, filters.date_to),
    queryFn: () => fetchDepartures(filters)
  });
  const departures = departuresQuery.data ?? [];
  const seatMapQuery = useQuery({
    enabled: Boolean(selectedDepartureId),
    queryKey: ticketingQueryKeys.seatMap(selectedDepartureId),
    queryFn: () => fetchSeatMap(selectedDepartureId)
  });
  const seatMap = seatMapQuery.data ?? null;
  const syncDemoDepartureMutation = useMutation({
    mutationFn: () =>
      apiRequest<SeatMap>("/availability/sync/departures", {
        body: JSON.stringify(nextDemoDeparturePayload()),
        method: "POST"
      }),
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo sincronizar la salida demo");
      setStatusMessage("Backend no disponible");
    },
    onSuccess: async (nextSeatMap) => {
      setIssuedTicket(null);
      setSelectedDepartureId(nextSeatMap.dispatch_departure_id);
      setSelectedSeatNumber(nextSeatMap.seats.find((seat) => seat.available)?.seat_number ?? "");
      queryClient.setQueryData(ticketingQueryKeys.seatMap(nextSeatMap.dispatch_departure_id), nextSeatMap);
      await queryClient.invalidateQueries({ queryKey: ticketingQueryKeys.departuresRoot });
      setStatusMessage("Salida demo sincronizada");
    }
  });
  const issueTicketMutation = useMutation({
    mutationFn: ({ body }: { body: unknown; departureId: string }) =>
      apiRequest<TicketResponse>("/tickets", {
        body: JSON.stringify(body),
        method: "POST"
      }),
    onError: async (error, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ticketingQueryKeys.departuresRoot }),
        queryClient.invalidateQueries({ queryKey: ticketingQueryKeys.seatMap(variables.departureId) })
      ]);
      setErrorMessage(saleErrorText(error instanceof Error ? error.message : "No se pudo emitir el boleto"));
    },
    onSuccess: async (nextTicket, variables) => {
      setIssuedTicket(nextTicket);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ticketingQueryKeys.departuresRoot }),
        queryClient.invalidateQueries({ queryKey: ticketingQueryKeys.seatMap(variables.departureId) })
      ]);
      setStatusMessage("Boleto emitido y disponibilidad actualizada");
    }
  });
  const busy = departuresQuery.isFetching
    || seatMapQuery.isFetching
    || syncDemoDepartureMutation.isPending
    || issueTicketMutation.isPending;
  const backendStatus: BackendStatus = departuresQuery.isLoading ? "loading" : departuresQuery.isError ? "offline" : "online";

  const selectedDeparture = useMemo(
    () => departures.find((departure) => departure.dispatch_departure_id === selectedDepartureId) ?? null,
    [departures, selectedDepartureId]
  );
  const seatLayout = useMemo(() => (seatMap ? buildSeatLayout(seatMap.seats) : null), [seatMap]);

  const visibleDepartures = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    if (!query) {
      return departures;
    }

    return departures.filter((departure) => {
      const haystack = [
        departure.route_name,
        departure.bus_code,
        departure.bus_plate ?? "",
        departure.origin_terminal_name,
        departure.destination_terminal_name
      ].join(" ").toLowerCase();

      return haystack.includes(query);
    });
  }, [departures, filters.query]);

  const stats = useMemo(
    () => [
      { label: "Salidas", tone: "green", value: departures.length.toString() },
      { label: "Disponibles", tone: "blue", value: (seatMap?.available_seats ?? 0).toString() },
      { label: "Vendidos", tone: "amber", value: (seatMap?.sold_seats ?? 0).toString() },
      { label: "Ultimo boleto", tone: "coral", value: issuedTicket ? issuedTicket.ticket_number.slice(-6) : "-" }
    ],
    [departures.length, issuedTicket, seatMap]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setShellName(params.get("shell") ?? "directo");
  }, []);

  useEffect(() => {
    if (departuresQuery.isError) {
      setErrorMessage(departuresQuery.error instanceof Error ? departuresQuery.error.message : "ticketing-service no disponible");
      setStatusMessage("Backend no disponible");
    }
  }, [departuresQuery.error, departuresQuery.isError]);

  useEffect(() => {
    if (!departuresQuery.data) {
      return;
    }

    setErrorMessage(null);
    setStatusMessage("Datos actualizados");
    setSelectedDepartureId((current) => {
      if (current && departuresQuery.data.some((departure) => departure.dispatch_departure_id === current)) {
        return current;
      }

      return departuresQuery.data[0]?.dispatch_departure_id ?? "";
    });
  }, [departuresQuery.data]);

  useEffect(() => {
    if (!seatMap) {
      setSelectedSeatNumber("");
      return;
    }

    setSelectedSeatNumber((currentSeat) => {
      const currentStillAvailable = seatMap.seats.some((seat) => seat.seat_number === currentSeat && seat.available);
      if (currentStillAvailable) {
        return currentSeat;
      }

      return seatMap.seats.find((seat) => seat.available)?.seat_number ?? "";
    });
  }, [seatMap]);

  useEffect(() => {
    let animationFrame = 0;

    function postHeight() {
      const height = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight
      );

      window.parent.postMessage({ height, type: "venta-pasajes:mfe-height" }, "*");
    }

    function schedulePostHeight() {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(postHeight);
    }

    schedulePostHeight();
    window.addEventListener("resize", schedulePostHeight);

    const observer = new ResizeObserver(schedulePostHeight);
    observer.observe(document.body);
    observer.observe(document.documentElement);

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener("resize", schedulePostHeight);
    };
  }, []);

  async function refreshData() {
    setErrorMessage(null);

    try {
      const departuresResult = await departuresQuery.refetch();
      if (departuresResult.error) {
        throw departuresResult.error;
      }
      if (selectedDepartureId) {
        const seatMapResult = await seatMapQuery.refetch();
        if (seatMapResult.error) {
          throw seatMapResult.error;
        }
      }
      setStatusMessage("Datos actualizados");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ticketing-service no disponible");
      setStatusMessage("Backend no disponible");
    }
  }

  async function selectDeparture(dispatchDepartureId: string) {
    setErrorMessage(null);
    setIssuedTicket(null);
    setSelectedDepartureId(dispatchDepartureId);

    try {
      await queryClient.fetchQuery({
        queryKey: ticketingQueryKeys.seatMap(dispatchDepartureId),
        queryFn: () => fetchSeatMap(dispatchDepartureId)
      });
      setStatusMessage("Salida seleccionada");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar el mapa de asientos");
    }
  }

  function syncDemoDeparture() {
    setErrorMessage(null);
    setIssuedTicket(null);
    syncDemoDepartureMutation.mutate();
  }

  async function issueTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedDeparture || !selectedSeatNumber || !selectedSeat?.available) {
      setErrorMessage("Seleccione una salida y un asiento libre.");
      return;
    }

    if (!passengerReady) {
      setErrorMessage("Complete documento, nombre y apellido del pasajero.");
      return;
    }

    if (!fareReady) {
      setErrorMessage("Ingrese una tarifa valida y una moneda de 3 letras.");
      return;
    }

    setErrorMessage(null);
    const departureId = selectedDeparture.dispatch_departure_id;
    issueTicketMutation.mutate({
      body: {
        currency: fareForm.currency.trim().toUpperCase(),
        dispatch_departure_id: departureId,
        fare_amount: fareAmount,
        passenger: {
          document_number: passengerForm.document_number.trim(),
          document_type: passengerForm.document_type,
          email: optionalText(passengerForm.email),
          first_name: passengerForm.first_name.trim(),
          last_name: passengerForm.last_name.trim(),
          phone: optionalText(passengerForm.phone)
        },
        reservation_id: null,
        seat_number: selectedSeatNumber
      },
      departureId
    });
  }

  const backendOnline = backendStatus === "online";
  const selectedSeat = seatMap?.seats.find((seat) => seat.seat_number === selectedSeatNumber) ?? null;
  const passengerReady = Boolean(
    passengerForm.document_number.trim()
      && passengerForm.first_name.trim()
      && passengerForm.last_name.trim()
  );
  const fareAmount = Number(fareForm.fare_amount);
  const fareReady = Number.isFinite(fareAmount) && fareAmount >= 0 && fareForm.currency.trim().length === 3;
  const saleReady = Boolean(selectedDeparture && selectedSeat?.available && passengerReady && fareReady);
  const saleSteps = [
    { complete: Boolean(selectedDeparture), label: "Salida" },
    { complete: Boolean(selectedSeat?.available), label: "Asiento" },
    { complete: passengerReady, label: "Pasajero" },
    { complete: Boolean(issuedTicket), label: "Confirmacion" }
  ];
  const activeSaleStepIndex = saleSteps.findIndex((step) => !step.complete);

  return (
    <main className="ticketing-module">
      <header className="module-header">
        <div>
          <p className="eyebrow">MFE Ticketing</p>
          <h1>Boleteria</h1>
        </div>
        <div className="module-actions">
          <span className={backendOnline ? "status-chip status-chip-ok" : "status-chip"}>
            {backendOnline ? "Conectado" : backendStatus === "loading" ? "Cargando" : "Sin backend"}
          </span>
          <button className="icon-button" disabled={busy} onClick={refreshData} title="Actualizar datos" type="button">
            <RefreshCw aria-hidden="true" size={18} />
          </button>
          <button className="secondary-action" disabled={busy} onClick={syncDemoDeparture} type="button">
            <DatabaseZap aria-hidden="true" size={17} />
            <span>Salida demo</span>
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

      <section className="stat-grid" aria-label="Resumen de boleteria">
        {stats.map((stat) => (
          <article className={`stat-card stat-card-${stat.tone}`} key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </section>

      <section className="ticketing-grid">
        <section className="departures-panel" aria-label="Salidas">
          <div className="panel-heading">
            <CalendarClock aria-hidden="true" size={20} />
            <h2>Salidas</h2>
          </div>

          <form className="search-form" onSubmit={(event) => { event.preventDefault(); void refreshData(); }}>
            <label>
              Desde
              <input
                onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))}
                type="date"
                value={filters.date_from}
              />
            </label>
            <label>
              Hasta
              <input
                onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value }))}
                type="date"
                value={filters.date_to}
              />
            </label>
            <label className="search-label">
              Buscar
              <span className="input-with-icon">
                <Search aria-hidden="true" size={16} />
                <input
                  onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
                  placeholder="Ruta, bus o terminal"
                  value={filters.query}
                />
              </span>
            </label>
            <button className="primary-action" disabled={busy} type="submit">
              <RefreshCw aria-hidden="true" size={17} />
              <span>Actualizar</span>
            </button>
          </form>

          <div className="departure-list">
            {visibleDepartures.map((departure) => (
              <button
                className={selectedDepartureId === departure.dispatch_departure_id ? "departure-item departure-item-active" : "departure-item"}
                key={departure.dispatch_departure_id}
                onClick={() => void selectDeparture(departure.dispatch_departure_id)}
                type="button"
              >
                <span className="departure-main">
                  <strong>{departure.route_name}</strong>
                  <span>{departure.origin_terminal_name} - {departure.destination_terminal_name}</span>
                </span>
                <span className="departure-meta">
                  <strong>{formatDate(departure.departure_at)}</strong>
                  <span>{departure.bus_code} {departure.bus_plate ?? ""}</span>
                </span>
                <span className="capacity-line">
                  <span>{departure.available_seats} disponibles</span>
                  <span>{departure.sold_seats} vendidos</span>
                </span>
              </button>
            ))}
            {visibleDepartures.length === 0 ? <div className="empty-state">Sin salidas disponibles</div> : null}
          </div>
        </section>

        <section className="seat-panel" aria-label="Mapa de asientos">
          <div className="panel-heading">
            <BusFront aria-hidden="true" size={20} />
            <h2>Asientos</h2>
          </div>

          {seatMap ? (
            <>
              <div className="trip-summary">
                <strong>{seatMap.route_name}</strong>
                <span>{formatDate(seatMap.departure_at)}</span>
                <span>{seatMap.available_seats} de {seatMap.total_seats} libres</span>
                <span>Layout: {seatLayout?.name ?? "Sin layout"}</span>
              </div>

              <div className="legend" aria-label="Leyenda de asientos">
                <span><i className="legend-dot legend-available" />Libre</span>
                <span><i className="legend-dot legend-reserved" />Reservado</span>
                <span><i className="legend-dot legend-sold" />Vendido</span>
                <span><i className="legend-dot legend-blocked" />Bloqueado</span>
                <span><i className="legend-dot legend-cancelled" />Cancelado</span>
                <span><i className="legend-flag legend-flag-disability">D</i>Discapacidad</span>
                <span><i className="legend-flag legend-flag-child">N</i>Niño</span>
                <span><i className="legend-flag legend-flag-older-adult">AM</i>Adulto mayor</span>
              </div>

              <div className={`bus-visual layout-profile-${seatLayout?.profile ?? "generated"}`} aria-label="Mapa visual">
                {seatLayout ? (
                  <div
                    className="seat-layout-grid"
                    style={{
                      gridTemplateColumns: `repeat(${seatLayout.columns}, var(--seat-cell-size))`,
                      gridTemplateRows: `repeat(${seatLayout.rows}, var(--seat-cell-size))`
                    }}
                  >
                    {seatLayout.cells.map((cell) => {
                      if (cell.kind === "driver") {
                        return (
                          <div className="layout-special layout-driver" key={cell.key} style={gridCellStyle(cell)}>
                            <BusFront aria-hidden="true" size={17} />
                            <span>{cell.label}</span>
                          </div>
                        );
                      }

                      if (cell.kind === "entry") {
                        return (
                          <div className="layout-special layout-entry" key={cell.key} style={gridCellStyle(cell)}>
                            <DoorOpen aria-hidden="true" size={17} />
                            <span>{cell.label}</span>
                          </div>
                        );
                      }

                      if (cell.kind === "aisle") {
                        return (
                          <div className="layout-aisle" key={cell.key} style={gridCellStyle(cell)}>
                            {cell.label ? <span>{cell.label}</span> : null}
                          </div>
                        );
                      }

                      const seat = cell.seat;
                      if (!seat) {
                        return null;
                      }

                      const selected = seat.seat_number === selectedSeatNumber;
                      const passengerFlags = seatPassengerFlags(seat);
                      const passengerFlagsTitle = passengerFlagText(passengerFlags);

                      return (
                        <button
                          className={`seat-button seat-${seatTone(seat.status)} seat-position-${cell.position?.toLowerCase() ?? "aisle"} ${selected ? "seat-selected" : ""}`}
                          disabled={!seat.available || busy}
                          key={seat.seat_id}
                          onClick={() => {
                            setSelectedSeatNumber(seat.seat_number);
                            setIssuedTicket(null);
                          }}
                          style={gridCellStyle(cell)}
                          title={`Asiento ${seat.seat_number} ${seat.status}${passengerFlagsTitle ? ` - ${passengerFlagsTitle}` : ""}`}
                          type="button"
                        >
                          {passengerFlags.length > 0 ? (
                            <span className="seat-flag-stack" aria-label={passengerFlagsTitle}>
                              {passengerFlags.map((flag) => (
                                <i className={`seat-flag seat-flag-${flag.toLowerCase().replace("_", "-")}`} key={flag}>
                                  {PASSENGER_FLAG_LABELS[flag]}
                                </i>
                              ))}
                            </span>
                          ) : null}
                          <Armchair aria-hidden="true" size={15} />
                          <span>{seat.seat_number}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="empty-state empty-state-tall">Sin mapa seleccionado</div>
          )}
        </section>

        <section className="sale-panel" aria-label="Venta">
          <div className="panel-heading">
            <Ticket aria-hidden="true" size={20} />
            <h2>Venta</h2>
          </div>

          <div className="sale-context">
            <div>
              <span>Salida</span>
              <strong>{selectedDeparture ? shortId(selectedDeparture.dispatch_departure_id) : "-"}</strong>
            </div>
            <div>
              <span>Asiento</span>
              <strong>{selectedSeat?.seat_number ?? "-"}</strong>
            </div>
            <div>
              <span>Estado</span>
              <strong>{selectedSeat ? seatStatusLabel(selectedSeat.status) : "-"}</strong>
            </div>
          </div>

          <div className="sale-steps" aria-label="Progreso de venta">
            {saleSteps.map((step, index) => (
              <span
                className={`sale-step ${step.complete ? "sale-step-complete" : ""} ${index === activeSaleStepIndex ? "sale-step-active" : ""}`}
                key={step.label}
              >
                <i>{step.complete ? "OK" : index + 1}</i>
                <span>{step.label}</span>
              </span>
            ))}
          </div>

          <form className="passenger-form" onSubmit={issueTicket}>
            <div className="section-title">
              <UserRound aria-hidden="true" size={17} />
              <span>Pasajero</span>
            </div>

            <div className="compact-grid">
              <label>
                Tipo
                <select
                  onChange={(event) => setPassengerForm((current) => ({ ...current, document_type: event.target.value as DocumentType }))}
                  value={passengerForm.document_type}
                >
                  <option value="CEDULA">CEDULA</option>
                  <option value="PASSPORT">PASSPORT</option>
                  <option value="RUC">RUC</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </label>
              <label>
                Documento
                <input
                  onChange={(event) => setPassengerForm((current) => ({ ...current, document_number: event.target.value }))}
                  required
                  value={passengerForm.document_number}
                />
              </label>
            </div>

            <div className="compact-grid">
              <label>
                Nombre
                <input
                  onChange={(event) => setPassengerForm((current) => ({ ...current, first_name: event.target.value }))}
                  required
                  value={passengerForm.first_name}
                />
              </label>
              <label>
                Apellido
                <input
                  onChange={(event) => setPassengerForm((current) => ({ ...current, last_name: event.target.value }))}
                  required
                  value={passengerForm.last_name}
                />
              </label>
            </div>

            <label>
              Correo
              <input
                onChange={(event) => setPassengerForm((current) => ({ ...current, email: event.target.value }))}
                type="email"
                value={passengerForm.email}
              />
            </label>

            <label>
              Telefono
              <input
                onChange={(event) => setPassengerForm((current) => ({ ...current, phone: event.target.value }))}
                value={passengerForm.phone}
              />
            </label>

            <div className="section-title">
              <CircleDollarSign aria-hidden="true" size={17} />
              <span>Tarifa</span>
            </div>

            <div className="compact-grid">
              <label>
                Monto
                <input
                  min="0"
                  onChange={(event) => setFareForm((current) => ({ ...current, fare_amount: event.target.value }))}
                  step="0.01"
                  type="number"
                  value={fareForm.fare_amount}
                />
              </label>
              <label>
                Moneda
                <input
                  maxLength={3}
                  onChange={(event) => setFareForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                  value={fareForm.currency}
                />
              </label>
            </div>

            <button
              className="primary-action"
              disabled={busy || !saleReady}
              type="submit"
            >
              <Ticket aria-hidden="true" size={17} />
              <span>Emitir boleto</span>
            </button>
          </form>

          {issuedTicket ? (
            <section className="confirmation" aria-label="Confirmacion">
              <CheckCircle2 aria-hidden="true" size={22} />
              <div>
                <strong>{issuedTicket.ticket_number}</strong>
                <span>Asiento {issuedTicket.seat_number}</span>
                <span>{currencyFormatter.format(Number(issuedTicket.fare_amount))}</span>
              </div>
            </section>
          ) : null}
        </section>
      </section>
    </main>
  );
}
