"use client";

import {
  BarChart3,
  BusFront,
  CalendarClock,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShoppingCart,
  ShieldCheck,
  Ticket
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RemoteMfeFrame } from "./RemoteMfeFrame";

type ModuleKey = "online-sales" | "panel" | "identity" | "dispatch" | "ticketing" | "reporting" | "admin";

const counters = [
  { label: "MFEs", value: "5/6", tone: "green" },
  { label: "Contrato", value: "v0.1", tone: "blue" }
];

const identityStorageKey = "venta-pasajes.identity.access-token";

const shellTimeFormatter = new Intl.DateTimeFormat("es-EC", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});

const shellDateFormatter = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "long",
  weekday: "long",
  year: "numeric"
});

type ShellRuntimeConfig = {
  manifests: {
    admin: string;
    dispatch: string;
    identity: string;
    onlineSales: string;
    reporting: string;
    ticketing: string;
  };
};

type CurrentUser = {
  display_name: string;
  login: string;
  permissions: string[];
  roles: string[];
};

async function fetchShellRuntimeConfig() {
  const response = await fetch("/api/shell/runtime-config", { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<ShellRuntimeConfig>;
}

async function fetchCurrentUser(token: string) {
  const response = await fetch("/api/identity/me", {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  const responseText = await response.text();
  const payload = responseText ? (JSON.parse(responseText) as unknown) : null;

  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload
      ? (payload as { error?: { message?: string } }).error?.message
      : undefined;
    throw new Error(message ?? `HTTP ${response.status}`);
  }

  return payload as CurrentUser;
}

export function ShellConsole() {
  const router = useRouter();
  const runtimeConfigQuery = useQuery({
    queryFn: fetchShellRuntimeConfig,
    queryKey: ["frontend-shell", "runtime-config"],
    retry: 2,
    staleTime: 30 * 1000
  });
  const manifestUrls = runtimeConfigQuery.data?.manifests;
  const [activeModuleKey, setActiveModuleKey] = useState<ModuleKey>("online-sales");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const currentUserQuery = useQuery({
    enabled: authChecked && Boolean(accessToken),
    queryFn: () => fetchCurrentUser(accessToken as string),
    queryKey: ["frontend-shell", "identity-session", accessToken],
    retry: false,
    staleTime: 30 * 1000
  });
  const sessionLabel = !accessToken
    ? "Sin sesion"
    : currentUserQuery.isPending
      ? "Validando"
      : currentUserQuery.isError
        ? "Expirada"
        : currentUserQuery.data.login;
  const visibleCounters = useMemo(
    () => [
      ...counters,
      { label: "Sesion", value: sessionLabel, tone: accessToken && !currentUserQuery.isError ? "green" : "amber" }
    ],
    [accessToken, currentUserQuery.isError, sessionLabel]
  );
  const userRoles = currentUserQuery.data?.roles ?? [];
  const isCustomerOnly = userRoles.length === 0 || userRoles.every((role) => role === "CUSTOMER");
  const modules = useMemo(
    () => {
      const publicModules = [
        {
          key: "online-sales" as const,
          label: "Venta en linea",
          icon: ShoppingCart,
          enabled: true,
          fallbackName: "mfe-online-sales",
          fallbackTitle: "Venta en linea",
          manifestUrl: manifestUrls?.onlineSales ?? ""
        }
      ];

      if (isCustomerOnly) {
        return publicModules;
      }

      return [
        ...publicModules,
        { key: "panel" as const, label: "Panel", icon: LayoutDashboard, enabled: false },
        {
          key: "identity" as const,
          label: "Identidad",
          icon: ShieldCheck,
          enabled: true,
          fallbackName: "mfe-identity",
          fallbackTitle: "Identidad y accesos",
          manifestUrl: manifestUrls?.identity ?? ""
        },
        {
          key: "dispatch" as const,
          label: "Despachos",
          icon: CalendarClock,
          enabled: true,
          fallbackName: "mfe-dispatch",
          fallbackTitle: "Despacho operativo",
          manifestUrl: manifestUrls?.dispatch ?? ""
        },
        {
          key: "ticketing" as const,
          label: "Boleteria",
          icon: Ticket,
          enabled: true,
          fallbackName: "mfe-ticketing",
          fallbackTitle: "Boleteria",
          manifestUrl: manifestUrls?.ticketing ?? ""
        },
        {
          key: "reporting" as const,
          label: "Reportes",
          icon: BarChart3,
          enabled: true,
          fallbackName: "mfe-reporting",
          fallbackTitle: "Reportes",
          manifestUrl: manifestUrls?.reporting ?? ""
        },
        {
          key: "admin" as const,
          label: "Admin",
          icon: Settings,
          enabled: true,
          fallbackName: "mfe-admin",
          fallbackTitle: "Administracion",
          manifestUrl: manifestUrls?.admin ?? ""
        }
      ];
    },
    [isCustomerOnly, manifestUrls]
  );
  const activeModule = modules.find((module) => module.key === activeModuleKey && module.enabled) ?? modules[0];
  const SidebarToggleIcon = sidebarCollapsed ? PanelLeftOpen : PanelLeftClose;
  const currentTime = now ? shellTimeFormatter.format(now) : "--:--:--";
  const currentDate = now ? shellDateFormatter.format(now) : "Fecha local";

  useEffect(() => {
    const savedValue = window.localStorage.getItem("venta-pasajes:sidebar-collapsed");
    if (savedValue) {
      setSidebarCollapsed(savedValue === "true");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("venta-pasajes:sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    setNow(new Date());
    const intervalId = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const storedToken = window.sessionStorage.getItem(identityStorageKey);
    setAccessToken(storedToken);
    setAuthChecked(true);

    if (!storedToken) {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    if (!authChecked || !accessToken || !currentUserQuery.isError) {
      return;
    }

    window.sessionStorage.removeItem(identityStorageKey);
    window.sessionStorage.removeItem("venta-pasajes.identity.current-user");
    setAccessToken(null);
    router.replace("/login");
  }, [accessToken, authChecked, currentUserQuery.isError, router]);

  useEffect(() => {
    if (!modules.some((module) => module.key === activeModuleKey && module.enabled)) {
      setActiveModuleKey(modules[0]?.key ?? "online-sales");
    }
  }, [activeModuleKey, modules]);

  function logout() {
    window.sessionStorage.removeItem(identityStorageKey);
    window.sessionStorage.removeItem("venta-pasajes.identity.current-user");
    setAccessToken(null);
    router.replace("/login");
  }

  if (!authChecked || !accessToken || currentUserQuery.isPending || currentUserQuery.isError) {
    return (
      <main className="shell-auth-guard" role="status">
        <ShieldCheck aria-hidden="true" size={34} />
        <strong>Validando sesion</strong>
        <span>La consola operativa requiere un usuario autenticado desde el login global.</span>
      </main>
    );
  }

  return (
    <main className={sidebarCollapsed ? "shell-layout shell-layout-sidebar-hidden" : "shell-layout"}>
      {!sidebarCollapsed ? (
        <aside className="sidebar" aria-label="Navegacion principal">
          <div className="brand">
            <span className="brand-mark">
              <BusFront aria-hidden="true" size={22} />
            </span>
            <div>
              <strong>Venta Pasajes</strong>
              <span>Cloud MVP</span>
            </div>
          </div>

          <nav className="nav-list">
            {modules.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  className={activeModuleKey === item.key ? "nav-item nav-item-active" : "nav-item"}
                  disabled={!item.enabled}
                  key={item.label}
                  onClick={() => {
                    if (item.enabled) {
                      setActiveModuleKey(item.key);
                    }
                  }}
                  type="button"
                >
                  <Icon aria-hidden="true" size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>
      ) : null}

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <button
              aria-label={sidebarCollapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
              className="icon-button sidebar-toggle"
              onClick={() => setSidebarCollapsed((value) => !value)}
              title={sidebarCollapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
              type="button"
            >
              <SidebarToggleIcon aria-hidden="true" size={18} />
            </button>
            <div>
              <p className="eyebrow">Frontend shell</p>
              <h1>{isCustomerOnly ? "Portal de pasajeros" : "Consola operativa"}</h1>
            </div>
          </div>
          <div className="clock-card" aria-label="Fecha y hora actual">
            <CalendarClock aria-hidden="true" size={20} />
            <div>
              <strong>{currentTime}</strong>
              <span>{currentDate}</span>
            </div>
          </div>
          <div className="status-strip" aria-label="Estado de frontend">
            {visibleCounters.map((counter) => (
              <div className={`counter counter-${counter.tone}`} key={counter.label}>
                <span>{counter.label}</span>
                <strong>{counter.value}</strong>
              </div>
            ))}
          </div>
          <div className="shell-session-actions">
            <button className="icon-button" onClick={logout} title="Cerrar sesion global" type="button">
              <LogOut aria-hidden="true" size={18} />
            </button>
          </div>
        </header>

        <section className="module-surface" aria-label="Modulo remoto">
          <RemoteMfeFrame
            accessToken={accessToken}
            fallbackName={activeModule.fallbackName ?? "mfe-pending"}
            fallbackTitle={activeModule.fallbackTitle ?? activeModule.label}
            key={activeModule.key}
            manifestUrl={activeModule.manifestUrl ?? ""}
          />
        </section>
      </section>
    </main>
  );
}
