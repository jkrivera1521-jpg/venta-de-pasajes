"use client";

import { CheckCircle2, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";

type CookiePreferences = {
  analytics: boolean;
  marketing: boolean;
  necessary: true;
};

const consentStorageKey = "venta-pasajes.cookie-consent.v1";

const defaultPreferences: CookiePreferences = {
  analytics: false,
  marketing: false,
  necessary: true
};

function publishConsent(preferences: CookiePreferences) {
  window.localStorage.setItem(consentStorageKey, JSON.stringify({
    accepted_at: new Date().toISOString(),
    preferences,
    version: 1
  }));

  window.dispatchEvent(new CustomEvent("venta-pasajes:cookie-consent-updated", {
    detail: preferences
  }));
}

export function CookieConsentBanner() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>(defaultPreferences);

  useEffect(() => {
    setMounted(true);
    setVisible(!window.localStorage.getItem(consentStorageKey));
  }, []);

  function saveConsent(nextPreferences: CookiePreferences) {
    publishConsent(nextPreferences);
    setPreferences(nextPreferences);
    setVisible(false);
    setCustomizing(false);
  }

  if (!mounted || !visible) {
    return null;
  }

  return (
    <section className="cookie-consent" aria-label="Preferencias de privacidad">
      <div className="cookie-consent-card">
        <div className="cookie-consent-heading">
          <span>
            <ShieldCheck aria-hidden="true" size={21} />
          </span>
          <div>
            <h2>Valoramos tu privacidad</h2>
            <p>
              Usamos almacenamiento necesario para operar el sitio. Tambien puedes permitir analitica y marketing cuando estas integraciones se habiliten.
            </p>
          </div>
        </div>

        {customizing ? (
          <div className="cookie-options" aria-label="Personalizar cookies">
            <label>
              <input checked disabled type="checkbox" />
              <span>
                <strong>Necesarias</strong>
                <small>Siempre activas. Permiten recordar tu decision y mantener funciones basicas.</small>
              </span>
            </label>
            <label>
              <input
                checked={preferences.analytics}
                onChange={(event) => setPreferences((current) => ({ ...current, analytics: event.target.checked }))}
                type="checkbox"
              />
              <span>
                <strong>Analitica</strong>
                <small>Preparado para medir uso general de la landing cuando se conecte una herramienta real.</small>
              </span>
            </label>
            <label>
              <input
                checked={preferences.marketing}
                onChange={(event) => setPreferences((current) => ({ ...current, marketing: event.target.checked }))}
                type="checkbox"
              />
              <span>
                <strong>Marketing</strong>
                <small>Preparado para campanas o publicidad futura. No se activa si no lo autorizas.</small>
              </span>
            </label>
          </div>
        ) : null}

        <div className="cookie-actions">
          <button className="cookie-button cookie-button-light" onClick={() => setCustomizing((current) => !current)} type="button">
            <SlidersHorizontal aria-hidden="true" size={17} />
            Personalizar
          </button>
          <button className="cookie-button cookie-button-light" onClick={() => saveConsent(defaultPreferences)} type="button">
            <X aria-hidden="true" size={17} />
            Rechazar todo
          </button>
          <button
            className="cookie-button cookie-button-dark"
            onClick={() => saveConsent({ analytics: true, marketing: true, necessary: true })}
            type="button"
          >
            <CheckCircle2 aria-hidden="true" size={17} />
            Aceptar todo
          </button>
          {customizing ? (
            <button className="cookie-button cookie-button-dark" onClick={() => saveConsent(preferences)} type="button">
              <CheckCircle2 aria-hidden="true" size={17} />
              Guardar preferencias
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
