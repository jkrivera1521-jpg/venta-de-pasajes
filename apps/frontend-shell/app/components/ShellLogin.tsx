"use client";

import {
  ArrowLeft,
  BusFront,
  Eye,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

type CurrentUser = {
  display_name: string;
  login: string;
  permissions: string[];
  roles: string[];
};

type AuthTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
  user: CurrentUser;
};

type ActiveSession = {
  browser?: string | null;
  browser_version?: string | null;
  device_type?: string | null;
  device_name?: string | null;
  ip_address?: string | null;
  location?: string | null;
  created_at?: string | null;
  last_seen_at?: string | null;
  operating_system?: string | null;
  user_agent?: string | null;
};

class IdentityApiError extends Error {
  code: string;
  details: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleAccounts = {
  accounts: {
    id: {
      initialize: (options: {
        auto_select?: boolean;
        callback: (response: GoogleCredentialResponse) => void;
        client_id: string;
        ux_mode?: "popup" | "redirect";
      }) => void;
      prompt: (callback?: (notification: GooglePromptNotification) => void) => void;
    };
  };
};

type GooglePromptNotification = {
  getDismissedReason?: () => string;
  getNotDisplayedReason?: () => string;
  getSkippedReason?: () => string;
  isDismissedMoment: () => boolean;
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
};

type AltchaWidgetElement = HTMLElement & {
  reset?: () => void;
};

type AltchaStateChangeEvent = CustomEvent<{
  state?: string;
}>;

declare global {
  interface Window {
    google?: GoogleAccounts;
  }
}

const apiBase = "/api/identity";
const storageKey = "venta-pasajes.identity.access-token";
const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const identityPublicUrl = (
  process.env.NEXT_PUBLIC_MFE_IDENTITY_PUBLIC_URL ??
  process.env.NEXT_PUBLIC_MFE_PUBLIC_URL ??
  "http://localhost:3001"
).replace(/\/+$/, "");
const identityRecoveryUrl =
  process.env.NEXT_PUBLIC_MFE_IDENTITY_RECOVERY_URL ?? `${identityPublicUrl}/identity/recovery`;

function GoogleLogo() {
  return (
    <svg aria-hidden="true" className="google-logo" focusable="false" viewBox="0 0 18 18">
      <path
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.84.86-3.05.86-2.35 0-4.34-1.58-5.05-3.71H.94v2.33A9 9 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.95 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.94a9 9 0 0 0 0 8.08l3.01-2.33z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.65 8.65 0 0 0 9 0 9 9 0 0 0 .94 4.96l3.01 2.33C4.66 5.16 6.65 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleLogo() {
  return (
    <svg aria-hidden="true" className="apple-logo" focusable="false" viewBox="0 0 24 24">
      <path
        d="M17.05 12.6c-.02-2.38 1.95-3.52 2.04-3.58-1.11-1.62-2.83-1.84-3.44-1.86-1.47-.15-2.86.86-3.6.86-.75 0-1.91-.84-3.14-.82-1.62.02-3.11.94-3.94 2.39-1.68 2.91-.43 7.22 1.21 9.58.8 1.16 1.75 2.46 3 2.41 1.2-.05 1.65-.78 3.1-.78 1.44 0 1.85.78 3.12.75 1.29-.02 2.11-1.18 2.9-2.34.92-1.34 1.3-2.64 1.32-2.71-.03-.01-2.54-.97-2.57-3.9zM14.69 5.61c.66-.8 1.1-1.91.98-3.02-.95.04-2.1.63-2.78 1.43-.61.71-1.14 1.85-1 2.94 1.06.08 2.14-.54 2.8-1.35z"
        fill="currentColor"
      />
    </svg>
  );
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

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const hasBody = options.body !== undefined && options.body !== null;

  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    cache: "no-store",
    headers
  });
  const responseText = await response.text();
  const payload = parseResponsePayload(responseText, response.headers.get("content-type") ?? "");

  if (!response.ok) {
    const error = payload && typeof payload === "object" && "error" in payload
      ? (payload as { error?: { code?: unknown; message?: unknown; details?: unknown } }).error
      : undefined;
    throw new IdentityApiError(
      typeof error?.code === "string" ? error.code : `HTTP_${response.status}`,
      typeof error?.message === "string" ? error.message : `HTTP ${response.status}`,
      error?.details
    );
  }

  return payload as T;
}

function storeSession(response: AuthTokenResponse) {
  window.sessionStorage.setItem(storageKey, response.access_token);
  window.sessionStorage.setItem("venta-pasajes.identity.current-user", JSON.stringify(response.user));
}

function googlePromptMessage(reason: string, action: string) {
  if (reason === "unregistered_origin") {
    return `Google ${action}: origen no registrado. Agrega exactamente ${window.location.origin} en Origenes autorizados de JavaScript del cliente OAuth usado por NEXT_PUBLIC_GOOGLE_CLIENT_ID.`;
  }

  return `Google ${action}: ${reason}.`;
}

export function ShellLogin() {
  const router = useRouter();
  const loginFormRef = useRef<HTMLFormElement | null>(null);
  const googleScriptLoading = useRef<Promise<void> | null>(null);
  const altchaWidgetRef = useRef<AltchaWidgetElement | null>(null);
  const [loginForm, setLoginForm] = useState({ login: "admin", password: "" });
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "info" | "warn" | "error" } | null>(null);
  const [activeSessionPrompt, setActiveSessionPrompt] = useState<ActiveSession[] | null>(null);
  const activeSessionResolverRef = useRef<((accepted: boolean) => void) | null>(null);
  const [altchaState, setAltchaState] = useState("unverified");
  const [altchaKey, setAltchaKey] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([import("altcha"), import("altcha/i18n/all")]);
  }, []);

  useEffect(() => {
    const widget = altchaWidgetRef.current;

    if (!widget) {
      return;
    }

    const handleStateChange = (event: Event) => {
      const state = (event as AltchaStateChangeEvent).detail?.state ?? "unverified";
      setAltchaState(state);
    };

    widget.addEventListener("statechange", handleStateChange);

    return () => {
      widget.removeEventListener("statechange", handleStateChange);
    };
  }, [altchaKey]);

  async function completeLogin(response: AuthTokenResponse) {
    storeSession(response);
    setMessage({ text: `Sesion iniciada como ${response.user.login}.`, tone: "info" });
    router.push("/app");
  }

  async function loginLocal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const altcha = requireAltchaPayload();

    if (!altcha) {
      return;
    }

    await runLogin(async () => {
      const response = await loginLocalWithForce(altcha);
      await completeLogin(response);
    });
  }

  async function loginLocalWithForce(altcha: string, force = false): Promise<AuthTokenResponse> {
    try {
      return await apiRequest<AuthTokenResponse>("/auth/local/login", {
        body: JSON.stringify({ ...loginForm, altcha, force }),
        method: "POST"
      });
    } catch (error) {
      if (!(error instanceof IdentityApiError) || error.code !== "ACTIVE_SESSION" || force) {
        throw error;
      }
      if (!(await confirmActiveSession(error.details))) {
        throw new Error("Inicio de sesion cancelado.");
      }
      return loginLocalWithForce(altcha, true);
    }
  }

  async function exchangeGoogleCredential(idToken: string, altcha: string) {
    if (!idToken.trim()) {
      setMessage({ text: "Google no entrego un ID token.", tone: "warn" });
      return;
    }

    await runLogin(async () => {
      const response = await exchangeGoogleWithForce(idToken, altcha);
      await completeLogin(response);
    });
  }

  async function exchangeGoogleWithForce(idToken: string, altcha: string, force = false): Promise<AuthTokenResponse> {
    try {
      return await apiRequest<AuthTokenResponse>("/auth/google/exchange", {
        body: JSON.stringify({ altcha, force, id_token: idToken.trim() }),
        method: "POST"
      });
    } catch (error) {
      if (!(error instanceof IdentityApiError) || error.code !== "ACTIVE_SESSION" || force) {
        throw error;
      }
      if (!(await confirmActiveSession(error.details))) {
        throw new Error("Inicio de sesion cancelado.");
      }
      return exchangeGoogleWithForce(idToken, altcha, true);
    }
  }

  function confirmActiveSession(details: unknown) {
    const sessions = details && typeof details === "object" && "sessions" in details
      ? (details as { sessions?: ActiveSession[] }).sessions ?? []
      : [];
    return new Promise<boolean>((resolve) => {
      activeSessionResolverRef.current = resolve;
      setActiveSessionPrompt(sessions);
    });
  }

  function resolveActiveSessionPrompt(accepted: boolean) {
    const resolve = activeSessionResolverRef.current;
    activeSessionResolverRef.current = null;
    setActiveSessionPrompt(null);
    resolve?.(accepted);
  }

  function formatSessionDate(value?: string | null) {
    if (!value) {
      return "No disponible";
    }
    return new Intl.DateTimeFormat("es-EC", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(value));
  }

  async function runLogin(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "No se pudo iniciar sesion.",
        tone: "error"
      });
    } finally {
      setBusy(false);
      resetAltcha();
    }
  }

  function currentAltchaPayload() {
    const value = loginFormRef.current ? new FormData(loginFormRef.current).get("altcha") : null;
    return typeof value === "string" ? value : "";
  }

  function requireAltchaPayload() {
    const altcha = currentAltchaPayload();

    if (!altcha) {
      setMessage({ text: "Confirma que no eres un robot antes de ingresar.", tone: "warn" });
      return null;
    }

    return altcha;
  }

  function resetAltcha() {
    setAltchaState("unverified");
    setAltchaKey((current) => current + 1);
  }

  async function startGoogleSignIn() {
    if (!googleClientId) {
      setMessage({ text: "NEXT_PUBLIC_GOOGLE_CLIENT_ID no esta configurado en el shell.", tone: "warn" });
      return;
    }

    const altcha = requireAltchaPayload();

    if (!altcha) {
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      await loadGoogleScript();
      window.google?.accounts.id.initialize({
        auto_select: false,
        callback: (response) => {
          if (response.credential) {
            void exchangeGoogleCredential(response.credential, altcha);
          } else {
            setMessage({ text: "Google no entrego un ID token.", tone: "warn" });
          }
        },
        client_id: googleClientId,
        ux_mode: "popup"
      });
      window.google?.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed()) {
          setMessage({ text: googlePromptMessage(notification.getNotDisplayedReason?.() ?? "sin detalle", "no mostro el prompt"), tone: "warn" });
        }
        if (notification.isSkippedMoment()) {
          setMessage({ text: googlePromptMessage(notification.getSkippedReason?.() ?? "sin detalle", "omitio el prompt"), tone: "warn" });
        }
        if (notification.isDismissedMoment()) {
          const reason = notification.getDismissedReason?.();
          if (reason && reason !== "credential_returned") {
            setMessage({ text: `Google cerro el prompt: ${reason}.`, tone: "warn" });
          }
        }
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Google Identity Services no esta disponible.",
        tone: "error"
      });
    } finally {
      setBusy(false);
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

  return (
    <main className="login-page">
      <section className="login-shell">
        <Link className="login-back" href="/">
          <ArrowLeft aria-hidden="true" size={17} />
          Volver a la landing
        </Link>

        <div className="login-brand-block">
          <span>
            <BusFront aria-hidden="true" size={28} />
          </span>
          <p>Panamericana Internacional</p>
          <h1>Login global</h1>
          <strong>Acceso unificado para pasajeros y operadores</strong>
          <p>
            Inicia sesion desde el shell y la consola compartira el token con los microfrontends cargados.
          </p>
        </div>

        <section className="login-panel" aria-label="Login global">
          <div className="login-panel-heading">
            <ShieldCheck aria-hidden="true" size={24} />
            <div>
              <h2>Ingreso al sistema</h2>
              <span>Usa credenciales locales de operador o tu cuenta Google como pasajero.</span>
            </div>
          </div>

          {message ? (
            <div className={`login-message login-message-${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>
              {message.text}
            </div>
          ) : null}

          {activeSessionPrompt ? (
            <div className="session-conflict-backdrop" role="presentation">
              <section aria-labelledby="session-conflict-title" aria-modal="true" className="session-conflict-dialog" role="dialog">
                <div className="session-conflict-icon" aria-hidden="true">
                  <ShieldCheck size={22} />
                </div>
                <div className="session-conflict-heading">
                  <span className="session-conflict-eyebrow">Sesion activa detectada</span>
                  <h3 id="session-conflict-title">Este usuario ya esta conectado</h3>
                  <p>Existe una sesion abierta en otro dispositivo. ¿Deseas continuar aqui?</p>
                </div>
                <div className="session-conflict-list">
                  {activeSessionPrompt.map((session, index) => (
                    <div className="session-conflict-item" key={`${session.device_name ?? "device"}-${session.ip_address ?? "ip"}-${index}`}>
                      <strong>{session.device_name ?? "Dispositivo no identificado"}</strong>
                      <span>{session.device_type ?? "Dispositivo"} · {session.operating_system ?? "Sistema no identificado"}</span>
                      <span>{session.browser ?? "Navegador no identificado"}{session.browser_version ? ` ${session.browser_version}` : ""}</span>
                      <span>IP: {session.ip_address ?? "No identificada"}</span>
                      <span>Ubicacion: {session.location ?? "No disponible"}</span>
                      <span>Inicio: {formatSessionDate(session.created_at)} · Ultima actividad: {formatSessionDate(session.last_seen_at)}</span>
                    </div>
                  ))}
                </div>
                <p className="session-conflict-warning">Al continuar, cerraremos las sesiones anteriores de este usuario.</p>
                <div className="session-conflict-actions">
                  <button className="session-conflict-cancel" onClick={() => resolveActiveSessionPrompt(false)} type="button">
                    Cancelar
                  </button>
                  <button className="session-conflict-continue" onClick={() => resolveActiveSessionPrompt(true)} type="button">
                    Continuar aqui
                  </button>
                </div>
              </section>
            </div>
          ) : null}

          <form className="login-form-stack" onSubmit={loginLocal} ref={loginFormRef}>
            <label>
              Usuario o correo
              <span>
                <Mail aria-hidden="true" size={17} />
                <input
                  autoComplete="username"
                  onChange={(event) => setLoginForm((current) => ({ ...current, login: event.target.value }))}
                  placeholder="admin"
                  value={loginForm.login}
                />
              </span>
            </label>

            <div className="login-field">
              <div className="login-label-row">
                <label htmlFor="shell-password">Contrasena</label>
                <a href={identityRecoveryUrl}>Has olvidado tu contrasena?</a>
              </div>
              <span>
                <LockKeyhole aria-hidden="true" size={17} />
                <input
                  autoComplete="current-password"
                  id="shell-password"
                  onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="********"
                  type={passwordVisible ? "text" : "password"}
                  value={loginForm.password}
                />
                <button
                  aria-label="Mantener presionado para ver la contrasena"
                  className="password-peek-button"
                  onBlur={() => setPasswordVisible(false)}
                  onKeyDown={(event) => {
                    if (event.key === " " || event.key === "Enter") {
                      setPasswordVisible(true);
                    }
                  }}
                  onKeyUp={() => setPasswordVisible(false)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setPasswordVisible(true);
                  }}
                  onMouseLeave={() => setPasswordVisible(false)}
                  onMouseUp={() => setPasswordVisible(false)}
                  onTouchCancel={() => setPasswordVisible(false)}
                  onTouchEnd={() => setPasswordVisible(false)}
                  onTouchStart={() => setPasswordVisible(true)}
                  title="Mantener presionado para ver la contrasena"
                  type="button"
                >
                  <Eye aria-hidden="true" size={17} />
                </button>
              </span>
            </div>

            <div className="altcha-login-check">
              <altcha-widget
                key={altchaKey}
                auto="off"
                challenge="/api/security/altcha/challenge"
                language="es-419"
                name="altcha"
                ref={altchaWidgetRef}
                type="checkbox"
                workers="2"
              />
              <span className={`altcha-login-status altcha-login-status-${altchaState}`}>
                {altchaState === "verified"
                  ? "Verificacion completada."
                  : "Marca la verificacion anti-robots para continuar."}
              </span>
            </div>

            <button className="login-primary" disabled={busy} type="submit">
              <KeyRound aria-hidden="true" size={18} />
              Ingresar con usuario y contrasena
            </button>
          </form>

          <div className="login-divider">
            <span>o</span>
          </div>

          <button className="login-google" disabled={busy || !googleClientId} onClick={startGoogleSignIn} type="button">
            <GoogleLogo />
            Continuar con Google
          </button>

          <button className="login-apple" disabled type="button">
            <AppleLogo />
            Continuar con Apple
          </button>

          <p className="login-register-prompt">
            Eres nuevo? <Link href="/register">Crear una cuenta nueva</Link>.
          </p>
        </section>
      </section>
    </main>
  );
}
