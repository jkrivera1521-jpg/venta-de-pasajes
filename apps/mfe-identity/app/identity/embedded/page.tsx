"use client";

import {
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import {
  BadgeCheck,
  CircleAlert,
  CircleCheck,
  KeyRound,
  Link2,
  LockKeyhole,
  LogIn,
  LogOut,
  MailCheck,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type IdentityType = "GOOGLE" | "LOCAL" | "HYBRID";
type AuthorizedIdentityType = "EMAIL" | "DOMAIN" | "GOOGLE_SUBJECT";
type TabKey = "users" | "authorized" | "roles" | "permissions" | "recovery";
type RoleStatus = "ACTIVE" | "DISABLED" | "DELETED";

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
  identity_type: IdentityType;
  login: string;
  email?: string | null;
  google_subject?: string | null;
  display_name: string;
  status: string;
  employee_code?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  job_title?: string | null;
  roles: string[];
  assigned_roles?: string[];
  last_login_at?: string | null;
  locked_until?: string | null;
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

type AuthorizedIdentity = {
  id: string;
  type: AuthorizedIdentityType;
  value: string;
  active: boolean;
  created_by_user_id?: string | null;
  created_at?: string | null;
};

type AuthTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: CurrentUser;
};

type IdentitySessionData = {
  authorizedIdentities: AuthorizedIdentity[];
  currentUser: CurrentUser;
  permissions: Permission[];
  roles: Role[];
  users: User[];
};

type GoogleCredentialResponse = {
  credential?: string;
};

type IdentityReadyResponse = {
  ready?: boolean;
  target?: string;
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

type GoogleAccounts = {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        auto_select?: boolean;
        ux_mode?: "popup" | "redirect";
      }) => void;
      prompt: () => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleAccounts;
  }
}

const apiBase = "/api/identity";
const identityReadyCheckPath = "/api/identity-health/ready";
const defaultIdentityReadyUrl = "http://localhost:8081/q/health/ready";
const storageKey = "venta-pasajes.identity.access-token";
const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const identityTypes: IdentityType[] = ["LOCAL", "GOOGLE", "HYBRID"];
const authorizedIdentityTypes: AuthorizedIdentityType[] = ["EMAIL", "DOMAIN", "GOOGLE_SUBJECT"];
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

function parseApiError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string") {
      return error.message;
    }
  }
  return fallback;
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
  const payload = responseText ? (JSON.parse(responseText) as unknown) : null;

  if (!response.ok) {
    throw new Error(parseApiError(payload, `HTTP ${response.status}`));
  }

  return payload as T;
}

