"use client";

import {
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import {
  BarChart3,
  Archive,
  Bell,
  BookOpen,
  BusFront,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Cloud,
  CreditCard,
  FileText,
  Filter,
  Flag,
  Folder,
  Globe2,
  Heart,
  HelpCircle,
  Home,
  Inbox,
  Info,
  CircleAlert,
  Eye,
  GripVertical,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu as MenuIcon,
  Map,
  MapPin,
  MessageSquare,
  Package,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Plane,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  ShoppingCart,
  Settings,
  Ticket,
  Truck,
  Upload,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  Wrench,
  XCircle,
  X
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type IdentityType = "GOOGLE" | "LOCAL";
type TabKey = "users" | "roles" | "permissions" | "sessions" | "menu";
type RoleStatus = "ACTIVE" | "DISABLED" | "DELETED";
type GrowlSeverity = "info" | "warn" | "error";

type CurrentUser = {
  id: string;
  login: string;
  email?: string | null;
  display_name: string;
  status: string;
  roles: string[];
  permissions: string[];
};

type User = {
  id: string;
  legacy_id?: number | null;
  identity_type: IdentityType;
  login: string;
  email?: string | null;
  google_subject?: string | null;
  display_name: string;
  status: string;
  employee_code?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  address?: string | null;
  job_title?: string | null;
  roles: string[];
  assigned_roles?: string[];
  last_login_at?: string | null;
  locked_until?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Role = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  active: boolean;
  status?: RoleStatus;
  permissions: string[];
};

type Permission = {
  code: string;
  description: string;
};

type MenuItem = {
  id: string;
  code: string;
  label: string;
  icon?: string | null;
  target_url: string;
  manifest_url?: string | null;
  informational_only: boolean;
  parent_id?: string | null;
  level: number;
  sort_order: number;
  active: boolean;
  roles: string[];
  children: MenuItem[];
};

type MenuForm = {
  code: string;
  label: string;
  icon: string;
  target_url: string;
  manifest_url: string;
  informational_only: boolean;
  parent_id: string;
  sort_order: number | null;
  active: boolean;
  role_ids: string[];
};

const menuIconCatalog = [
  { code: "Archive", label: "Archivo", icon: Archive },
  { code: "Bell", label: "Alertas", icon: Bell },
  { code: "BookOpen", label: "Ayuda", icon: BookOpen },
  { code: "ShoppingCart", label: "Venta", icon: ShoppingCart },
  { code: "LayoutDashboard", label: "Panel", icon: LayoutDashboard },
  { code: "ShieldCheck", label: "Identidad", icon: ShieldCheck },
  { code: "Building2", label: "Empresa", icon: Building2 },
  { code: "CalendarClock", label: "Calendario", icon: CalendarClock },
  { code: "CalendarDays", label: "Agenda", icon: CalendarDays },
  { code: "CheckCircle2", label: "Completado", icon: CheckCircle2 },
  { code: "ClipboardList", label: "Tareas", icon: ClipboardList },
  { code: "Clock3", label: "Tiempo", icon: Clock3 },
  { code: "Cloud", label: "Nube", icon: Cloud },
  { code: "CreditCard", label: "Pagos", icon: CreditCard },
  { code: "FileText", label: "Documento", icon: FileText },
  { code: "Filter", label: "Filtros", icon: Filter },
  { code: "Flag", label: "Marcador", icon: Flag },
  { code: "Folder", label: "Carpeta", icon: Folder },
  { code: "Globe2", label: "Global", icon: Globe2 },
  { code: "Heart", label: "Favoritos", icon: Heart },
  { code: "HelpCircle", label: "Soporte", icon: HelpCircle },
  { code: "Home", label: "Inicio", icon: Home },
  { code: "Inbox", label: "Bandeja", icon: Inbox },
  { code: "Info", label: "Informacion", icon: Info },
  { code: "Ticket", label: "Boleteria", icon: Ticket },
  { code: "BarChart3", label: "Reportes", icon: BarChart3 },
  { code: "Settings", label: "Configuracion", icon: Settings },
  { code: "Users", label: "Usuarios", icon: Users },
  { code: "KeyRound", label: "Permisos", icon: KeyRound },
  { code: "UserCheck", label: "Usuarios activos", icon: UserCheck },
  { code: "BusFront", label: "Transporte", icon: BusFront },
  { code: "Map", label: "Mapa", icon: Map },
  { code: "MapPin", label: "Ubicacion", icon: MapPin },
  { code: "MessageSquare", label: "Mensajes", icon: MessageSquare },
  { code: "Package", label: "Paquete", icon: Package },
  { code: "Pencil", label: "Edicion", icon: Pencil },
  { code: "Plane", label: "Viajes", icon: Plane },
  { code: "Power", label: "Estado", icon: Power },
  { code: "Route", label: "Ruta", icon: Route },
  { code: "Search", label: "Busqueda", icon: Search },
  { code: "Truck", label: "Carga", icon: Truck },
  { code: "Upload", label: "Carga", icon: Upload },
  { code: "Wallet", label: "Caja", icon: Wallet },
  { code: "Wrench", label: "Herramientas", icon: Wrench },
  { code: "XCircle", label: "Cancelado", icon: XCircle }
];

type IdentitySession = {
  id: string;
  userId: string;
  login: string;
  email?: string | null;
  displayName: string;
  identityType: IdentityType;
  userStatus: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  userAgent?: string | null;
  deviceName?: string | null;
  deviceType?: string | null;
  operatingSystem?: string | null;
  browser?: string | null;
  browserVersion?: string | null;
  location?: string | null;
  ipAddress?: string | null;
  current: boolean;
};

type IdentitySessionData = {
  currentUser: CurrentUser;
  permissions: Permission[];
  roles: Role[];
  users: User[];
};

type IdentityReadyResponse = {
  ready?: boolean;
  target?: string;
};

type PasswordStrength = {
  color: "danger" | "warn" | "ok" | "strong";
  label: string;
  percent: number;
  score: number;
};

type UserEditForm = {
  login: string;
  email: string;
  display_name: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  job_title: string;
  role_ids: string[];
};

function roleStatus(role: Role): RoleStatus {
  return role.status ?? (role.active ? "ACTIVE" : "DELETED");
}

function isRoleActive(role: Role) {
  return roleStatus(role) === "ACTIVE";
}

function isRoleDeleted(role: Role) {
  return roleStatus(role) === "DELETED";
}

function assignedRolesForUser(user: User) {
  return user.assigned_roles ?? user.roles;
}

function displayValue(value?: number | string | null) {
  if (value === null || value === undefined || value === "") {
    return "No registrado";
  }
  return String(value);
}

function displayList(values?: string[] | null) {
  if (!values || values.length === 0) {
    return "Sin registros";
  }
  return values.join(", ");
}

function roleStatusClass(role: Role) {
  const status = roleStatus(role);
  if (status === "ACTIVE") {
    return "pill pill-ok";
  }
  if (status === "DISABLED") {
    return "pill pill-wait";
  }
  return "pill pill-danger";
}

const apiBase = "/api/identity";
const identityReadyCheckPath = "/api/identity-health/ready";
const defaultIdentityReadyUrl = "http://localhost:8081/q/health/ready";
const storageKey = "venta-pasajes.identity.access-token";
const identityQueryKeys = {
  all: ["identity"] as const,
  sessionRoot: ["identity", "session"] as const,
  session: (token: string) => ["identity", "session", token] as const,
  sessions: (token: string) => ["identity", "sessions", token] as const
};

function emptyUserForm() {
  return {
    display_name: "",
    email: "",
    employee_code: "",
    first_name: "",
    job_title: "",
    last_name: "",
    login: "",
    role_ids: [] as string[],
    temporary_password: ""
  };
}

function createUserEditForm(user: User, roles: Role[]): UserEditForm {
  const assignedCodes = new Set(assignedRolesForUser(user));
  return {
    address: user.address ?? "",
    display_name: user.display_name,
    email: user.email ?? "",
    employee_code: user.employee_code ?? "",
    first_name: user.first_name ?? "",
    job_title: user.job_title ?? "",
    last_name: user.last_name ?? "",
    login: user.login,
    phone: user.phone ?? "",
    role_ids: roles.filter((role) => assignedCodes.has(role.code)).map((role) => role.id)
  };
}

function emptyRoleForm() {
  return {
    active: true,
    code: "",
    description: "",
    name: "",
    permission_codes: [] as string[]
  };
}

function emptyMenuForm(): MenuForm {
  return {
    active: true,
    code: "",
    icon: "LayoutDashboard",
    informational_only: false,
    label: "",
    manifest_url: "",
    parent_id: "",
    role_ids: [],
    sort_order: null,
    target_url: "/"
  };
}

function flattenMenu(items: MenuItem[], result: MenuItem[] = []) {
  for (const item of items) {
    result.push(item);
    flattenMenu(item.children, result);
  }
  return result;
}

function findMenuItem(items: MenuItem[], id: string | null): MenuItem | null {
  if (!id) {
    return null;
  }
  for (const item of items) {
    if (item.id === id) {
      return item;
    }
    const descendant = findMenuItem(item.children, id);
    if (descendant) {
      return descendant;
    }
  }
  return null;
}

function findMenuRoot(items: MenuItem[], id: string | null): MenuItem | null {
  if (!id) {
    return null;
  }
  for (const item of items) {
    if (item.id === id || findMenuItem(item.children, id)) {
      return item;
    }
  }
  return null;
}

function passwordStrength(password: string): PasswordStrength {
  const checks = [
    password.length >= 12,
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ];
  const score = checks.filter(Boolean).length;

  if (!password) {
    return { color: "danger", label: "Sin contrasena", percent: 0, score: 0 };
  }
  if (score <= 2) {
    return { color: "danger", label: "Debil", percent: 25, score };
  }
  if (score === 3) {
    return { color: "warn", label: "Media", percent: 55, score };
  }
  if (score === 4) {
    return { color: "ok", label: "Fuerte", percent: 80, score };
  }
  return { color: "strong", label: "Muy fuerte", percent: 100, score };
}

function PasswordStrengthMeter({ value }: { value: string }) {
  const strength = passwordStrength(value);

  return (
    <div className="password-strength" aria-live="polite">
      <div className="password-strength-row">
        <span>Fortaleza</span>
        <strong className={`password-strength-label password-strength-label-${strength.color}`}>{strength.label}</strong>
      </div>
      <div className="password-strength-track" aria-hidden="true">
        <span className={`password-strength-bar password-strength-bar-${strength.color}`} style={{ width: `${strength.percent}%` }} />
      </div>
      <p>Usa al menos 12 caracteres, mayusculas, minusculas, numeros y simbolos.</p>
    </div>
  );
}

function parseApiError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string") {
      return error.message;
    }
  }
  return fallback;
}

