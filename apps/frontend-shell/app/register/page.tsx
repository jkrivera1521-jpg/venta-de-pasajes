"use client";

import {
  ArrowLeft,
  BusFront,
  CheckCircle2,
  Eye,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserPlus
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

type AltchaWidgetElement = HTMLElement & {
  reset?: () => void;
};

type AltchaStateChangeEvent = CustomEvent<{
  state?: string;
}>;

type PasswordStrength = {
  color: "danger" | "warn" | "ok" | "strong";
  label: string;
  percent: number;
  score: number;
};

const apiBase = "/api/identity";
const storageKey = "venta-pasajes.identity.access-token";

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

function storeSession(response: AuthTokenResponse) {
  window.sessionStorage.setItem(storageKey, response.access_token);
  window.sessionStorage.setItem("venta-pasajes.identity.current-user", JSON.stringify(response.user));
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

export default function RegisterPage() {
  const router = useRouter();
  const registerFormRef = useRef<HTMLFormElement | null>(null);
  const altchaWidgetRef = useRef<AltchaWidgetElement | null>(null);
  const [form, setForm] = useState({
    confirmPassword: "",
    displayName: "",
    email: "",
    login: "",
    password: ""
  });
  const [message, setMessage] = useState<{ text: string; tone: "info" | "warn" | "error" } | null>(null);
  const [altchaState, setAltchaState] = useState("unverified");
  const [altchaKey, setAltchaKey] = useState(0);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
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

  function currentAltchaPayload() {
    const value = registerFormRef.current ? new FormData(registerFormRef.current).get("altcha") : null;
    return typeof value === "string" ? value : "";
  }

  function resetAltcha() {
    setAltchaState("unverified");
    setAltchaKey((current) => current + 1);
  }

  async function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (form.password !== form.confirmPassword) {
      setMessage({ text: "Las contrasenas no coinciden.", tone: "warn" });
      return;
    }
    if (form.password.length < 12) {
      setMessage({ text: "La contrasena debe tener al menos 12 caracteres.", tone: "warn" });
      return;
    }

    const altcha = currentAltchaPayload();
    if (!altcha) {
      setMessage({ text: "Confirma que no eres un robot antes de crear la cuenta.", tone: "warn" });
      return;
    }

    setBusy(true);
    try {
      const response = await apiRequest<AuthTokenResponse>("/auth/local/register", {
        body: JSON.stringify({
          altcha,
          display_name: form.displayName.trim(),
          email: form.email.trim(),
          login: form.login.trim(),
          password: form.password
        }),
        method: "POST"
      });
      storeSession(response);
      setMessage({ text: "Cuenta creada. Ingresando a la plataforma...", tone: "info" });
      router.push("/app");
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "No se pudo crear la cuenta.",
        tone: "error"
      });
      resetAltcha();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-shell">
        <Link className="login-back" href="/login">
          <ArrowLeft aria-hidden="true" size={17} />
          Volver al login
        </Link>

        <div className="login-brand-block">
          <span>
            <BusFront aria-hidden="true" size={28} />
          </span>
          <p>Panamericana Internacional</p>
          <h1>Crear cuenta</h1>
          <strong>Acceso local para venta en linea</strong>
          <p>
            Registra tus credenciales locales para ingresar como pasajero y continuar con los servicios publicos de la plataforma.
          </p>
        </div>

        <section className="login-panel" aria-label="Crear cuenta local">
          <div className="login-panel-heading">
            <ShieldCheck aria-hidden="true" size={24} />
            <div>
              <h2>Cuenta nueva</h2>
              <span>Usa un correo valido, usuario unico y una contrasena segura.</span>
            </div>
          </div>

          {message ? (
            <div className={`login-message login-message-${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>
              {message.text}
            </div>
          ) : null}

          <form className="login-form-stack" onSubmit={submitRegister} ref={registerFormRef}>
            <label>
              Usuario
              <span>
                <UserPlus aria-hidden="true" size={17} />
                <input
                  autoComplete="username"
                  onChange={(event) => setForm((current) => ({ ...current, login: event.target.value }))}
                  required
                  value={form.login}
                />
              </span>
            </label>

            <label>
              Nombre visible
              <span>
                <CheckCircle2 aria-hidden="true" size={17} />
                <input
                  autoComplete="name"
                  onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                  required
                  value={form.displayName}
                />
              </span>
            </label>

            <label>
              Correo electronico
              <span>
                <Mail aria-hidden="true" size={17} />
                <input
                  autoComplete="email"
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  required
                  type="email"
                  value={form.email}
                />
              </span>
            </label>

            <label>
              Contrasena
              <span>
                <LockKeyhole aria-hidden="true" size={17} />
                <input
                  autoComplete="new-password"
                  minLength={12}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  required
                  type={passwordVisible ? "text" : "password"}
                  value={form.password}
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
              <PasswordStrengthMeter value={form.password} />
            </label>

            <label>
              Confirmar contrasena
              <span>
                <KeyRound aria-hidden="true" size={17} />
                <input
                  autoComplete="new-password"
                  minLength={12}
                  onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                  required
                  type={confirmPasswordVisible ? "text" : "password"}
                  value={form.confirmPassword}
                />
                <button
                  aria-label="Mantener presionado para ver la confirmacion de contrasena"
                  className="password-peek-button"
                  onBlur={() => setConfirmPasswordVisible(false)}
                  onKeyDown={(event) => {
                    if (event.key === " " || event.key === "Enter") {
                      setConfirmPasswordVisible(true);
                    }
                  }}
                  onKeyUp={() => setConfirmPasswordVisible(false)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setConfirmPasswordVisible(true);
                  }}
                  onMouseLeave={() => setConfirmPasswordVisible(false)}
                  onMouseUp={() => setConfirmPasswordVisible(false)}
                  onTouchCancel={() => setConfirmPasswordVisible(false)}
                  onTouchEnd={() => setConfirmPasswordVisible(false)}
                  onTouchStart={() => setConfirmPasswordVisible(true)}
                  title="Mantener presionado para ver la confirmacion de contrasena"
                  type="button"
                >
                  <Eye aria-hidden="true" size={17} />
                </button>
              </span>
            </label>

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
                  : "Marca la verificacion anti-robots para crear la cuenta."}
              </span>
            </div>

            <button className="login-primary" disabled={busy} type="submit">
              <UserPlus aria-hidden="true" size={18} />
              Crear una cuenta nueva
            </button>
          </form>

          <p className="login-register-prompt">
            Ya tienes cuenta? <Link href="/login">Ingresar al sistema</Link>.
          </p>
        </section>
      </section>
    </main>
  );
}
