"use client";

import {
  ArrowLeft,
  BusFront,
  KeyRound,
  Link2,
  LockKeyhole,
  Mail,
  MailCheck,
  ShieldCheck
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useRef, useState } from "react";

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

declare global {
  interface Window {
    google?: GoogleAccounts;
  }
}

const apiBase = "/api/identity";
const storageKey = "venta-pasajes.identity.access-token";
const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

function parseApiError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string") {
      return error.message;
    }
  }
  return fallback;
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
  const payload = responseText ? (JSON.parse(responseText) as unknown) : null;

  if (!response.ok) {
    throw new Error(parseApiError(payload, `HTTP ${response.status}`));
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
  const googleScriptLoading = useRef<Promise<void> | null>(null);
  const [loginForm, setLoginForm] = useState({ login: "admin", password: "" });
  const [googleToken, setGoogleToken] = useState("");
  const [message, setMessage] = useState<{ text: string; tone: "info" | "warn" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);

  async function completeLogin(response: AuthTokenResponse) {
    storeSession(response);
    setMessage({ text: `Sesion iniciada como ${response.user.login}.`, tone: "info" });
    router.push("/app");
  }

  async function loginLocal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runLogin(async () => {
      const response = await apiRequest<AuthTokenResponse>("/auth/local/login", {
        body: JSON.stringify(loginForm),
        method: "POST"
      });
      await completeLogin(response);
    });
  }

  async function exchangeGoogleToken(idToken: string) {
    if (!idToken.trim()) {
      setMessage({ text: "Pega un ID token de Google antes de intercambiarlo.", tone: "warn" });
      return;
    }

    await runLogin(async () => {
      const response = await apiRequest<AuthTokenResponse>("/auth/google/exchange", {
        body: JSON.stringify({ id_token: idToken.trim() }),
        method: "POST"
      });
      await completeLogin(response);
    });
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
    }
  }

  async function startGoogleSignIn() {
    if (!googleClientId) {
      setMessage({ text: "NEXT_PUBLIC_GOOGLE_CLIENT_ID no esta configurado en el shell.", tone: "warn" });
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
            void exchangeGoogleToken(response.credential);
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

          <form className="login-form-stack" onSubmit={loginLocal}>
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

            <label>
              Contrasena
              <span>
                <LockKeyhole aria-hidden="true" size={17} />
                <input
                  autoComplete="current-password"
                  onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="********"
                  type="password"
                  value={loginForm.password}
                />
              </span>
            </label>

            <button className="login-primary" disabled={busy} type="submit">
              <KeyRound aria-hidden="true" size={18} />
              Ingresar con usuario y contrasena
            </button>
          </form>

          <div className="login-divider">
            <span>o</span>
          </div>

          <button className="login-google" disabled={busy || !googleClientId} onClick={startGoogleSignIn} type="button">
            <MailCheck aria-hidden="true" size={18} />
            Acceder con Google
          </button>

          <details className="login-token-details">
            <summary>ID token manual</summary>
            <form
              className="login-form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                void exchangeGoogleToken(googleToken);
              }}
            >
              <label>
                ID token de Google
                <textarea
                  onChange={(event) => setGoogleToken(event.target.value)}
                  rows={3}
                  value={googleToken}
                />
              </label>
              <button className="login-secondary" disabled={busy} type="submit">
                <Link2 aria-hidden="true" size={17} />
                Intercambiar token
              </button>
            </form>
          </details>
        </section>
      </section>
    </main>
  );
}