function parseResponsePayload(responseText: string, contentType: string) {
  if (!responseText) {
    return null;
  }

  const trimmed = responseText.trim();
  const looksLikeJson = contentType.includes("application/json") || trimmed.startsWith("{") || trimmed.startsWith("[");
  if (!looksLikeJson) {
    return {
      error: {
        message: "identity-service devolvio una respuesta no JSON. Revisa que el servicio este levantado y que IDENTITY_API_URL apunte a /api/v1/identity."
      }
    };
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return {
      error: {
        message: "identity-service devolvio JSON invalido."
      }
    };
  }
}

async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(options.headers);
  const hasBody = options.body !== undefined && options.body !== null;

  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    cache: "no-store",
    headers
  });

  const responseText = await response.text();
  const payload = parseResponsePayload(responseText, response.headers.get("content-type") ?? "");

  if (!response.ok) {
    throw new Error(parseApiError(payload, `HTTP ${response.status}`));
  }

  return payload as T;
}

async function fetchIdentitySession(token: string): Promise<IdentitySessionData> {
  const [currentUser, users, roles, permissions] = await Promise.all([
    apiRequest<CurrentUser>("/me", {}, token),
    apiRequest<User[]>("/users", {}, token),
    apiRequest<Role[]>("/roles", {}, token),
    apiRequest<Permission[]>("/permissions", {}, token)
  ]);

  return {
    currentUser,
    permissions,
    roles,
    users
  };
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Nunca";
  }
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function useShellName() {
  const [shellName, setShellName] = useState("directo");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setShellName(params.get("shell") ?? "directo");
  }, []);

  return shellName;
}

