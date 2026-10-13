import { randomUUID } from "node:crypto";

import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import { CappedMap, create, deriveHmacKeySecret, randomInt } from "altcha-lib/frameworks/nextjs";

const localDevelopmentSecret = "local-dev-altcha-hmac-secret-change-me-32-bytes";
const altchaSecret =
  process.env.ALTCHA_HMAC_SECRET ||
  localDevelopmentSecret;
const isUsingProductionFallback = !process.env.ALTCHA_HMAC_SECRET && process.env.NODE_ENV === "production";

const hmacKeySignatureSecret = await deriveHmacKeySecret(altchaSecret);
const challengeStore = new CappedMap<string, boolean>({ maxSize: 5000 });

export const altcha = create({
  createChallengeParameters: () => ({
    algorithm: "PBKDF2/SHA-256",
    cost: 5000,
    counter: randomInt(5000, 10000),
    data: {
      challengeId: randomUUID()
    },
    expiresAt: new Date(Date.now() + 10 * 60 * 1000)
  }),
  deriveKey,
  hmacKeySignatureSecret,
  hmacSignatureSecret: altchaSecret,
  store: challengeStore
});

export function isAltchaConfigured() {
  return !isUsingProductionFallback;
}

export function altchaNotConfiguredResponse() {
  return Response.json(
    {
      error: {
        code: "ALTCHA_NOT_CONFIGURED",
        message: "ALTCHA_HMAC_SECRET no esta configurado en frontend-shell."
      }
    },
    { status: 500 }
  );
}

export async function verifyAltchaPayload(payload: unknown) {
  if (!isAltchaConfigured()) {
    return {
      code: "ALTCHA_NOT_CONFIGURED",
      message: "ALTCHA_HMAC_SECRET no esta configurado en frontend-shell.",
      ok: false as const,
      status: 500
    };
  }

  if (typeof payload !== "string" || !payload.trim()) {
    return {
      code: "ALTCHA_VERIFICATION_FAILED",
      message: "Completa la verificacion anti-robots antes de ingresar.",
      ok: false as const,
      status: 403
    };
  }

  const result = await altcha.verify(
    payload,
    deriveKey,
    altchaSecret,
    hmacKeySignatureSecret,
    challengeStore
  );

  if (result.error) {
    return {
      code: "ALTCHA_VERIFICATION_FAILED",
      message: "La verificacion anti-robots no es valida o ya expiro.",
      ok: false as const,
      status: 403
    };
  }

  return { ok: true as const };
}
