"use client";

import {
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import {
  CircleAlert,
  Eye,
  KeyRound,
  LockKeyhole,
  Pencil,
  Power,
  PowerOff,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X
} from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

type IdentityType = "GOOGLE" | "LOCAL";
type TabKey = "users" | "roles" | "permissions";
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
  session: (token: string) => ["identity", "session", token] as const
};

function emptyRoleForm() {
  return {
    active: true,
    code: "",
    description: "",
    name: "",
    permission_codes: [] as string[]
  };
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
  const [newUser, setNewUser] = useState({
    display_name: "",
    email: "",
    employee_code: "",
    first_name: "",
    job_title: "",
    last_name: "",
    login: "",
    role_ids: [] as string[],
    temporary_password: ""
  });
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [roleDeleteCandidate, setRoleDeleteCandidate] = useState<Role | null>(null);
  const [roleDeleteConfirmation, setRoleDeleteConfirmation] = useState("");
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<User | null>(null);
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
  const busy = sessionQuery.isFetching || actionMutation.isPending;

  const tabs = useMemo(
    () => [
      { key: "users" as const, label: "Usuarios", icon: Users },
      { key: "roles" as const, label: "Roles", icon: ShieldCheck },
      { key: "permissions" as const, label: "Permisos", icon: KeyRound }
    ],
    []
  );

  const stats = useMemo(
    () => [
      { label: "Usuarios", value: users.length.toString(), icon: Users, tone: "green" },
      { label: "Roles", value: roles.length.toString(), icon: ShieldCheck, tone: "blue" },
      { label: "Permisos", value: permissions.length.toString(), icon: KeyRound, tone: "coral" }
    ],
    [permissions.length, roles.length, users.length]
  );

  const hasSession = Boolean(accessToken && currentUser);

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
      await reloadProtectedData(accessToken);
    }, "Datos actualizados");
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      return;
    }

    await runAction(async () => {
      await apiRequest<User>("/users", {
        body: JSON.stringify(newUser),
        method: "POST"
      }, accessToken);
      setNewUser({
        display_name: "",
        email: "",
        employee_code: "",
        first_name: "",
        job_title: "",
        last_name: "",
        login: "",
        role_ids: [],
        temporary_password: ""
      });
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

      {errorMessage ? (
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
        <section className="work-grid">
          <section className="table-panel" aria-label="Usuarios internos">
            <div className="table-header">
              <div>
                <h2>Usuarios internos</h2>
                <span>{users.length} registros</span>
              </div>
              <Users aria-hidden="true" size={22} />
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
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <form className="form-panel" onSubmit={createUser}>
            <div className="panel-heading">
              <UserPlus aria-hidden="true" size={19} />
              <h2>Nuevo usuario</h2>
            </div>
            <label>
              Usuario
              <input onChange={(event) => setNewUser((current) => ({ ...current, login: event.target.value }))} value={newUser.login} />
            </label>
            <label>
              Nombre visible
              <input onChange={(event) => setNewUser((current) => ({ ...current, display_name: event.target.value }))} value={newUser.display_name} />
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
            <div className="checkbox-stack" aria-label="Roles para nuevo usuario">
              {activeRoles.map((role) => (
                <label className="checkbox-line" key={role.id}>
                  <input checked={newUser.role_ids.includes(role.id)} onChange={() => toggleNewUserRole(role.id)} type="checkbox" />
                  <span>{role.code}</span>
                </label>
              ))}
            </div>
            <button className="primary-action" disabled={busy} type="submit">
              <UserPlus aria-hidden="true" size={17} />
              <span>Crear usuario</span>
            </button>
          </form>
        </section>
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