export default function EmbeddedIdentity() {
  const shellName = useShellName();
  const [activeTab, setActiveTab] = useState<TabKey>("users");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Sin sesion");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newUser, setNewUser] = useState(emptyUserForm);
  const [newUserOpen, setNewUserOpen] = useState(false);
  const newUserDialogRef = useRef<HTMLDialogElement>(null);
  const newUserLoginRef = useRef<HTMLInputElement>(null);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [roleDeleteCandidate, setRoleDeleteCandidate] = useState<Role | null>(null);
  const [roleDeleteConfirmation, setRoleDeleteConfirmation] = useState("");
  const [menuForm, setMenuForm] = useState<MenuForm>(emptyMenuForm);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [menuDialogOpen, setMenuDialogOpen] = useState(false);
  const [menuActionsOpen, setMenuActionsOpen] = useState(false);
  const [iconCatalogOpen, setIconCatalogOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const [selectedMenuPreview, setSelectedMenuPreview] = useState<MenuItem | null>(null);
  const [selectedMenuParent, setSelectedMenuParent] = useState<MenuItem | null>(null);
  const [draggingTreeMenuId, setDraggingTreeMenuId] = useState<string | null>(null);
  const menuDialogRef = useRef<HTMLDialogElement>(null);
  const iconCatalogDialogRef = useRef<HTMLDialogElement>(null);
  const menuTreeContentRef = useRef<HTMLDivElement>(null);
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<User | null>(null);
  const [selectedUserEdit, setSelectedUserEdit] = useState<User | null>(null);
  const [userEditForm, setUserEditForm] = useState<UserEditForm | null>(null);
  const [userEditLoading, setUserEditLoading] = useState(false);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [identityHealthDown, setIdentityHealthDown] = useState(false);
  const [identityHealthRetryIn, setIdentityHealthRetryIn] = useState(5);
  const [identityHealthRetryCycle, setIdentityHealthRetryCycle] = useState(0);
  const [identityReadyUrl, setIdentityReadyUrl] = useState(defaultIdentityReadyUrl);
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({
    enabled: Boolean(accessToken),
    queryKey: identityQueryKeys.session(accessToken ?? "sin-token"),
    queryFn: () => fetchIdentitySession(accessToken as string)
  });
  const sessionData = sessionQuery.data;
  const currentUser = sessionData?.currentUser ?? null;
  const users = sessionData?.users ?? [];
  const roles = sessionData?.roles ?? [];
  const permissions = sessionData?.permissions ?? [];
  const canViewSessions = Boolean(currentUser?.permissions.includes("identity.sessions.read"));
  const canRevokeSessions = Boolean(currentUser?.permissions.includes("identity.sessions.revoke"));
  const sessionsQuery = useQuery({
    enabled: Boolean(accessToken && canViewSessions),
    queryKey: identityQueryKeys.sessions(accessToken ?? "sin-token"),
    queryFn: () => apiRequest<IdentitySession[]>("/sessions", {}, accessToken)
  });
  const canReadMenu = Boolean(currentUser?.permissions.includes("identity.menu.read"));
  const canManageMenu = Boolean(currentUser?.permissions.includes("identity.menu.manage"));
  const menuQuery = useQuery({
    enabled: Boolean(accessToken && canReadMenu),
    queryKey: ["identity", "menu", "admin", accessToken],
    queryFn: () => apiRequest<MenuItem[]>("/menu/admin", {}, accessToken)
  });
  const menuItems = menuQuery.data ?? [];
  const flatMenuItems = useMemo(() => flattenMenu(menuItems), [menuItems]);
  const filteredMenuIcons = useMemo(() => {
    const query = iconSearch.trim().toLowerCase();
    if (!query) {
      return menuIconCatalog;
    }
    return menuIconCatalog.filter((option) => `${option.code} ${option.label}`.toLowerCase().includes(query));
  }, [iconSearch]);
  const selectedMenuIcon = menuIconCatalog.find((option) => option.code === menuForm.icon) ?? menuIconCatalog[0];
  const sessions = sessionsQuery.data ?? [];
  const activeRoles = useMemo(() => roles.filter((role) => isRoleActive(role)), [roles]);
  const roleDeleteAssignedUsers = useMemo(() => {
    if (!roleDeleteCandidate) {
      return [];
    }

    return users.filter((user) => assignedRolesForUser(user).includes(roleDeleteCandidate.code));
  }, [roleDeleteCandidate, users]);
  const permissionDetailRoles = useMemo(() => {
    if (!selectedPermission) {
      return [];
    }

    return roles.filter((role) => !isRoleDeleted(role) && role.permissions.includes(selectedPermission.code));
  }, [roles, selectedPermission]);
  const permissionDetailUsers = useMemo(() => {
    const activeRoleCodes = new Set(permissionDetailRoles.filter((role) => isRoleActive(role)).map((role) => role.code));
    if (activeRoleCodes.size === 0) {
      return [];
    }

    return users.filter((user) => user.roles.some((roleCode) => activeRoleCodes.has(roleCode)));
  }, [permissionDetailRoles, users]);
  const notifyShell = useCallback((severity: GrowlSeverity, summary: string, detail?: string) => {
    if (window.parent === window) {
      return;
    }

    window.parent.postMessage({
      detail,
      severity,
      source: "mfe-identity",
      summary,
      type: "venta-pasajes:growl"
    }, "*");
  }, []);

  const actionMutation = useMutation({
    mutationFn: async ({ action }: { action: () => Promise<void>; successMessage: string }) => {
      await action();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Operacion no completada";
      setErrorMessage(message);
      notifyShell("error", "Error", message);
    },
    onSuccess: (_data, variables) => {
      setErrorMessage(null);
      setStatusMessage(variables.successMessage);
      notifyShell("info", "Operacion completada", variables.successMessage);
    }
  });
  const busy = sessionQuery.isFetching || sessionsQuery.isFetching || menuQuery.isFetching || actionMutation.isPending;

  const tabs = useMemo(
    () => [
      { key: "users" as const, label: "Usuarios", icon: Users },
      { key: "roles" as const, label: "Roles", icon: ShieldCheck },
      { key: "permissions" as const, label: "Permisos", icon: KeyRound },
      { key: "sessions" as const, label: "Sesiones", icon: UserCheck },
      { key: "menu" as const, label: "Menu", icon: MenuIcon }
    ].filter((tab) => (tab.key !== "sessions" || canViewSessions) && (tab.key !== "menu" || canReadMenu)),
    [canReadMenu, canViewSessions]
  );

  const stats = useMemo(
    () => [
      { label: "Usuarios", value: users.length.toString(), icon: Users, tone: "green" },
      { label: "Roles", value: roles.length.toString(), icon: ShieldCheck, tone: "blue" },
      { label: "Permisos", value: permissions.length.toString(), icon: KeyRound, tone: "coral" },
      ...(canViewSessions ? [{ label: "Sesiones", value: sessions.length.toString(), icon: UserCheck, tone: "green" }] : [])
    ],
    [canViewSessions, permissions.length, roles.length, sessions.length, users.length]
  );

  const hasSession = Boolean(accessToken && currentUser);

  useEffect(() => {
    const dialog = newUserDialogRef.current;
    if (!newUserOpen || !hasSession || !dialog) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    dialog.showModal();
    newUserLoginRef.current?.focus();
    document.body.style.overflow = "hidden";

    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
  }, [hasSession, newUserOpen]);

  useEffect(() => {
    const dialog = menuDialogRef.current;
    if (!menuDialogOpen || !hasSession || !dialog) {
      return;
    }

    dialog.showModal();
    return () => {
      dialog.close();
    };
  }, [hasSession, menuDialogOpen]);

  useEffect(() => {
    const dialog = iconCatalogDialogRef.current;
    if (!iconCatalogOpen || !hasSession || !dialog) {
      return;
    }

    dialog.showModal();
    return () => {
      dialog.close();
    };
  }, [hasSession, iconCatalogOpen]);

  useEffect(() => {
    if (!menuItems.length) {
      setSelectedMenuPreview(null);
      setSelectedMenuParent(null);
      return;
    }
    setSelectedMenuPreview((current) => findMenuRoot(menuItems, current?.id ?? null) ?? current ?? menuItems[0]);
    setSelectedMenuParent((current) => findMenuItem(menuItems, current?.id ?? null) ?? current ?? menuItems[0]);
  }, [menuItems]);

  useEffect(() => {
    const treeContent = menuTreeContentRef.current;
    if (treeContent) {
      treeContent.scrollLeft = 0;
      treeContent.scrollTop = 0;
    }
  }, [selectedMenuPreview?.id]);

  const checkIdentityReady = useCallback(async () => {
    try {
      const response = await fetch(identityReadyCheckPath, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as IdentityReadyResponse | null;
      const target = typeof payload?.target === "string" ? payload.target : defaultIdentityReadyUrl;
      const ready = response.ok && payload?.ready === true;

      setIdentityReadyUrl(target);
      setIdentityHealthDown(!ready);
      if (ready) {
        setIdentityHealthRetryIn(5);
        setIdentityHealthRetryCycle(0);
      }
    } catch {
      setIdentityReadyUrl(defaultIdentityReadyUrl);
      setIdentityHealthDown(true);
    }
  }, []);

  async function reloadProtectedData(token: string) {
    const nextSession = await queryClient.fetchQuery({
      queryKey: identityQueryKeys.session(token),
      queryFn: () => fetchIdentitySession(token)
    });
    setStatusMessage(`Sesion activa: ${nextSession.currentUser.login}`);
    return nextSession;
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
    const storedToken = window.sessionStorage.getItem(storageKey);
    if (!storedToken) {
      return;
    }

    setAccessToken(storedToken);
  }, []);

  useEffect(() => {
    function handleShellAuthMessage(event: MessageEvent) {
      if (event.source !== window.parent || !event.data || typeof event.data !== "object") {
        return;
      }

      const data = event.data as { accessToken?: unknown; type?: unknown };
      if (data.type === "venta-pasajes:shell-auth-token" && typeof data.accessToken === "string" && data.accessToken.trim()) {
        window.sessionStorage.setItem(storageKey, data.accessToken);
        setAccessToken(data.accessToken);
        setStatusMessage("Sesion recibida desde shell");
        setErrorMessage(null);
        return;
      }

      if (data.type === "venta-pasajes:shell-auth-clear") {
        window.sessionStorage.removeItem(storageKey);
        queryClient.removeQueries({ queryKey: identityQueryKeys.all });
        setAccessToken(null);
        setStatusMessage("Token requerido");
      }
    }

    window.addEventListener("message", handleShellAuthMessage);
    if (window.parent !== window) {
      window.parent.postMessage({
        source: "mfe-identity",
        type: "venta-pasajes:mfe-auth-ready"
      }, "*");
    }

    return () => window.removeEventListener("message", handleShellAuthMessage);
  }, [queryClient]);

  useEffect(() => {
    if (sessionQuery.isError) {
      const message = sessionQuery.error instanceof Error ? sessionQuery.error.message : "No se pudo cargar la sesion";
      setErrorMessage(message);
      setStatusMessage("Token requerido");
      notifyShell("error", "Sesion no disponible", message);
    }
  }, [sessionQuery.error, sessionQuery.isError, notifyShell]);

  useEffect(() => {
    if (sessionQuery.isSuccess && currentUser && (statusMessage === "Sin sesion" || statusMessage === "Token requerido")) {
      setErrorMessage(null);
      setStatusMessage(`Sesion activa: ${currentUser.login}`);
    }
  }, [currentUser, sessionQuery.isSuccess, statusMessage]);

  useEffect(() => {
    if (identityHealthDown) {
      return;
    }

    void checkIdentityReady();
    const checkInterval = window.setInterval(() => {
      void checkIdentityReady();
    }, 10000);

    return () => window.clearInterval(checkInterval);
  }, [checkIdentityReady, identityHealthDown]);

  useEffect(() => {
    if (!identityHealthDown) {
      return;
    }

    setIdentityHealthRetryIn(5);
    setIdentityHealthRetryCycle((current) => current + 1);
    const countdownInterval = window.setInterval(() => {
      setIdentityHealthRetryIn((current) => current <= 1 ? 5 : current - 1);
    }, 1000);
    const retryInterval = window.setInterval(() => {
      setIdentityHealthRetryCycle((current) => current + 1);
      void checkIdentityReady();
    }, 5000);

    return () => {
      window.clearInterval(countdownInterval);
      window.clearInterval(retryInterval);
    };
  }, [checkIdentityReady, identityHealthDown]);

  async function refreshData() {
    if (!accessToken) {
      const message = "Token requerido.";
      setErrorMessage(message);
      notifyShell("warn", "Sesion requerida", message);
      return;
    }
    await runAction(async () => {
      await queryClient.invalidateQueries({ queryKey: identityQueryKeys.sessionRoot });
      await queryClient.invalidateQueries({ queryKey: ["identity", "sessions"] });
      await reloadProtectedData(accessToken);
    }, "Datos actualizados");
  }

  function openNewUser() {
    setNewUser(emptyUserForm());
    setErrorMessage(null);
    setNewUserOpen(true);
  }

  function closeNewUser() {
    if (actionMutation.isPending) {
      return;
    }
    setNewUserOpen(false);
    setNewUser(emptyUserForm());
    setErrorMessage(null);
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || actionMutation.isPending) {
      return;
    }

    await runAction(async () => {
      await apiRequest<User>("/users", {
        body: JSON.stringify(newUser),
        method: "POST"
      }, accessToken);
      setNewUser(emptyUserForm());
      setNewUserOpen(false);
      await queryClient.invalidateQueries({ queryKey: identityQueryKeys.sessionRoot });
    }, "Usuario creado");
  }

  async function setUserStatus(userId: string, action: "activate" | "suspend") {
    if (!accessToken) {
      return;
    }

    await runAction(async () => {
      await apiRequest<User>(`/users/${userId}/${action}`, {
        body: JSON.stringify({}),
        method: "POST"
      }, accessToken);
      await queryClient.invalidateQueries({ queryKey: identityQueryKeys.sessionRoot });
    }, action === "activate" ? "Usuario activado" : "Usuario suspendido");
  }

  async function openUserDetail(user: User) {
    if (!accessToken) {
      return;
    }

    setSelectedUserDetail(user);
    setUserDetailLoading(true);
    try {
      const userDetail = await apiRequest<User>(`/users/${user.id}`, {}, accessToken);
      setSelectedUserDetail(userDetail);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo consultar el usuario.";
      setErrorMessage(message);
      notifyShell("error", "Error", message);
    } finally {
      setUserDetailLoading(false);
    }
  }

  async function revokeIdentitySession(session: IdentitySession) {
    if (!accessToken) {
      return;
    }

    await runAction(async () => {
      await apiRequest<void>(`/sessions/${session.id}/revoke`, {
        method: "POST"
      }, accessToken);
      await queryClient.invalidateQueries({ queryKey: identityQueryKeys.sessions(accessToken) });
    }, session.current ? "Sesion actual revocada" : `Sesion de ${session.login} revocada`);

    if (session.current) {
      window.sessionStorage.removeItem(storageKey);
      window.parent.postMessage({ source: "mfe-identity", type: "venta-pasajes:mfe-auth-revoked" }, "*");
      setAccessToken(null);
    }
  }

  async function logoutUserSessions(user: User) {
    if (!accessToken || !canRevokeSessions) {
      return;
    }
    const activeSessions = sessions.filter((session) => session.userId === user.id);
    if (activeSessions.length === 0) {
      return;
    }
    if (!window.confirm(`¿Cerrar todas las sesiones activas de ${user.login}?`)) {
      return;
    }

    await runAction(async () => {
      await apiRequest<void>(`/users/${user.id}/logout`, { method: "POST" }, accessToken);
      await queryClient.invalidateQueries({ queryKey: identityQueryKeys.sessions(accessToken) });
    }, `Sesiones de ${user.login} cerradas`);

    if (user.id === currentUser?.id) {
      window.sessionStorage.removeItem(storageKey);
      window.parent.postMessage({ source: "mfe-identity", type: "venta-pasajes:mfe-auth-revoked" }, "*");
      setAccessToken(null);
    }
  }

  async function openUserEdit(user: User) {
    if (!accessToken) {
      return;
    }

    setErrorMessage(null);
    setSelectedUserEdit(user);
    setUserEditLoading(true);
    try {
      const userDetail = await apiRequest<User>(`/users/${user.id}`, {}, accessToken);
      setSelectedUserEdit(userDetail);
      setUserEditForm(createUserEditForm(userDetail, roles));
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cargar el usuario.";
      setSelectedUserEdit(null);
      setErrorMessage(message);
      notifyShell("error", "Error", message);
    } finally {
      setUserEditLoading(false);
    }
  }

  function closeUserEdit(force = false) {
    if (actionMutation.isPending && !force) {
      return;
    }
    setSelectedUserEdit(null);
    setUserEditForm(null);
    setUserEditLoading(false);
  }

  function toggleEditUserRole(roleId: string) {
    setUserEditForm((current) => current ? {
      ...current,
      role_ids: current.role_ids.includes(roleId)
        ? current.role_ids.filter((id) => id !== roleId)
        : [...current.role_ids, roleId]
    } : current);
  }

  async function updateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !selectedUserEdit || !userEditForm || actionMutation.isPending) {
      return;
    }

    const duplicateGoogle = users.find((user) =>
      user.id !== selectedUserEdit.id &&
      user.identity_type === "GOOGLE" &&
      user.email?.toLowerCase() === userEditForm.email.trim().toLowerCase()
    );
    if (selectedUserEdit.identity_type === "LOCAL" && duplicateGoogle) {
      const message = "Advertencia: este correo ya pertenece a una cuenta GOOGLE registrada. Utiliza otro correo.";
      setErrorMessage(message);
      notifyShell("warn", "Correo GOOGLE ya registrado", message);
      return;
    }

    await runAction(async () => {
      await apiRequest<User>(`/users/${selectedUserEdit.id}`, {
        body: JSON.stringify(userEditForm),
        method: "PATCH"
      }, accessToken);
      closeUserEdit(true);
      await queryClient.invalidateQueries({ queryKey: identityQueryKeys.sessionRoot });
    }, "Usuario actualizado");
  }

  function closeUserDetail() {
    setSelectedUserDetail(null);
    setUserDetailLoading(false);
  }

  function selectRoleForEdit(role: Role) {
    if (isRoleDeleted(role)) {
      const message = "No se puede editar un rol eliminado.";
      setErrorMessage(message);
      notifyShell("warn", "Rol no editable", message);
      return;
    }

    setRoleDeleteCandidate(null);
    setRoleDeleteConfirmation("");
    setEditingRoleId(role.id);
    setRoleForm({
      active: isRoleActive(role),
      code: role.code,
      description: role.description ?? "",
      name: role.name,
      permission_codes: role.permissions
    });
    setStatusMessage(`Editando rol: ${role.code}`);
    notifyShell("info", "Editando rol", role.code);
  }

  function clearRoleForm() {
    setEditingRoleId(null);
    setRoleForm(emptyRoleForm());
  }

  function selectRoleForDelete(role: Role) {
    if (isRoleDeleted(role)) {
      const message = "El rol ya esta eliminado.";
      setErrorMessage(message);
      notifyShell("warn", "Rol ya eliminado", message);
      return;
    }

    if (role.code === "ADMIN") {
      const message = "El rol ADMIN esta protegido y no se puede borrar.";
      setErrorMessage(message);
      notifyShell("warn", "Rol protegido", message);
      return;
    }

    clearRoleForm();
    setErrorMessage(null);
    setRoleDeleteCandidate(role);
    setRoleDeleteConfirmation("");
    setStatusMessage(`Preparando borrado logico: ${role.code}`);
    notifyShell("warn", "Confirmacion requerida", `Revisa los usuarios afectados antes de borrar ${role.code}.`);
  }

  async function updateRoleStatus(role: Role, active: boolean) {
    if (!accessToken || isRoleDeleted(role)) {
      return;
    }

    await runAction(async () => {
      await apiRequest<Role>(`/roles/${role.id}`, {
        body: JSON.stringify({ active }),
        method: "PATCH"
      }, accessToken);
      await queryClient.invalidateQueries({ queryKey: identityQueryKeys.sessionRoot });
    }, active ? `Rol ${role.code} habilitado` : `Rol ${role.code} deshabilitado`);
  }

  function cancelRoleDelete() {
    setRoleDeleteCandidate(null);
    setRoleDeleteConfirmation("");
  }

  async function submitRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      return;
    }

    await runAction(async () => {
      const payload = {
        active: roleForm.active,
        code: roleForm.code,
        description: roleForm.description,
        name: roleForm.name,
        permission_codes: roleForm.permission_codes
      };
      await apiRequest<Role>(editingRoleId ? `/roles/${editingRoleId}` : "/roles", {
        body: JSON.stringify(editingRoleId ? payload : {
          code: payload.code,
          description: payload.description,
          name: payload.name,
          permission_codes: payload.permission_codes
        }),
        method: editingRoleId ? "PUT" : "POST"
      }, accessToken);
      clearRoleForm();
      cancelRoleDelete();
      await queryClient.invalidateQueries({ queryKey: identityQueryKeys.sessionRoot });
    }, editingRoleId ? "Rol actualizado" : "Rol creado");
  }

  async function deleteRole() {
    const role = roleDeleteCandidate;
    if (!accessToken || !role || roleDeleteConfirmation !== "delete") {
      return;
    }

    await runAction(async () => {
      await apiRequest<Role>(`/roles/${role.id}`, { method: "DELETE" }, accessToken);
      setNewUser((current) => ({
        ...current,
        role_ids: current.role_ids.filter((roleId) => roleId !== role.id)
      }));
      cancelRoleDelete();
      await queryClient.invalidateQueries({ queryKey: identityQueryKeys.sessionRoot });
    }, `Rol ${role.code} eliminado logicamente`);
  }

  function toggleNewUserRole(roleId: string) {
    setNewUser((current) => ({
      ...current,
      role_ids: current.role_ids.includes(roleId)
        ? current.role_ids.filter((id) => id !== roleId)
        : [...current.role_ids, roleId]
    }));
  }

  function toggleRolePermission(permissionCode: string) {
    setRoleForm((current) => ({
      ...current,
      permission_codes: current.permission_codes.includes(permissionCode)
        ? current.permission_codes.filter((code) => code !== permissionCode)
        : [...current.permission_codes, permissionCode]
    }));
  }

  function selectMenuForEdit(item: MenuItem) {
    const root = item.level === 1 ? item : flatMenuItems.find((candidate) => candidate.id === item.parent_id) ?? null;
    setSelectedMenuPreview(root);
    setSelectedMenuParent(root);
    setEditingMenuId(item.id);
    setMenuForm({
      active: item.active,
      code: item.code,
      icon: item.icon ?? "LayoutDashboard",
      informational_only: item.informational_only ?? false,
      label: item.label,
      manifest_url: item.manifest_url ?? "",
      parent_id: item.parent_id ?? "",
      role_ids: roles.filter((role) => item.roles.includes(role.code)).map((role) => role.id),
      sort_order: item.sort_order,
      target_url: item.target_url
    });
    setErrorMessage(null);
    setMenuDialogOpen(true);
  }

  function clearMenuForm() {
    setEditingMenuId(null);
    setMenuForm(emptyMenuForm());
  }

  function openNewMenu() {
    clearMenuForm();
    setErrorMessage(null);
    setMenuActionsOpen(false);
    setMenuDialogOpen(true);
  }

  function openNewMenuChild(parent: MenuItem) {
    clearMenuForm();
    setMenuForm((current) => ({ ...current, parent_id: parent.id }));
    setErrorMessage(null);
    setMenuDialogOpen(true);
  }

  function closeMenuDialog() {
    if (actionMutation.isPending) {
      return;
    }
    setMenuDialogOpen(false);
    clearMenuForm();
  }

  function openIconCatalog() {
    setIconSearch("");
    setIconCatalogOpen(true);
  }

  function closeIconCatalog() {
    setIconCatalogOpen(false);
  }

  function selectMenuIcon(code: string) {
    setMenuForm((current) => ({ ...current, icon: code }));
    setIconCatalogOpen(false);
  }

  function toggleMenuRole(roleId: string) {
    setMenuForm((current) => ({
      ...current,
      role_ids: current.role_ids.includes(roleId)
        ? current.role_ids.filter((id) => id !== roleId)
        : [...current.role_ids, roleId]
    }));
  }

  async function submitMenuItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !canManageMenu) {
      return;
    }
    await runAction(async () => {
      await apiRequest<MenuItem>(editingMenuId ? `/menu/${editingMenuId}` : "/menu", {
        body: JSON.stringify(menuForm),
        method: editingMenuId ? "PATCH" : "POST"
      }, accessToken);
      clearMenuForm();
      setMenuDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["identity", "menu"] });
    }, editingMenuId ? "Opcion de menu actualizada" : "Opcion de menu creada");
  }

  async function deleteMenuItem(item: MenuItem) {
    if (!accessToken || !canManageMenu || !window.confirm(`¿Eliminar ${item.label} y sus subniveles?`)) {
      return;
    }
    await runAction(async () => {
      await apiRequest<void>(`/menu/${item.id}`, { method: "DELETE" }, accessToken);
      if (editingMenuId === item.id) {
        clearMenuForm();
      }
      await queryClient.invalidateQueries({ queryKey: ["identity", "menu"] });
    }, "Opcion de menu eliminada");
  }

  async function moveMenuNode(sourceId: string, target: MenuItem) {
    if (!accessToken || !draggingTreeMenuId || sourceId === target.id) {
      return;
    }
    const source = flatMenuItems.find((item) => item.id === sourceId);
    if (!source) {
      setDraggingTreeMenuId(null);
      return;
    }

    const movingToFirstPosition = source.parent_id === target.id;
    const siblingSortOrders = movingToFirstPosition
      ? target.children.filter((child) => child.id !== source.id).map((child) => child.sort_order)
      : [];
    const nextSortOrder = movingToFirstPosition
      ? (siblingSortOrders.length > 0 ? Math.min(...siblingSortOrders) - 10 : 10)
      : (target.children.length + 1) * 10;

    await runAction(async () => {
      await apiRequest<MenuItem>(`/menu/${source.id}`, {
        body: JSON.stringify({ parent_id: target.id, sort_order: nextSortOrder }),
        method: "PATCH"
      }, accessToken);
      await queryClient.invalidateQueries({ queryKey: ["identity", "menu"] });
      const refreshedMenu = queryClient.getQueryData<MenuItem[]>(["identity", "menu", "admin", accessToken]) ?? [];
      setSelectedMenuPreview(refreshedMenu.find((item) => item.id === selectedMenuPreview?.id) ?? refreshedMenu[0] ?? null);
      setSelectedMenuParent(findMenuItem(refreshedMenu, selectedMenuParent?.id ?? null) ?? refreshedMenu[0] ?? null);
    }, movingToFirstPosition
      ? `${source.label} ahora es la primera subopcion de ${target.label}`
      : `${source.label} ahora depende de ${target.label}`);
    setDraggingTreeMenuId(null);
  }

  const SelectedMenuIcon = selectedMenuIcon.icon;

  function renderMenuPreview(items: MenuItem[], depth = 0): ReactNode {
    return items.map((item) => {
      const Icon = menuIconCatalog.find((option) => option.code === item.icon)?.icon ?? LayoutDashboard;
      return (
        <div className="menu-tree-node" key={item.id} style={{ marginLeft: `${depth * 18}px` }}>
          <div
            aria-pressed={selectedMenuParent?.id === item.id}
            className={selectedMenuParent?.id === item.id ? "menu-tree-node-label menu-tree-node-label-selected" : "menu-tree-node-label"}
            draggable={!busy}
            onDragEnd={() => setDraggingTreeMenuId(null)}
            onDragOver={(event) => event.preventDefault()}
            onDragStart={() => setDraggingTreeMenuId(item.id)}
            onDrop={() => {
              if (draggingTreeMenuId) {
                void moveMenuNode(draggingTreeMenuId, item);
              }
            }}
            onClick={() => setSelectedMenuParent(item)}
            title="Selecciona este nodo para agregarle hijos o arrastralo para cambiar su nivel"
          >
            <GripVertical aria-hidden="true" size={15} />
            <Icon aria-hidden="true" size={16} />
            <div><strong>{item.label}</strong><span>{item.code}</span></div>
            {item.level > 1 && canManageMenu ? (
              <button
                aria-label={`Editar ${item.label}`}
                className="menu-tree-edit-button"
                onClick={(event) => {
                  event.stopPropagation();
                  selectMenuForEdit(item);
                }}
                onMouseDown={(event) => event.stopPropagation()}
                title={`Editar ${item.label}`}
                type="button"
              >
                <Pencil aria-hidden="true" size={14} />
              </button>
            ) : null}
          </div>
          {item.children.length > 0 ? renderMenuPreview(item.children, depth + 1) : null}
        </div>
      );
    });
  }

  return (
    <main className="identity-module">
      <header className="module-header">
        <div>
          <p className="eyebrow">MFE Identity</p>
          <h1>Identidad y accesos</h1>
        </div>
        <div className="module-actions">
          <span className={hasSession ? "status-chip status-chip-ok" : "status-chip"}>
            {hasSession ? "Conectado" : "Sin sesion"}
          </span>
          <button className="icon-button" disabled={busy || !hasSession} onClick={refreshData} title="Actualizar datos" type="button">
            <RefreshCw aria-hidden="true" size={18} />
          </button>
        </div>
      </header>

      <section className="system-strip" aria-label="Estado">
        <span>Shell: {shellName}</span>
        <span>API: {apiBase}</span>
        <span>{statusMessage}</span>
      </section>

      {errorMessage && !newUserOpen && !selectedUserEdit ? (
        <div className="alert alert-error" role="alert">
          <CircleAlert aria-hidden="true" size={18} />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <section className="auth-grid auth-grid-session-only" aria-label="Sesion global">
        <section className="session-panel" aria-label="Sesion recibida desde el shell">
          <div className="panel-heading">
            <UserCheck aria-hidden="true" size={19} />
            <h2>Sesion global del shell</h2>
          </div>
          {currentUser ? (
            <dl className="session-list">
              <div>
                <dt>Usuario</dt>
                <dd>{currentUser.login}</dd>
              </div>
              <div>
                <dt>Nombre</dt>
                <dd>{currentUser.display_name}</dd>
              </div>
              <div>
                <dt>Roles</dt>
                <dd>{currentUser.roles.join(", ") || "Sin roles"}</dd>
              </div>
            </dl>
          ) : (
            <div className="empty-state">Ingresa desde /login en el shell para habilitar este modulo.</div>
          )}
        </section>
      </section>

      <section className="stat-grid" aria-label="Resumen de identidad">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article className={`stat-card stat-card-${stat.tone}`} key={stat.label}>
              <Icon aria-hidden="true" size={20} />
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </article>
          );
        })}
      </section>

      <nav className="tab-list" aria-label="Vistas de identidad">
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

      {!hasSession ? (
        <section className="locked-panel">
          <LockKeyhole aria-hidden="true" size={28} />
          <strong>Sesion requerida</strong>
        </section>
      ) : null}

      {hasSession && activeTab === "users" ? (
        <section className="work-grid work-grid-users">
          <section className="table-panel" aria-label="Usuarios internos">
            <div className="table-header">
              <div>
                <h2>Usuarios internos</h2>
                <span>{users.length} registros</span>
              </div>
              <button
                aria-haspopup="dialog"
                aria-label="Nuevo usuario"
                className="icon-button table-create-action"
                onClick={openNewUser}
                title="Nuevo usuario"
                type="button"
              >
                <Plus aria-hidden="true" size={22} />
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Identidad</th>
                    <th>Roles</th>
                    <th>Estado</th>
                    <th>Ultimo login</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const userActive = user.status === "ACTIVE";
                    const userSessions = sessions.filter((session) => session.userId === user.id);

                    return (
                      <tr key={user.id}>
                        <td>
                          <strong>{user.display_name}</strong>
                          <span>{user.login}</span>
                        </td>
                        <td>{user.identity_type}</td>
                        <td>{assignedRolesForUser(user).join(", ") || "Sin roles"}</td>
                        <td>
                          <span className={userActive ? "pill pill-ok" : "pill pill-wait"}>{user.status}</span>
                        </td>
                        <td>{formatDate(user.last_login_at)}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              onClick={() => void openUserEdit(user)}
                              title={`Editar usuario ${user.login}`}
                              type="button"
                            >
                              <Pencil aria-hidden="true" size={16} />
                            </button>
                            <button
                              onClick={() => void openUserDetail(user)}
                              title={`Ver datos de ${user.login}`}
                              type="button"
                            >
                              <Eye aria-hidden="true" size={16} />
                            </button>
                            <button
                              onClick={() => void setUserStatus(user.id, userActive ? "suspend" : "activate")}
                              title={userActive ? `Suspender usuario ${user.login}` : `Activar usuario ${user.login}`}
                              type="button"
                            >
                              {userActive ? <PowerOff aria-hidden="true" size={16} /> : <Power aria-hidden="true" size={16} />}
                            </button>
                            {canRevokeSessions && userSessions.length > 0 ? (
                              <button
                                className="danger-icon-button"
                                disabled={busy}
                                onClick={() => void logoutUserSessions(user)}
                                title={`Cerrar sesiones de ${user.login}`}
                                type="button"
                              >
                                <LogOut aria-hidden="true" size={16} />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      ) : null}

      {hasSession && activeTab === "menu" ? (
        <section className="work-grid">
          <section className="table-panel" aria-label="Arbol de menu">
            <div className="table-header">
              <div>
                <h2>Arbol de menu</h2>
                <span>{menuItems.length} opciones de nivel 1, arbol recursivo</span>
              </div>
              {canManageMenu ? (
                <div className="table-menu-actions">
                  <button
                    aria-expanded={menuActionsOpen}
                    aria-haspopup="menu"
                    aria-label="Acciones del menu"
                    className="icon-button"
                    onClick={() => setMenuActionsOpen((current) => !current)}
                    title="Acciones del menu"
                    type="button"
                  >
                    <MenuIcon aria-hidden="true" size={20} />
                  </button>
                  {menuActionsOpen ? (
                    <div className="table-action-menu" role="menu">
                      <button onClick={openNewMenu} role="menuitem" type="button">
                        <Plus aria-hidden="true" size={16} />
                        <span>Nueva opcion</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : <MenuIcon aria-hidden="true" size={22} />}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Opcion</th>
                    <th>URL del MFE</th>
                    <th>Roles</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {menuItems.map((item) => (
                    <tr className={selectedMenuPreview?.id === item.id ? "menu-row-selected" : undefined} key={item.id} onClick={() => { setSelectedMenuPreview(item); setSelectedMenuParent(item); }}>
                      <td>
                        <strong style={{ paddingLeft: `${Math.max(item.level - 1, 0) * 18}px` }}>{item.label}</strong>
                        <span>{item.code}</span>
                      </td>
                      <td>{item.manifest_url || item.target_url}</td>
                      <td>{item.roles.join(", ") || "Sin roles"}</td>
                      <td><span className={item.active ? "pill pill-ok" : "pill pill-wait"}>{item.active ? "ACTIVA" : "INACTIVA"}</span></td>
                      <td>
                        <div className="row-actions">
                          <button disabled={!canManageMenu} onClick={(event) => { event.stopPropagation(); selectMenuForEdit(item); }} title={`Editar ${item.label}`} type="button">
                            <Pencil aria-hidden="true" size={16} />
                          </button>
                          <button className="danger-icon-button" disabled={!canManageMenu} onClick={(event) => { event.stopPropagation(); void deleteMenuItem(item); }} title={`Eliminar ${item.label}`} type="button">
                            <Trash2 aria-hidden="true" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <aside className="menu-tree-preview" aria-label="Vista previa del arbol de menu">
            <div className="table-header">
              <div>
                <h2>Vista del arbol</h2>
                <span>{selectedMenuPreview ? `Estructura de ${selectedMenuPreview.label}` : "Selecciona una opcion para visualizarla"}</span>
              </div>
              {canManageMenu && selectedMenuParent ? (
                <button
                  className="secondary-action menu-add-child-button"
                  onClick={() => openNewMenuChild(selectedMenuParent)}
                  title={`Agregar hijo a ${selectedMenuParent.label}`}
                  type="button"
                >
                  <Plus aria-hidden="true" size={16} />
                  <span>Agregar hijo</span>
                </button>
              ) : <MenuIcon aria-hidden="true" size={22} />}
            </div>
            <div className="menu-tree-content" ref={menuTreeContentRef}>
              {selectedMenuPreview ? renderMenuPreview([selectedMenuPreview]) : <div className="empty-state">Selecciona una opcion de la tabla.</div>}
            </div>
          </aside>
        </section>
      ) : null}

      {hasSession && menuDialogOpen ? (
        <dialog aria-labelledby="menu-dialog-title" className="modal-panel user-create-dialog menu-dialog" ref={menuDialogRef}>
          <div className="modal-heading">
            <div className="panel-heading">
              <MenuIcon aria-hidden="true" size={19} />
              <h2 id="menu-dialog-title">
                {editingMenuId ? "Editar opcion" : menuForm.parent_id ? "Nuevo hijo" : "Nueva opcion"}
              </h2>
            </div>
            <button aria-label="Cerrar ventana" className="icon-button modal-close" onClick={closeMenuDialog} type="button"><X aria-hidden="true" size={17} /></button>
          </div>
          <form className="user-create-fields" onSubmit={submitMenuItem}>
            <label>Codigo<input required onChange={(event) => setMenuForm((current) => ({ ...current, code: event.target.value }))} value={menuForm.code} /></label>
            <label>Etiqueta<input required onChange={(event) => setMenuForm((current) => ({ ...current, label: event.target.value }))} value={menuForm.label} /></label>
            <fieldset className="menu-icon-fieldset">
              <legend>Icono</legend>
              <div className="menu-icon-picker">
                <div className="menu-icon-selected" aria-label={`Icono seleccionado: ${selectedMenuIcon.label}`}>
                  <SelectedMenuIcon aria-hidden="true" size={22} />
                  <span>{selectedMenuIcon.label}</span>
                </div>
                <button className="secondary-action menu-icon-change" onClick={openIconCatalog} type="button">
                  <Pencil aria-hidden="true" size={16} />
                  <span>Cambiar</span>
                </button>
              </div>
            </fieldset>
            {menuForm.parent_id ? (
              <label className="checkbox-line menu-informational-toggle">
                <input
                  checked={menuForm.informational_only}
                  onChange={(event) => setMenuForm((current) => ({
                    ...current,
                    informational_only: event.target.checked,
                    manifest_url: event.target.checked ? "" : current.manifest_url,
                    target_url: event.target.checked ? "" : current.target_url
                  }))}
                  type="checkbox"
                />
                <span>Solo informativo (no navega)</span>
              </label>
            ) : null}
            <label>URL de pantalla<input disabled={menuForm.informational_only} required={!menuForm.informational_only && Boolean(menuForm.parent_id)} onChange={(event) => setMenuForm((current) => ({ ...current, target_url: event.target.value }))} value={menuForm.target_url} /></label>
            <label>URL del manifest MFE<input disabled={menuForm.informational_only} required={!menuForm.informational_only && Boolean(menuForm.parent_id)} onChange={(event) => setMenuForm((current) => ({ ...current, manifest_url: event.target.value }))} value={menuForm.manifest_url} /></label>
            {menuForm.parent_id ? (
              <div className="menu-parent-context">
                <span>Padre</span>
                <strong>{flatMenuItems.find((item) => item.id === menuForm.parent_id)?.label ?? "Opcion seleccionada"}</strong>
              </div>
            ) : null}
            <div className="checkbox-stack checkbox-stack-scroll" aria-label="Roles autorizados">
              {roles.filter((role) => isRoleActive(role)).map((role) => <label className="checkbox-line" key={role.id}><input checked={menuForm.role_ids.includes(role.id)} onChange={() => toggleMenuRole(role.id)} type="checkbox" /><span>{role.code}</span></label>)}
            </div>
            <label className="checkbox-line"><input checked={menuForm.active} onChange={(event) => setMenuForm((current) => ({ ...current, active: event.target.checked }))} type="checkbox" /><span>Opcion activa</span></label>
            <div className="user-create-actions">
              <button className="primary-action" disabled={busy} type="submit"><MenuIcon aria-hidden="true" size={17} /><span>{editingMenuId ? "Actualizar opcion" : "Crear opcion"}</span></button>
              <button className="secondary-action" disabled={busy} onClick={closeMenuDialog} type="button"><X aria-hidden="true" size={17} /><span>Cancelar</span></button>
            </div>
          </form>
        </dialog>
      ) : null}

      {hasSession && iconCatalogOpen ? (
        <dialog aria-labelledby="icon-catalog-title" className="modal-panel icon-catalog-dialog" ref={iconCatalogDialogRef}>
          <div className="modal-heading">
            <div className="panel-heading">
              <MenuIcon aria-hidden="true" size={19} />
              <h2 id="icon-catalog-title">Seleccionar icono</h2>
            </div>
            <button aria-label="Cerrar catalogo" className="icon-button modal-close" onClick={closeIconCatalog} type="button"><X aria-hidden="true" size={17} /></button>
          </div>
          <label className="icon-search-field">Buscar icono<input autoFocus onChange={(event) => setIconSearch(event.target.value)} placeholder="Ej. usuario, viaje, reporte..." value={iconSearch} /></label>
          <div className="menu-icon-catalog" aria-label="Catalogo de iconos">
            {filteredMenuIcons.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  aria-pressed={menuForm.icon === option.code}
                  className={menuForm.icon === option.code ? "menu-icon-option menu-icon-option-selected" : "menu-icon-option"}
                  key={option.code}
                  onClick={() => selectMenuIcon(option.code)}
                  type="button"
                >
                  <Icon aria-hidden="true" size={20} />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
          {filteredMenuIcons.length === 0 ? <span className="empty-inline">No se encontraron iconos.</span> : null}
        </dialog>
      ) : null}

      {hasSession && activeTab === "roles" ? (
        <section className="work-grid">
          <section className="table-panel" aria-label="Roles">
            <div className="table-header">
              <div>
                <h2>Roles</h2>
                <span>{roles.length} registros</span>
              </div>
              <ShieldCheck aria-hidden="true" size={22} />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Codigo</th>
                    <th>Nombre</th>
                    <th>Permisos</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.id}>
                      <td>{role.code}</td>
                      <td>{role.name}</td>
                      <td>{role.permissions.join(", ") || "Sin permisos"}</td>
                      <td>
                        <span className={roleStatusClass(role)}>{roleStatus(role)}</span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            disabled={isRoleDeleted(role)}
                            onClick={() => selectRoleForEdit(role)}
                            title={isRoleDeleted(role) ? `Rol ${role.code} eliminado` : `Editar rol ${role.code}`}
                            type="button"
                          >
                            <Pencil aria-hidden="true" size={16} />
                          </button>
                          {isRoleActive(role) ? (
                            <button
                              disabled={role.code === "ADMIN"}
                              onClick={() => void updateRoleStatus(role, false)}
                              title={role.code === "ADMIN" ? "Rol protegido" : `Deshabilitar rol ${role.code}`}
                              type="button"
                            >
                              <PowerOff aria-hidden="true" size={16} />
                            </button>
                          ) : (
                            <button
                              disabled={isRoleDeleted(role)}
                              onClick={() => void updateRoleStatus(role, true)}
                              title={isRoleDeleted(role) ? "Rol eliminado" : `Habilitar rol ${role.code}`}
                              type="button"
                            >
                              <Power aria-hidden="true" size={16} />
                            </button>
                          )}
                          <button
                            className="danger-icon-button"
                            disabled={isRoleDeleted(role) || role.code === "ADMIN"}
                            onClick={() => selectRoleForDelete(role)}
                            title={role.code === "ADMIN" ? "Rol protegido" : `Borrar logicamente rol ${role.code}`}
                            type="button"
                          >
                            <Trash2 aria-hidden="true" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="side-stack">
            <form className="form-panel" onSubmit={submitRole}>
              <div className="panel-heading">
                <ShieldCheck aria-hidden="true" size={19} />
                <h2>{editingRoleId ? "Editar rol" : "Nuevo rol"}</h2>
              </div>
              <label>
                Codigo
                <input
                  disabled={Boolean(editingRoleId)}
                  onChange={(event) => setRoleForm((current) => ({ ...current, code: event.target.value }))}
                  value={roleForm.code}
                />
              </label>
              <label>
                Nombre
                <input onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))} value={roleForm.name} />
              </label>
              <label>
                Descripcion
                <textarea onChange={(event) => setRoleForm((current) => ({ ...current, description: event.target.value }))} rows={3} value={roleForm.description} />
              </label>
              <div className="checkbox-stack checkbox-stack-scroll" aria-label="Permisos del rol">
                {permissions.map((permission) => (
                  <label className="checkbox-line" key={permission.code}>
                    <input
                      checked={roleForm.permission_codes.includes(permission.code)}
                      onChange={() => toggleRolePermission(permission.code)}
                      type="checkbox"
                    />
                    <span>{permission.code}</span>
                  </label>
                ))}
              </div>
              <button className="primary-action" disabled={busy} type="submit">
                <ShieldCheck aria-hidden="true" size={17} />
                <span>{editingRoleId ? "Actualizar rol" : "Crear rol"}</span>
              </button>
              {editingRoleId ? (
                <button className="secondary-action" disabled={busy} onClick={clearRoleForm} type="button">
                  <X aria-hidden="true" size={17} />
                  <span>Cancelar edicion</span>
                </button>
              ) : null}
            </form>
          </div>
        </section>
      ) : null}

      {hasSession && activeTab === "permissions" ? (
        <section className="permission-grid" aria-label="Permisos">
          {permissions.map((permission) => (
            <button
              className="permission-item permission-item-button"
              key={permission.code}
              onClick={() => setSelectedPermission(permission)}
              title={`Ver roles y usuarios con ${permission.code}`}
              type="button"
            >
              <KeyRound aria-hidden="true" size={18} />
              <strong>{permission.code}</strong>
              <span>{permission.description}</span>
            </button>
          ))}
        </section>
      ) : null}

      {hasSession && activeTab === "sessions" ? (
        <section className="table-panel sessions-panel" aria-label="Sesiones activas">
          <div className="table-header">
            <div>
              <h2>Sesiones activas</h2>
              <span>{sessions.length} sesiones vigentes en todos los navegadores y hosts</span>
            </div>
            <div className="table-header-actions">
              <button
                aria-label="Actualizar sesiones"
                className="icon-button"
                disabled={busy}
                onClick={() => void refreshData()}
                title="Actualizar sesiones"
                type="button"
              >
                <RefreshCw aria-hidden="true" size={18} />
              </button>
              <UserCheck aria-hidden="true" size={22} />
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Identidad</th>
                  <th>Inicio</th>
                  <th>Ultima actividad</th>
                  <th>Vence</th>
                  <th>Cliente</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td>
                      <strong>{session.displayName}</strong>
                      <span>{session.email ?? session.login}</span>
                      {session.current ? <small className="session-current-label">Esta sesion</small> : null}
                    </td>
                    <td>{session.identityType}</td>
                    <td>{formatDate(session.createdAt)}</td>
                    <td>{formatDate(session.lastSeenAt)}</td>
                    <td>{formatDate(session.expiresAt)}</td>
                      <td>
                        <strong>{session.deviceName ?? "Dispositivo no identificado"}</strong>
                        <span className="session-client-value">{session.deviceType ?? "Dispositivo"} · {session.operatingSystem ?? "Sistema no identificado"}</span>
                        <span className="session-client-value">{session.browser ?? "Navegador no identificado"}{session.browserVersion ? ` ${session.browserVersion}` : ""}</span>
                        <span className="session-client-value">IP: {session.ipAddress ?? "No identificada"} · {session.location ?? "Ubicacion no disponible"}</span>
                      </td>
                    <td>
                      <button
                        className="danger-icon-button"
                        disabled={busy || !canRevokeSessions}
                        onClick={() => void revokeIdentitySession(session)}
                        title={session.current ? "Cerrar esta sesion" : `Cerrar sesion de ${session.login}`}
                        type="button"
                      >
                        <PowerOff aria-hidden="true" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {hasSession && newUserOpen ? (
        <dialog
          aria-labelledby="new-user-title"
          className="modal-panel user-create-dialog"
          onCancel={(event) => {
            event.preventDefault();
            closeNewUser();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Tab") {
              return;
            }
            const controls = event.currentTarget.querySelectorAll<HTMLElement>("button:enabled, input:enabled");
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (!first) {
              event.preventDefault();
            } else if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }}
          ref={newUserDialogRef}
        >
          <div className="modal-heading">
            <div className="panel-heading">
              <UserPlus aria-hidden="true" size={19} />
              <h2 id="new-user-title">Nuevo usuario</h2>
            </div>
            <button
              aria-label="Cerrar"
              className="icon-button modal-close"
              disabled={actionMutation.isPending}
              onClick={closeNewUser}
              title="Cerrar"
              type="button"
            >
              <X aria-hidden="true" size={17} />
            </button>
          </div>
          {errorMessage ? (
            <div className="alert alert-error" role="alert">
              <CircleAlert aria-hidden="true" size={18} />
              <span>{errorMessage}</span>
            </div>
          ) : null}
          <form aria-busy={actionMutation.isPending} onSubmit={createUser}>
            <fieldset className="user-create-fields" disabled={actionMutation.isPending}>
              <label>
                Usuario
                <input
                  autoComplete="off"
                  onChange={(event) => setNewUser((current) => ({ ...current, login: event.target.value }))}
                  ref={newUserLoginRef}
                  required
                  value={newUser.login}
                />
              </label>
              <label>
                Nombre visible
                <input
                  onChange={(event) => setNewUser((current) => ({ ...current, display_name: event.target.value }))}
                  required
                  value={newUser.display_name}
                />
              </label>
              <label>
                Correo
                <input
                  autoComplete="email"
                  onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))}
                  required
                  type="email"
                  value={newUser.email}
                />
              </label>
              <label>
                Contrasena temporal
                <input
                  autoComplete="new-password"
                  minLength={12}
                  onChange={(event) => setNewUser((current) => ({ ...current, temporary_password: event.target.value }))}
                  required
                  type="password"
                  value={newUser.temporary_password}
                />
                <PasswordStrengthMeter value={newUser.temporary_password} />
              </label>
              <div className="checkbox-stack" aria-label="Roles para nuevo usuario" role="group">
                {activeRoles.map((role) => (
                  <label className="checkbox-line" key={role.id}>
                    <input checked={newUser.role_ids.includes(role.id)} onChange={() => toggleNewUserRole(role.id)} type="checkbox" />
                    <span>{role.code}</span>
                  </label>
                ))}
              </div>
              <div className="user-create-actions">
                <button className="secondary-action" onClick={closeNewUser} type="button">
                  Cancelar
                </button>
                <button className="primary-action" disabled={busy} type="submit">
                  <UserPlus aria-hidden="true" size={17} />
                  <span>{actionMutation.isPending ? "Creando..." : "Crear usuario"}</span>
                </button>
              </div>
            </fieldset>
          </form>
        </dialog>
      ) : null}

      {selectedUserEdit && userEditForm ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeUserEdit();
            }
          }}
          role="presentation"
        >
          <section
            aria-labelledby="user-edit-title"
            aria-modal="true"
            className="modal-panel user-edit-panel"
            role="dialog"
          >
            <div className="modal-heading">
              <div className="panel-heading">
                <Pencil aria-hidden="true" size={19} />
                <h2 id="user-edit-title">Editar usuario</h2>
              </div>
              <button className="icon-button modal-close" disabled={actionMutation.isPending} onClick={() => closeUserEdit()} title="Cerrar" type="button">
                <X aria-hidden="true" size={17} />
              </button>
            </div>
            {userEditLoading ? <p className="delete-summary">Cargando datos del usuario...</p> : null}
            {errorMessage ? (
              <div className="alert alert-error" role="alert">
                <CircleAlert aria-hidden="true" size={18} />
                <span>{errorMessage}</span>
              </div>
            ) : null}
            <form onSubmit={updateUser}>
              <fieldset className="user-edit-fields" disabled={actionMutation.isPending || userEditLoading}>
                <label>
                  Usuario
                  <input required value={userEditForm.login} onChange={(event) => setUserEditForm((current) => current ? { ...current, login: event.target.value } : current)} />
                </label>
                <label>
                  Nombre visible
                  <input required value={userEditForm.display_name} onChange={(event) => setUserEditForm((current) => current ? { ...current, display_name: event.target.value } : current)} />
                </label>
                <label>
                  Correo
                  <input
                    disabled={selectedUserEdit.identity_type === "GOOGLE"}
                    required
                    type="email"
                    value={userEditForm.email}
                    onChange={(event) => setUserEditForm((current) => current ? { ...current, email: event.target.value } : current)}
                  />
                  {selectedUserEdit.identity_type === "GOOGLE" ? <small className="field-hint">El correo de una cuenta GOOGLE no se puede modificar.</small> : null}
                </label>
                <label>
                  Codigo de empleado
                  <input value={userEditForm.employee_code} onChange={(event) => setUserEditForm((current) => current ? { ...current, employee_code: event.target.value } : current)} />
                </label>
                <label>
                  Nombres
                  <input value={userEditForm.first_name} onChange={(event) => setUserEditForm((current) => current ? { ...current, first_name: event.target.value } : current)} />
                </label>
                <label>
                  Apellidos
                  <input value={userEditForm.last_name} onChange={(event) => setUserEditForm((current) => current ? { ...current, last_name: event.target.value } : current)} />
                </label>
                <label>
                  Telefono
                  <input value={userEditForm.phone} onChange={(event) => setUserEditForm((current) => current ? { ...current, phone: event.target.value } : current)} />
                </label>
                <label>
                  Cargo
                  <input value={userEditForm.job_title} onChange={(event) => setUserEditForm((current) => current ? { ...current, job_title: event.target.value } : current)} />
                </label>
                <label className="user-edit-wide">
                  Direccion
                  <textarea value={userEditForm.address} onChange={(event) => setUserEditForm((current) => current ? { ...current, address: event.target.value } : current)} />
                </label>
                <div className="checkbox-stack user-edit-wide" aria-label="Roles del usuario" role="group">
                  <strong>Roles</strong>
                  {activeRoles.map((role) => (
                    <label className="checkbox-line" key={role.id}>
                      <input checked={userEditForm.role_ids.includes(role.id)} onChange={() => toggleEditUserRole(role.id)} type="checkbox" />
                      <span>{role.code}</span>
                    </label>
                  ))}
                </div>
                <div className="user-create-actions user-edit-wide">
                  <button className="secondary-action" onClick={() => closeUserEdit()} type="button">Cancelar</button>
                  <button className="primary-action" disabled={busy} type="submit">
                    <Pencil aria-hidden="true" size={17} />
                    <span>{actionMutation.isPending ? "Guardando..." : "Guardar cambios"}</span>
                  </button>
                </div>
              </fieldset>
            </form>
          </section>
        </div>
      ) : null}

      {selectedUserDetail ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeUserDetail();
            }
          }}
          role="presentation"
        >
          <section
            aria-labelledby="user-detail-title"
            aria-modal="true"
            className="modal-panel user-detail-panel"
            role="dialog"
          >
            <div className="modal-heading">
              <div className="panel-heading">
                <Eye aria-hidden="true" size={19} />
                <h2 id="user-detail-title">Detalle de usuario</h2>
              </div>
              <button className="icon-button modal-close" onClick={closeUserDetail} title="Cerrar" type="button">
                <X aria-hidden="true" size={17} />
              </button>
            </div>
            <div className="user-detail-summary">
              <div>
                <strong>{selectedUserDetail.display_name}</strong>
                <span>{selectedUserDetail.email ?? selectedUserDetail.login}</span>
              </div>
              <span className={selectedUserDetail.status === "ACTIVE" ? "pill pill-ok" : "pill pill-wait"}>
                {selectedUserDetail.status}
              </span>
            </div>
            {userDetailLoading ? (
              <p className="delete-summary">Actualizando datos del usuario...</p>
            ) : null}
            <dl className="user-detail-grid">
              <div>
                <dt>ID</dt>
                <dd>{selectedUserDetail.id}</dd>
              </div>
              <div>
                <dt>Legacy ID</dt>
                <dd>{displayValue(selectedUserDetail.legacy_id)}</dd>
              </div>
              <div>
                <dt>Tipo de identidad</dt>
                <dd>{selectedUserDetail.identity_type}</dd>
              </div>
              <div>
                <dt>Usuario</dt>
                <dd>{selectedUserDetail.login}</dd>
              </div>
              <div>
                <dt>Correo</dt>
                <dd>{displayValue(selectedUserDetail.email)}</dd>
              </div>
              <div>
                <dt>Google subject</dt>
                <dd>{displayValue(selectedUserDetail.google_subject)}</dd>
              </div>
              <div>
                <dt>Nombre visible</dt>
                <dd>{selectedUserDetail.display_name}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{selectedUserDetail.status}</dd>
              </div>
              <div>
                <dt>Codigo empleado</dt>
                <dd>{displayValue(selectedUserDetail.employee_code)}</dd>
              </div>
              <div>
                <dt>Nombres</dt>
                <dd>{displayValue(selectedUserDetail.first_name)}</dd>
              </div>
              <div>
                <dt>Apellidos</dt>
                <dd>{displayValue(selectedUserDetail.last_name)}</dd>
              </div>
              <div>
                <dt>Telefono</dt>
                <dd>{displayValue(selectedUserDetail.phone)}</dd>
              </div>
              <div>
                <dt>Direccion</dt>
                <dd>{displayValue(selectedUserDetail.address)}</dd>
              </div>
              <div>
                <dt>Cargo</dt>
                <dd>{displayValue(selectedUserDetail.job_title)}</dd>
              </div>
              <div>
                <dt>Roles base</dt>
                <dd>{displayList(selectedUserDetail.roles)}</dd>
              </div>
              <div>
                <dt>Roles asignados</dt>
                <dd>{displayList(selectedUserDetail.assigned_roles)}</dd>
              </div>
              <div>
                <dt>Ultimo login</dt>
                <dd>{formatDate(selectedUserDetail.last_login_at)}</dd>
              </div>
              <div>
                <dt>Bloqueado hasta</dt>
                <dd>{formatDate(selectedUserDetail.locked_until)}</dd>
              </div>
              <div>
                <dt>Creado</dt>
                <dd>{formatDate(selectedUserDetail.created_at)}</dd>
              </div>
              <div>
                <dt>Actualizado</dt>
                <dd>{formatDate(selectedUserDetail.updated_at)}</dd>
              </div>
            </dl>
            <button className="secondary-action" onClick={closeUserDetail} type="button">
              <X aria-hidden="true" size={17} />
              <span>Cerrar</span>
            </button>
          </section>
        </div>
      ) : null}

      {roleDeleteCandidate ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              cancelRoleDelete();
            }
          }}
          role="presentation"
        >
          <section
            aria-labelledby="role-delete-title"
            aria-modal="true"
            className="modal-panel danger-panel"
            role="dialog"
          >
            <div className="modal-heading">
              <div className="panel-heading">
                <Trash2 aria-hidden="true" size={19} />
                <h2 id="role-delete-title">Borrado logico</h2>
              </div>
              <button className="icon-button modal-close" disabled={busy} onClick={cancelRoleDelete} title="Cerrar" type="button">
                <X aria-hidden="true" size={17} />
              </button>
            </div>
            <p className="delete-summary">
              El rol <strong>{roleDeleteCandidate.code}</strong> quedara en estado INACTIVE y se retirara de los usuarios asignados.
            </p>
            <div className="affected-users" aria-label="Usuarios afectados">
              <strong>{roleDeleteAssignedUsers.length} usuario(s) con este rol</strong>
              {roleDeleteAssignedUsers.length > 0 ? (
                <ul>
                  {roleDeleteAssignedUsers.map((user) => (
                    <li key={user.id}>
                      <span>{user.display_name}</span>
                      <small>{user.email ?? user.login}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="empty-inline">No hay usuarios asignados.</span>
              )}
            </div>
            <label>
              Escribe delete para confirmar
              <input
                onChange={(event) => setRoleDeleteConfirmation(event.target.value)}
                placeholder="delete"
                value={roleDeleteConfirmation}
              />
            </label>
            <button className="danger-action" disabled={busy || roleDeleteConfirmation !== "delete"} onClick={() => void deleteRole()} type="button">
              <Trash2 aria-hidden="true" size={17} />
              <span>Borrar rol</span>
            </button>
            <button className="secondary-action" disabled={busy} onClick={cancelRoleDelete} type="button">
              <X aria-hidden="true" size={17} />
              <span>Cancelar borrado</span>
            </button>
          </section>
        </div>
      ) : null}

      {selectedPermission ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedPermission(null);
            }
          }}
          role="presentation"
        >
          <section
            aria-labelledby="permission-detail-title"
            aria-modal="true"
            className="modal-panel"
            role="dialog"
          >
            <div className="modal-heading">
              <div className="panel-heading">
                <KeyRound aria-hidden="true" size={19} />
                <h2 id="permission-detail-title">Detalle de permiso</h2>
              </div>
              <button className="icon-button modal-close" onClick={() => setSelectedPermission(null)} title="Cerrar" type="button">
                <X aria-hidden="true" size={17} />
              </button>
            </div>
            <p className="delete-summary">
              <strong>{selectedPermission.code}</strong>: {selectedPermission.description}
            </p>
            <div className="detail-stack">
              <section className="readonly-list" aria-label="Roles con este permiso">
                <strong>{permissionDetailRoles.length} rol(es) con este permiso</strong>
                {permissionDetailRoles.length > 0 ? (
                  <ul>
                    {permissionDetailRoles.map((role) => (
                      <li key={role.id}>
                        <span>{role.code}</span>
                        <small>{role.name}</small>
                        <span className={roleStatusClass(role)}>{roleStatus(role)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="empty-inline">No hay roles asociados.</span>
                )}
              </section>
              <section className="readonly-list" aria-label="Usuarios con este permiso efectivo">
                <strong>{permissionDetailUsers.length} usuario(s) con este permiso efectivo</strong>
                {permissionDetailUsers.length > 0 ? (
                  <ul>
                    {permissionDetailUsers.map((user) => (
                      <li key={user.id}>
                        <span>{user.display_name}</span>
                        <small>{user.email ?? user.login}</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="empty-inline">No hay usuarios con este permiso activo.</span>
                )}
              </section>
            </div>
            <button className="secondary-action" onClick={() => setSelectedPermission(null)} type="button">
              <X aria-hidden="true" size={17} />
              <span>Cerrar</span>
            </button>
          </section>
        </div>
      ) : null}

      {identityHealthDown ? (
        <div className="modal-backdrop service-health-backdrop" role="presentation">
          <section
            aria-labelledby="identity-health-title"
            aria-modal="true"
            className="modal-panel service-health-panel"
            role="dialog"
          >
            <div className="panel-heading">
              <CircleAlert aria-hidden="true" size={20} />
              <h2 id="identity-health-title">Servicio no disponible</h2>
            </div>
            <p className="delete-summary">
              El servicio <strong>{identityReadyUrl}</strong> no responde.
            </p>
            <div className="retry-box" aria-live="polite">
              <strong>{identityHealthRetryIn}</strong>
              <div className="retry-progress" aria-hidden="true">
                <span key={identityHealthRetryCycle} />
              </div>
              <span>Se volvera a intentar automaticamente en segundos.</span>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
