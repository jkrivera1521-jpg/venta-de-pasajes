"use client";

import { VisualFormulaBuilder } from "../../../components/VisualFormulaBuilder";
import { useEffect, useState } from "react";

type ShellUserMessage = {
  accessToken?: unknown;
  displayName?: unknown;
  email?: unknown;
  login?: unknown;
};

function creatorFromMessage(user: ShellUserMessage | null | undefined) {
  const candidates = [user?.login, user?.email, user?.displayName];
  const value = candidates.find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);
  return value?.trim().slice(0, 200) || "desconocido";
}

export default function EmbeddedRuleBuilderPage() {
  const [creator, setCreator] = useState("desconocido");
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    let parentOrigin = "";
    try {
      parentOrigin = document.referrer ? new URL(document.referrer).origin : "";
    } catch {
      parentOrigin = "";
    }
    function handleShellMessage(event: MessageEvent) {
      if (event.source !== window.parent || (parentOrigin && event.origin !== parentOrigin)) return;
      if (!event.data || typeof event.data !== "object") return;
      if (event.data.type === "venta-pasajes:shell-auth-clear") {
        setCreator("desconocido");
        setAccessToken(null);
        return;
      }
      if (event.data.type !== "venta-pasajes:shell-auth-token") return;
      const user = event.data.user;
      setCreator(user && typeof user === "object" ? creatorFromMessage(user as ShellUserMessage) : "desconocido");
      setAccessToken(typeof event.data.accessToken === "string" && event.data.accessToken.trim() ? event.data.accessToken : null);
    }

    window.addEventListener("message", handleShellMessage);
    return () => window.removeEventListener("message", handleShellMessage);
  }, []);

  return <VisualFormulaBuilder accessToken={accessToken} creator={creator} />;
}