async function fetchIdentitySession(token: string): Promise<IdentitySessionData> {
  const [currentUser, users, roles, permissions, authorizedIdentities] = await Promise.all([
    apiRequest<CurrentUser>("/me", {}, token),
    apiRequest<User[]>("/users", {}, token),
    apiRequest<Role[]>("/roles", {}, token),
    apiRequest<Permission[]>("/permissions", {}, token),
    apiRequest<AuthorizedIdentity[]>("/authorized-identities", {}, token)
  ]);

  return {
    authorizedIdentities,
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
  const [googleBusy, setGoogleBusy] = useState(false);
  const [loginForm, setLoginForm] = useState({ login: "admin", password: "" });
  const [googleToken, setGoogleToken] = useState("");
  const [newUser, setNewUser] = useState({
    display_name: "",
    email: "",
    employee_code: "",
    first_name: "",
    identity_type: "LOCAL" as IdentityType,
    job_title: "",
    last_name: "",
    login: "",
    role_ids: [] as string[],
    temporary_password: ""
  });
  const [authorizedIdentityForm, setAuthorizedIdentityForm] = useState({
    type: "EMAIL" as AuthorizedIdentityType,
    value: ""
  });
  const [googleLinkForm, setGoogleLinkForm] = useState({
    email: "",
    role_code: "TICKET_SELLER"
  });
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [roleDeleteCandidate, setRoleDeleteCandidate] = useState<Role | null>(null);
  const [roleDeleteConfirmation, setRoleDeleteConfirmation] = useState("");
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null);
  const [identityHealthDown, setIdentityHealthDown] = useState(false);
  const [identityHealthRetryIn, setIdentityHealthRetryIn] = useState(5);
  const [identityHealthRetryCycle, setIdentityHealthRetryCycle] = useState(0);
  const [identityReadyUrl, setIdentityReadyUrl] = useState(defaultIdentityReadyUrl);
  const [forgotForm, setForgotForm] = useState({ login_or_email: "" });
  const [resetForm, setResetForm] = useState({ token: "", new_password: "" });
  const googleScriptLoading = useRef<Promise<void> | null>(null);
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
  const authorizedIdentities = sessionData?.authorizedIdentities ?? [];
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
  const actionMutation = useMutation({
    mutationFn: async ({ action }: { action: () => Promise<void>; successMessage: string }) => {
      await action();
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "Operacion no completada");
    },
    onSuccess: (_data, variables) => {
      setErrorMessage(null);
      setStatusMessage(variables.successMessage);
    }
  });
  const busy = sessionQuery.isFetching || actionMutation.isPending || googleBusy;

  const tabs = useMemo(
    () => [
      { key: "users" as const, label: "Usuarios", icon: Users },
      { key: "authorized" as const, label: "Autorizados", icon: MailCheck },
      { key: "roles" as const, label: "Roles", icon: ShieldCheck },
      { key: "permissions" as const, label: "Permisos", icon: KeyRound },
      { key: "recovery" as const, label: "Recuperacion", icon: LockKeyhole }
    ],
    []
  );

  const stats = useMemo(
    () => [
      { label: "Usuarios", value: users.length.toString(), icon: Users, tone: "green" },
      { label: "Roles", value: roles.length.toString(), icon: ShieldCheck, tone: "blue" },
      { label: "Autorizados", value: authorizedIdentities.length.toString(), icon: BadgeCheck, tone: "coral" }
    ],
    [authorizedIdentities.length, roles.length, users.length]
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
    if (sessionQuery.isError) {
      setErrorMessage(sessionQuery.error instanceof Error ? sessionQuery.error.message : "No se pudo cargar la sesion");
      setStatusMessage("Token requerido");
    }
  }, [sessionQuery.error, sessionQuery.isError]);

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

  async function loginLocal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(async () => {
      const response = await apiRequest<AuthTokenResponse>("/auth/local/login", {
        body: JSON.stringify(loginForm),
        method: "POST"
      });
      window.sessionStorage.setItem(storageKey, response.access_token);
      setAccessToken(response.access_token);
      await reloadProtectedData(response.access_token);
    }, "Login local correcto");
  }

  async function exchangeGoogleToken(idToken: string) {
    await runAction(async () => {
      const response = await apiRequest<AuthTokenResponse>("/auth/google/exchange", {
        body: JSON.stringify({ id_token: idToken }),
        method: "POST"
      });
      window.sessionStorage.setItem(storageKey, response.access_token);
      setAccessToken(response.access_token);
      await reloadProtectedData(response.access_token);
    }, "Login Google correcto");
  }

  async function startGoogleSignIn() {
    if (!googleClientId) {
      setErrorMessage("NEXT_PUBLIC_GOOGLE_CLIENT_ID no configurado.");
      return;
    }

    try {
      setGoogleBusy(true);
      setErrorMessage(null);
      await loadGoogleScript();
      window.google?.accounts.id.initialize({
        auto_select: false,
        callback: (response) => {
          if (response.credential) {
            void exchangeGoogleToken(response.credential);
          }
        },
        client_id: googleClientId,
        ux_mode: "popup"
      });
      window.google?.accounts.id.prompt();
      setStatusMessage("Google solicitado");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Google no disponible");
    } finally {
      setGoogleBusy(false);
    }
  }

  function loadGoogleScript() {
    if (window.google?.accounts.id) {
      return Promise.resolve();
    }

    if (!googleScriptLoading.current) {
      googleScriptLoading.current = new Promise((resolve, reject) => {
        const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
        if (existingScript) {
          existingScript.addEventListener("load", () => resolve());
          existingScript.addEventListener("error", () => reject(new Error("Google Identity Services no cargo.")));
          return;
        }

        const script = document.createElement("script");
        script.async = true;
        script.defer = true;
        script.src = "https://accounts.google.com/gsi/client";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Google Identity Services no cargo."));
        document.head.appendChild(script);
      });
    }

    return googleScriptLoading.current;
  }

  function logout() {
    window.sessionStorage.removeItem(storageKey);
    setAccessToken(null);
    queryClient.removeQueries({ queryKey: identityQueryKeys.all });
    setStatusMessage("Sesion cerrada");
  }

  async function refreshData() {
    if (!accessToken) {
      setErrorMessage("Token requerido.");
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
        identity_type: "LOCAL",
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
      await apiRequest<User>(`/users/${userId}/${action}`, { method: "POST" }, accessToken);
      await queryClient.invalidateQueries({ queryKey: identityQueryKeys.sessionRoot });
    }, action === "activate" ? "Usuario activado" : "Usuario suspendido");
  }

  async function createAuthorizedIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      return;
    }

    await runAction(async () => {
      await apiRequest<AuthorizedIdentity>("/authorized-identities", {
        body: JSON.stringify(authorizedIdentityForm),
        method: "POST"
      }, accessToken);
      setAuthorizedIdentityForm({ type: "EMAIL", value: "" });
      await queryClient.invalidateQueries({ queryKey: identityQueryKeys.sessionRoot });
    }, "Identidad autorizada");
  }

  async function linkGoogleOperationalEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      return;
    }

    await runAction(async () => {
      await apiRequest<AuthorizedIdentity>("/authorized-identities", {
        body: JSON.stringify({ type: "EMAIL", value: googleLinkForm.email }),
        method: "POST"
      }, accessToken);
      setGoogleLinkForm({ email: "", role_code: "TICKET_SELLER" });
      await queryClient.invalidateQueries({ queryKey: identityQueryKeys.sessionRoot });
    }, "Correo Google vinculado");
  }

  function selectRoleForEdit(role: Role) {
    if (isRoleDeleted(role)) {
      setErrorMessage("No se puede editar un rol eliminado.");
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
  }

  function clearRoleForm() {
    setEditingRoleId(null);
    setRoleForm(emptyRoleForm());
  }

  function selectRoleForDelete(role: Role) {
    if (isRoleDeleted(role)) {
      setErrorMessage("El rol ya esta eliminado.");
      return;
    }

    if (role.code === "ADMIN") {
      setErrorMessage("El rol ADMIN esta protegido y no se puede borrar.");
      return;
    }

    clearRoleForm();
    setErrorMessage(null);
    setRoleDeleteCandidate(role);
    setRoleDeleteConfirmation("");
    setStatusMessage(`Preparando borrado logico: ${role.code}`);
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

  async function requestPasswordRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(async () => {
      const response = await apiRequest<{ accepted: boolean; recovery_token?: string | null }>("/password/forgot", {
        body: JSON.stringify(forgotForm),
        method: "POST"
      });
      if (response.recovery_token) {
        setResetForm((current) => ({ ...current, token: response.recovery_token ?? "" }));
      }
    }, "Recuperacion solicitada");
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(async () => {
      await apiRequest<void>("/password/reset", {
        body: JSON.stringify(resetForm),
        method: "POST"
      });
      setResetForm({ token: "", new_password: "" });
    }, "Contrasena actualizada");
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
          <button className="icon-button" disabled={!hasSession} onClick={logout} title="Cerrar sesion" type="button">
            <LogOut aria-hidden="true" size={18} />
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

      <section className="auth-grid" aria-label="Autenticacion">
        <form className="auth-panel" onSubmit={loginLocal}>
          <div className="panel-heading">
            <LogIn aria-hidden="true" size={19} />
            <h2>Login local</h2>
          </div>
          <label>
            Usuario
            <input
              autoComplete="username"
              onChange={(event) => setLoginForm((current) => ({ ...current, login: event.target.value }))}
              value={loginForm.login}
            />
          </label>
          <label>
            Contrasena
            <input
              autoComplete="current-password"
              onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
              type="password"
              value={loginForm.password}
            />
          </label>
          <button className="primary-action" disabled={busy} type="submit">
            <LogIn aria-hidden="true" size={17} />
            <span>Ingresar</span>
          </button>
        </form>

        <form
          className="auth-panel"
          onSubmit={(event) => {
            event.preventDefault();
            void exchangeGoogleToken(googleToken);
          }}
        >
          <div className="panel-heading">
            <MailCheck aria-hidden="true" size={19} />
            <h2>Google</h2>
          </div>
          <button className="secondary-action" disabled={busy || !googleClientId} onClick={startGoogleSignIn} type="button">
            <MailCheck aria-hidden="true" size={17} />
            <span>Sign in with Google</span>
          </button>
          <label>
            ID token
            <textarea
              onChange={(event) => setGoogleToken(event.target.value)}
              rows={3}
              value={googleToken}
            />
          </label>
          <button className="secondary-action" disabled={busy} type="submit">
            <Link2 aria-hidden="true" size={17} />
            <span>Intercambiar token</span>
          </button>
        </form>

        <section className="session-panel" aria-label="Sesion actual">
          <div className="panel-heading">
            <UserCheck aria-hidden="true" size={19} />
            <h2>Sesion</h2>
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
            <div className="empty-state">Token requerido</div>
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

      {!hasSession && activeTab !== "recovery" ? (
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
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.display_name}</strong>
                        <span>{user.login}</span>
                      </td>
                      <td>{user.identity_type}</td>
                      <td>{assignedRolesForUser(user).join(", ") || "Sin roles"}</td>
                      <td>
                        <span className={user.status === "ACTIVE" ? "pill pill-ok" : "pill pill-wait"}>{user.status}</span>
                      </td>
                      <td>{formatDate(user.last_login_at)}</td>
                      <td>
                        <div className="row-actions">
                          <button onClick={() => void setUserStatus(user.id, "activate")} title="Activar" type="button">
                            <CircleCheck aria-hidden="true" size={16} />
                          </button>
                          <button onClick={() => void setUserStatus(user.id, "suspend")} title="Suspender" type="button">
                            <CircleAlert aria-hidden="true" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
              Tipo
              <select
                onChange={(event) => setNewUser((current) => ({ ...current, identity_type: event.target.value as IdentityType }))}
                value={newUser.identity_type}
              >
                {identityTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
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
              <input onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))} value={newUser.email} />
            </label>
            <label>
              Contrasena temporal
              <input
                onChange={(event) => setNewUser((current) => ({ ...current, temporary_password: event.target.value }))}
                type="password"
                value={newUser.temporary_password}
              />
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

      {hasSession && activeTab === "authorized" ? (
        <section className="work-grid">
          <section className="table-panel" aria-label="Identidades autorizadas">
            <div className="table-header">
              <div>
                <h2>Identidades autorizadas</h2>
                <span>{authorizedIdentities.length} registros</span>
              </div>
              <MailCheck aria-hidden="true" size={22} />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Valor</th>
                    <th>Estado</th>
                    <th>Creacion</th>
                  </tr>
                </thead>
                <tbody>
                  {authorizedIdentities.map((identity) => (
                    <tr key={identity.id}>
                      <td>{identity.type}</td>
                      <td>{identity.value}</td>
                      <td>
                        <span className={identity.active ? "pill pill-ok" : "pill pill-wait"}>{identity.active ? "ACTIVE" : "INACTIVE"}</span>
                      </td>
                      <td>{formatDate(identity.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="side-stack">
            <form className="form-panel" onSubmit={createAuthorizedIdentity}>
              <div className="panel-heading">
                <BadgeCheck aria-hidden="true" size={19} />
                <h2>Autorizar identidad</h2>
              </div>
              <label>
                Tipo
                <select
                  onChange={(event) =>
                    setAuthorizedIdentityForm((current) => ({ ...current, type: event.target.value as AuthorizedIdentityType }))
                  }
                  value={authorizedIdentityForm.type}
                >
                  {authorizedIdentityTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Valor
                <input
                  onChange={(event) => setAuthorizedIdentityForm((current) => ({ ...current, value: event.target.value }))}
                  value={authorizedIdentityForm.value}
                />
              </label>
              <button className="primary-action" disabled={busy} type="submit">
                <BadgeCheck aria-hidden="true" size={17} />
                <span>Guardar</span>
              </button>
            </form>

            <form className="form-panel" onSubmit={linkGoogleOperationalEmail}>
              <div className="panel-heading">
                <Link2 aria-hidden="true" size={19} />
                <h2>Correo Google operativo</h2>
              </div>
              <label>
                Correo
                <input
                  onChange={(event) => setGoogleLinkForm((current) => ({ ...current, email: event.target.value }))}
                  value={googleLinkForm.email}
                />
              </label>
              <label>
                Rol inicial
                <select disabled value={googleLinkForm.role_code}>
                  <option>TICKET_SELLER</option>
                </select>
              </label>
              <button className="secondary-action" disabled={busy} type="submit">
                <Link2 aria-hidden="true" size={17} />
                <span>Vincular</span>
              </button>
            </form>
          </div>
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

      {activeTab === "recovery" ? (
        <section className="work-grid work-grid-even">
          <form className="form-panel" onSubmit={requestPasswordRecovery}>
            <div className="panel-heading">
              <LockKeyhole aria-hidden="true" size={19} />
              <h2>Solicitar recuperacion</h2>
            </div>
            <label>
              Usuario o correo
              <input
                onChange={(event) => setForgotForm({ login_or_email: event.target.value })}
                value={forgotForm.login_or_email}
              />
            </label>
            <button className="primary-action" disabled={busy} type="submit">
              <LockKeyhole aria-hidden="true" size={17} />
              <span>Solicitar</span>
            </button>
          </form>

          <form className="form-panel" onSubmit={resetPassword}>
            <div className="panel-heading">
              <KeyRound aria-hidden="true" size={19} />
              <h2>Cambiar contrasena</h2>
            </div>
            <label>
              Token
              <textarea onChange={(event) => setResetForm((current) => ({ ...current, token: event.target.value }))} rows={3} value={resetForm.token} />
            </label>
            <label>
              Nueva contrasena
              <input
                onChange={(event) => setResetForm((current) => ({ ...current, new_password: event.target.value }))}
                type="password"
                value={resetForm.new_password}
              />
            </label>
            <button className="primary-action" disabled={busy} type="submit">
              <KeyRound aria-hidden="true" size={17} />
              <span>Cambiar</span>
            </button>
          </form>
        </section>
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
