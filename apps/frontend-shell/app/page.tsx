"use client";

import {
  BarChart3,
  BusFront,
  CalendarClock,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Ticket
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RemoteMfeFrame } from "./components/RemoteMfeFrame";

type ModuleKey = "panel" | "identity" | "dispatch" | "ticketing" | "reporting" | "admin";

const counters = [
  { label: "MFEs", value: "5/6", tone: "green" },
  { label: "Sesion", value: "Demo", tone: "amber" },
  { label: "Contrato", value: "v0.1", tone: "blue" }
];

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

export default function Home() {
  const modules = useMemo(
    () => [
      { key: "panel" as const, label: "Panel", icon: LayoutDashboard, enabled: false },
      {
        key: "identity" as const,
        label: "Identidad",
        icon: ShieldCheck,
        enabled: true,
        fallbackName: "mfe-identity",
        fallbackTitle: "Identidad y accesos",
        manifestUrl: process.env.NEXT_PUBLIC_MFE_IDENTITY_MANIFEST_URL || "http://localhost:3001/mfe/manifest"
      },
      {
        key: "dispatch" as const,
        label: "Despachos",
        icon: CalendarClock,
        enabled: true,
        fallbackName: "mfe-dispatch",
        fallbackTitle: "Despacho operativo",
        manifestUrl: process.env.NEXT_PUBLIC_MFE_DISPATCH_MANIFEST_URL || "http://localhost:3002/mfe/manifest"
      },
      {
        key: "ticketing" as const,
        label: "Boleteria",
        icon: Ticket,
        enabled: true,
        fallbackName: "mfe-ticketing",
        fallbackTitle: "Boleteria",
        manifestUrl: process.env.NEXT_PUBLIC_MFE_TICKETING_MANIFEST_URL || "http://localhost:3003/mfe/manifest"
      },
      {
        key: "reporting" as const,
        label: "Reportes",
        icon: BarChart3,
        enabled: true,
        fallbackName: "mfe-reporting",
        fallbackTitle: "Reportes",
        manifestUrl: process.env.NEXT_PUBLIC_MFE_REPORTING_MANIFEST_URL || "http://localhost:3004/mfe/manifest"
      },
      {
        key: "admin" as const,
        label: "Admin",
        icon: Settings,
        enabled: true,
        fallbackName: "mfe-admin",
        fallbackTitle: "Administracion",
        manifestUrl: process.env.NEXT_PUBLIC_MFE_ADMIN_MANIFEST_URL || "http://localhost:3005/mfe/manifest"
      }
    ],
    []
  );
  const [activeModuleKey, setActiveModuleKey] = useState<ModuleKey>("ticketing");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const activeModule = modules.find((module) => module.key === activeModuleKey && module.enabled) ?? modules[1];
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
              <h1>Consola operativa</h1>
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
            {counters.map((counter) => (
              <div className={`counter counter-${counter.tone}`} key={counter.label}>
                <span>{counter.label}</span>
                <strong>{counter.value}</strong>
              </div>
            ))}
          </div>
        </header>

        <section className="module-surface" aria-label="Modulo remoto">
          <RemoteMfeFrame
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
