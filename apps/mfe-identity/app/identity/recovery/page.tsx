"use client";

import {
  ArrowLeft,
  BusFront,
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck
} from "lucide-react";
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

type PasswordStrength = {
  color: "danger" | "warn" | "ok" | "strong";
  label: string;
  percent: number;
  score: number;
};

const apiBase = "/api/identity";
const shellLoginUrl = process.env.NEXT_PUBLIC_SHELL_LOGIN_URL ?? "http://localhost:3000/login";
const shellAppUrl = process.env.NEXT_PUBLIC_SHELL_APP_URL ?? "http://localhost:3000/app";

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
    throw new Error(parseApiError(payload, `HTTP ${response.status}`));
  }

  return payload as T;
}

function redirectAuthenticated(response: AuthTokenResponse) {
  const target = new URL(shellAppUrl, window.location.origin);
  const fragment = new URLSearchParams();
  fragment.set("access_token", response.access_token);
  fragment.set("token_type", response.token_type);
  fragment.set("expires_in", String(response.expires_in));
  fragment.set("user", JSON.stringify(response.user));
  target.hash = fragment.toString();
  window.location.assign(target.toString());
}

export default function IdentityRecoveryPage() {
  const autoLoginStarted = useRef(false);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [mode, setMode] = useState<"login" | "reset">("reset");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoveryLinkSent, setRecoveryLinkSent] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") ?? "");
    setMode(params.get("mode") === "login" ? "login" : "reset");
  }, []);

  useEffect(() => {
    if (!token || mode !== "login" || autoLoginStarted.current) {
      return;
    }

    autoLoginStarted.current = true;
    setBusy(true);
    setMessage({ tone: "info", text: "Validando enlace de acceso. Redirigiendo a la aplicacion..." });

    apiRequest<AuthTokenResponse>("/password/login", {
      body: JSON.stringify({ token }),
      method: "POST"
    })
      .then((response) => {
        redirectAuthenticated(response);
      })
      .catch((error) => {
        setMessage({
          tone: "error",
          text: error instanceof Error ? error.message : "No se pudo iniciar sesion con este enlace."
        });
      })
      .finally(() => setBusy(false));
  }, [mode, token]);

  async function requestRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || recoveryLinkSent) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await apiRequest<{ accepted: boolean }>("/password/forgot", {
        body: JSON.stringify({ login_or_email: email.trim() }),
        method: "POST"
      });
      setMessage({
        tone: "info",
        text: "La cuenta existe. Revisa tu correo para continuar."
      });
      setRecoveryLinkSent(true);
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "No se pudo solicitar la recuperacion."
      });
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ tone: "error", text: "Las contrasenas no coinciden." });
      return;
    }
    if (newPassword.length < 12) {
      setMessage({ tone: "error", text: "La contrasena debe tener al menos 12 caracteres." });
      return;
    }

    setBusy(true);
    try {
      const response = await apiRequest<AuthTokenResponse>("/password/reset", {
        body: JSON.stringify({ new_password: newPassword, token }),
        method: "POST"
      });
      setMessage({ tone: "info", text: "Contrasena actualizada. Redirigiendo a la aplicacion..." });
      redirectAuthenticated(response);
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "No se pudo actualizar la contrasena."
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="identity-recovery-page">
      <section className="identity-recovery-shell">
        <a className="identity-recovery-back" href={shellLoginUrl}>
          <ArrowLeft aria-hidden="true" size={17} />
          Volver al login
        </a>

        <div className="identity-recovery-brand">
          <span>
            <BusFront aria-hidden="true" size={28} />
          </span>
          <p>Panamericana Internacional</p>
          <h1>Recupera tu acceso</h1>
          <strong>Restablece tu acceso de forma segura</strong>
          <p>
            Ingresa tu correo y, si existe una cuenta asociada, recibiras un enlace temporal para recuperar tu acceso.
          </p>
        </div>

        <section className="identity-recovery-panel" aria-label="Recuperacion de contrasena">
          <div className="identity-recovery-heading">
            <ShieldCheck aria-hidden="true" size={24} />
            <div>
              <h2>{token && mode === "login" ? "Acceso seguro" : token ? "Nueva contrasena" : "Has olvidado tu contrasena?"}</h2>
              <span>
                {token && mode === "login"
                  ? "Estamos validando el enlace para ingresar automaticamente."
                  : token
                  ? "Define tu nueva clave y entraremos a la aplicacion automaticamente."
                  : "Te enviaremos un enlace de recuperacion si el correo esta registrado."}
              </span>
            </div>
          </div>

          {message ? (
            <div className={`identity-recovery-message identity-recovery-message-${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>
              {message.tone === "info" ? <CheckCircle2 aria-hidden="true" size={18} /> : <LockKeyhole aria-hidden="true" size={18} />}
              <span>{message.text}</span>
            </div>
          ) : null}

          {token && mode === "login" ? (
            <div className="identity-recovery-form" role="status">
              <button className="identity-recovery-primary" disabled type="button">
                <ShieldCheck aria-hidden="true" size={18} />
                Ingresando...
              </button>
            </div>
          ) : token ? (
            <form className="identity-recovery-form" onSubmit={resetPassword}>
              <label>
                Nueva contrasena
                <span>
                  <KeyRound aria-hidden="true" size={17} />
                  <input
                    autoComplete="new-password"
                    minLength={12}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                    type="password"
                    value={newPassword}
                  />
                </span>
                <PasswordStrengthMeter value={newPassword} />
              </label>
              <label>
                Confirmar nueva contrasena
                <span>
                  <LockKeyhole aria-hidden="true" size={17} />
                  <input
                    autoComplete="new-password"
                    minLength={12}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    type="password"
                    value={confirmPassword}
                  />
                </span>
              </label>
              <button className="identity-recovery-primary" disabled={busy} type="submit">
                <ShieldCheck aria-hidden="true" size={18} />
                Actualizar y entrar
              </button>
            </form>
          ) : (
            <form className="identity-recovery-form" onSubmit={requestRecovery}>
              <label>
                Correo electronico
                <span>
                  <Mail aria-hidden="true" size={17} />
                  <input
                    autoComplete="email"
                    disabled={busy || recoveryLinkSent}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="usuario@correo.com"
                    required
                    type="email"
                    value={email}
                  />
                </span>
              </label>
              <button className="identity-recovery-primary" disabled={busy || recoveryLinkSent} type="submit">
                <Mail aria-hidden="true" size={18} />
                {recoveryLinkSent ? "Enlace enviado" : "Enviar enlace de recuperacion"}
              </button>
            </form>
          )}
        </section>
      </section>
    </main>
  );
}
