"use client";

import {
  Archive,
  BarChart3,
  Bell,
  BookOpen,
  BusFront,
  Camera,
  Building2,
  CalendarClock,
  CalendarDays,
  Calculator,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Cloud,
  CreditCard,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileText,
  Filter,
  Flag,
  Folder,
  GitBranch,
  Globe2,
  Heart,
  HelpCircle,
  Images,
  Home,
  Inbox,
  Info,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Map,
  MapPin,
  MessageSquare,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Package,
  Pencil,
  Pin,
  PinOff,
  Plane,
  Power,
  Route,
  RotateCw,
  Search,
  Settings,
  ShoppingCart,
  ShieldCheck,
  Sun,
  Ticket,
  Truck,
  Upload,
  UserCircle,
  UserCheck,
  Users,
  Wallet,
  Wrench,
  XCircle
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ChangeEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RemoteMfeFrame } from "./RemoteMfeFrame";

type MenuItem = {
  code: string;
  label: string;
  icon?: string | null;
  target_url: string;
  manifest_url?: string | null;
  informational_only?: boolean;
  children: MenuItem[];
};

function findMenuPath(items: MenuItem[], code: string, parents: MenuItem[] = []): MenuItem[] {
  for (const item of items) {
    const path = [...parents, item];
    if (item.code === code) {
      return path;
    }

    const childPath = findMenuPath(item.children, code, path);
    if (childPath.length > 0) {
      return childPath;
    }
  }

  return [];
}

function isNavigableMenuItem(item: MenuItem) {
  return !item.informational_only && Boolean(item.manifest_url || item.target_url.startsWith("http://") || item.target_url.startsWith("https://"));
}

const identityStorageKey = "venta-pasajes.identity.access-token";
const identityUserStorageKey = "venta-pasajes.identity.current-user";
const identityLogoutEventKey = "venta-pasajes.identity.logout-event";
const sessionIdleTimeoutMs = 3 * 60 * 1000;
const sessionRefreshIntervalMs = 5 * 60 * 1000;
const sessionRefreshCooldownMs = 30 * 1000;

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
    aviatorscript: string;
    dispatch: string;
    formulaRuntime: string;
    identity: string;
    onlineSales: string;
    reporting: string;
    reportRuntime: string;
    ticketing: string;
  };
};

type CurrentUser = {
  avatar_url?: string | null;
  dark_mode: boolean;
  display_name: string;
  email: string;
  identity_type: "GOOGLE" | "LOCAL";
  login: string;
  permissions: string[];
  roles: string[];
};

type RefreshedSession = {
  access_token: string;
  user: CurrentUser;
};

type AvatarOption = {
  id: string;
  label: string;
  background: string;
  skin: string;
  hair: string;
  shirt: string;
};

const avatarCatalog: AvatarOption[] = [
  { id: "avatar-cielo", label: "Cielo", background: "#dceeff", skin: "#f2c7a5", hair: "#4b2d24", shirt: "#2463a6" },
  { id: "avatar-coral", label: "Coral", background: "#ffe3df", skin: "#8f573d", hair: "#201b1b", shirt: "#bf4058" },
  { id: "avatar-esmeralda", label: "Esmeralda", background: "#d9f4eb", skin: "#d99a70", hair: "#5a3d28", shirt: "#16826f" },
  { id: "avatar-violeta", label: "Violeta", background: "#eee3ff", skin: "#f0bd9d", hair: "#6e3f76", shirt: "#7545a8" },
  { id: "avatar-ambar", label: "Ambar", background: "#fff0c9", skin: "#75452f", hair: "#171717", shirt: "#d27b20" },
  { id: "avatar-turquesa", label: "Turquesa", background: "#d8f5f5", skin: "#e0ac88", hair: "#273e54", shirt: "#147c87" },
  { id: "avatar-rosa", label: "Rosa", background: "#ffe1f0", skin: "#f5cdb1", hair: "#8c314e", shirt: "#c33a78" },
  { id: "avatar-grafito", label: "Grafito", background: "#e7eaef", skin: "#a96e4d", hair: "#262a31", shirt: "#475467" }
];

function AvatarIllustration({ option, large = false }: { option: AvatarOption; large?: boolean }) {
  return (
    <span className={large ? "avatar-illustration avatar-illustration-large" : "avatar-illustration"} style={{ background: option.background }}>
      <span className="avatar-illustration-shirt" style={{ background: option.shirt }} />
      <span className="avatar-illustration-neck" style={{ background: option.skin }} />
      <span className="avatar-illustration-face" style={{ background: option.skin }} />
      <span className="avatar-illustration-hair" style={{ background: option.hair }} />
      <span className="avatar-illustration-eye avatar-illustration-eye-left" />
      <span className="avatar-illustration-eye avatar-illustration-eye-right" />
    </span>
  );
}

function createAvatarDataUrl(option: AvatarOption) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("No se pudo preparar el avatar.");
  }

  context.fillStyle = option.background;
  context.fillRect(0, 0, 256, 256);
  context.fillStyle = option.shirt;
  context.beginPath();
  context.ellipse(128, 256, 98, 78, 0, Math.PI, 0, true);
  context.fill();
  context.fillStyle = option.skin;
  context.fillRect(108, 150, 40, 42);
  context.beginPath();
  context.ellipse(128, 113, 51, 65, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = option.hair;
  context.beginPath();
  context.ellipse(128, 78, 56, 43, 0, Math.PI, Math.PI * 2);
  context.fill();
  context.fillStyle = "#34251f";
  context.beginPath();
  context.arc(110, 116, 4, 0, Math.PI * 2);
  context.arc(146, 116, 4, 0, Math.PI * 2);
  context.fill();
  return canvas.toDataURL("image/png");
}

const menuIcons = {
  Archive,
  BarChart3,
  Bell,
  BookOpen,
  BusFront,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Cloud,
  CreditCard,
  FileText,
  Filter,
  Flag,
  Folder,
  Globe2,
  Heart,
  HelpCircle,
  Images,
  Home,
  Inbox,
  Info,
  KeyRound,
  LayoutDashboard,
  Map,
  MapPin,
  MessageSquare,
  Package,
  Pencil,
  Plane,
  Power,
  Route,
  Search,
  Settings,
  ShoppingCart,
  ShieldCheck,
  Ticket,
  UserCheck,
  Users,
  Truck,
  Upload,
  Wallet,
  Wrench,
  XCircle
};

function ProfileAvatar({ user, size = "default" }: { user: CurrentUser; size?: "default" | "large" }) {
  return (
    <span className={`profile-avatar profile-avatar-${size}`}>
      {user.avatar_url ? <img alt="" src={user.avatar_url} /> : <UserCircle aria-hidden="true" size={size === "large" ? 32 : 23} />}
    </span>
  );
}

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
  let payload: unknown = null;

  if (responseText) {
    try {
      payload = JSON.parse(responseText) as unknown;
    } catch {
      payload = {
        error: {
          message: "identity-service devolvio una respuesta no JSON. Revisa que el servicio este levantado y que IDENTITY_API_URL apunte a /api/v1/identity."
        }
      };
    }
  }

  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload
      ? (payload as { error?: { message?: string } }).error?.message
      : undefined;
    throw new Error(message ?? `HTTP ${response.status}`);
  }

  return payload as CurrentUser;
}

async function fetchAuthorizedMenu(token: string) {
  const response = await fetch("/api/identity/menu", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json() as Promise<MenuItem[]>;
}

function consumeAuthSessionFragment() {
  const fragment = window.location.hash.replace(/^#/, "");
  if (!fragment) {
    return null;
  }

  const params = new URLSearchParams(fragment);
  const accessToken = params.get("access_token");
  const user = params.get("user");

  if (!accessToken) {
    return null;
  }

  window.sessionStorage.setItem(identityStorageKey, accessToken);
  if (user) {
    try {
      JSON.parse(user);
      window.sessionStorage.setItem(identityUserStorageKey, user);
    } catch {
      window.sessionStorage.removeItem(identityUserStorageKey);
    }
  }

  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  return accessToken;
}

export function ShellConsole() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const runtimeConfigQuery = useQuery({
    queryFn: fetchShellRuntimeConfig,
    queryKey: ["frontend-shell", "runtime-config"],
    retry: 2,
    staleTime: 30 * 1000
  });
  const manifestUrls = runtimeConfigQuery.data?.manifests;
  const [activeModuleKey, setActiveModuleKey] = useState<string>("online-sales");
  const [openMenuPath, setOpenMenuPath] = useState<string[]>([]);
  const menuSurfaceRef = useRef<HTMLElement | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [themeBusy, setThemeBusy] = useState(false);
  const [sessionPinned, setSessionPinned] = useState(false);
  const resetIdleTimerRef = useRef<(() => void) | null>(null);
  const lastActivityAtRef = useRef(0);
  const lastSessionRefreshAtRef = useRef(0);
  const profileSurfaceRef = useRef<HTMLDivElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const cropStageRef = useRef<HTMLDivElement | null>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropImageRef = useRef<HTMLImageElement | null>(null);
  const cropPointerRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [cropImageReady, setCropImageReady] = useState(false);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropRotation, setCropRotation] = useState(0);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const currentUserQuery = useQuery({
    enabled: authChecked && Boolean(accessToken),
    // Keep the authenticated shell visible while the refreshed token is checked.
    placeholderData: (previousData) => previousData,
    queryFn: () => fetchCurrentUser(accessToken as string),
    queryKey: ["frontend-shell", "identity-session", accessToken],
    refetchInterval: 10 * 1000,
    refetchIntervalInBackground: true,
    retry: false,
    staleTime: 30 * 1000
  });
  const menuQuery = useQuery({
    enabled: authChecked && Boolean(accessToken),
    // Keep the last authorized tree while a refreshed token creates a new query key.
    // Without this placeholder, child modules can briefly disappear and the shell
    // incorrectly falls back to the first top-level module.
    placeholderData: (previousData) => previousData,
    queryFn: () => fetchAuthorizedMenu(accessToken as string),
    queryKey: ["frontend-shell", "authorized-menu", accessToken],
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: true,
    retry: false,
    staleTime: 30 * 1000
  });
  const userRoles = currentUserQuery.data?.roles ?? [];
  const currentUser = currentUserQuery.data ?? null;
  const hasCurrentUser = Boolean(currentUser);
  const isCustomerOnly = userRoles.length === 0 || userRoles.every((role) => role === "CUSTOMER");
  const fallbackModules = useMemo(
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
          key: "report-runtime" as const,
          label: "Pruebas de report-service",
          icon: FileText,
          enabled: true,
          fallbackName: "mfe-report-runtime",
          fallbackTitle: "Pruebas de report-service",
          manifestUrl: manifestUrls?.reportRuntime ?? ""
        },
        {
          key: "admin" as const,
          label: "Admin",
          icon: Settings,
          enabled: true,
          fallbackName: "mfe-admin",
          fallbackTitle: "Administracion",
          manifestUrl: manifestUrls?.admin ?? ""
        },
        {
          key: "aviatorscript" as const,
          label: "Constructor visual de fórmulas",
          icon: GitBranch,
          enabled: true,
          fallbackName: "mfe-aviatorscript",
          fallbackTitle: "Constructor visual de fórmulas AviatorScript",
          manifestUrl: manifestUrls?.aviatorscript ?? ""
        },
        {
          key: "formula-runtime" as const,
          label: "Aplicaciones de cálculo",
          icon: Calculator,
          enabled: true,
          fallbackName: "mfe-formula-runtime",
          fallbackTitle: "Aplicaciones de cálculo",
          manifestUrl: manifestUrls?.formulaRuntime ?? ""
        }
      ];
    },
    [isCustomerOnly, manifestUrls]
  );
  const modules = useMemo(() => {
    const dynamicItems = menuQuery.data ?? [];
    if (dynamicItems.length === 0) {
      return fallbackModules;
    }
    return dynamicItems.map((item) => ({
      ...item,
      enabled: isNavigableMenuItem(item),
      fallbackName: item.code,
      fallbackTitle: item.label,
      icon: menuIcons[item.icon as keyof typeof menuIcons] ?? LayoutDashboard,
      key: item.code,
      manifestUrl: item.manifest_url ?? ""
    }));
  }, [fallbackModules, menuQuery.data]);
  const dynamicMenuItems = menuQuery.data ?? [];
  const dynamicMenuFlat = useMemo(() => {
    const result: MenuItem[] = [];
    function visit(items: MenuItem[]) {
      items.forEach((item) => {
        result.push(item);
        visit(item.children);
      });
    }
    visit(dynamicMenuItems);
    return result;
  }, [dynamicMenuItems]);
  const firstNavigableModuleKey = useMemo(() => {
    const firstDynamicItem = dynamicMenuFlat.find(isNavigableMenuItem);
    if (firstDynamicItem) {
      return firstDynamicItem.code;
    }

    return modules.find((module) => module.enabled)?.key ?? "online-sales";
  }, [dynamicMenuFlat, modules]);
  const activeDynamicItem = dynamicMenuFlat.find((item) => item.code === activeModuleKey && isNavigableMenuItem(item));
  const activeMenuPath = useMemo(() => {
    return findMenuPath(dynamicMenuItems, activeModuleKey);
  }, [activeModuleKey, dynamicMenuItems]);
  const activeModule = activeDynamicItem
    ? { entryUrl: activeDynamicItem.target_url, fallbackName: activeDynamicItem.code, fallbackTitle: activeDynamicItem.label, key: activeDynamicItem.code, manifestUrl: activeDynamicItem.manifest_url ?? "" }
    : modules.find((module) => module.key === activeModuleKey && module.enabled) ?? modules.find((module) => module.enabled) ?? modules[0];
  const currentTime = now ? shellTimeFormatter.format(now) : "--:--:--";
  const currentDate = now ? shellDateFormatter.format(now) : "Fecha local";
  const breadcrumbLabels = activeMenuPath.length > 0
    ? activeMenuPath.map((item) => ({ code: item.code, label: item.label, navigable: isNavigableMenuItem(item) }))
    : [{ code: activeModule?.key ?? "current", label: activeModule?.fallbackTitle ?? activeModule?.label ?? "Inicio", navigable: false }];

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 820px)");
    const syncSidebarForViewport = () => {
      if (mobileQuery.matches) {
        setSidebarCollapsed(true);
        return;
      }

      const savedValue = window.localStorage.getItem("venta-pasajes:sidebar-collapsed");
      if (savedValue) {
        setSidebarCollapsed(savedValue === "true");
      }
    };

    syncSidebarForViewport();
    mobileQuery.addEventListener("change", syncSidebarForViewport);
    return () => mobileQuery.removeEventListener("change", syncSidebarForViewport);
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
    const storedToken = consumeAuthSessionFragment() ?? window.sessionStorage.getItem(identityStorageKey);
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
    window.sessionStorage.removeItem(identityUserStorageKey);
    setAccessToken(null);
    router.replace("/login");
  }, [accessToken, authChecked, currentUserQuery.isError, router]);

  useEffect(() => {
    function handleCrossTabLogout(event: StorageEvent) {
      if (event.key !== identityLogoutEventKey || !event.newValue) {
        return;
      }

      window.sessionStorage.removeItem(identityStorageKey);
      window.sessionStorage.removeItem(identityUserStorageKey);
      setAccessToken(null);
      router.replace("/login");
    }

    window.addEventListener("storage", handleCrossTabLogout);
    return () => window.removeEventListener("storage", handleCrossTabLogout);
  }, [router]);

  useEffect(() => {
    if (menuQuery.isPending || menuQuery.isFetching) {
      return;
    }

    const activeDynamicItemExists = dynamicMenuItems.length > 0 && dynamicMenuFlat.some((item) => item.code === activeModuleKey && isNavigableMenuItem(item));
    const activeFallbackModuleExists = modules.some((module) => module.key === activeModuleKey && module.enabled);

    if (!activeDynamicItemExists && !activeFallbackModuleExists) {
      setActiveModuleKey(firstNavigableModuleKey);
    }
  }, [activeModuleKey, dynamicMenuFlat, dynamicMenuItems.length, firstNavigableModuleKey, menuQuery.isFetching, menuQuery.isPending, modules]);

  useEffect(() => {
    function handleOutsideMenuClick(event: MouseEvent) {
      if (!menuSurfaceRef.current?.contains(event.target as Node)) {
        setOpenMenuPath([]);
      }
    }

    document.addEventListener("click", handleOutsideMenuClick);
    return () => document.removeEventListener("click", handleOutsideMenuClick);
  }, []);

  useEffect(() => {
    function handleOutsideProfileClick(event: PointerEvent) {
      if (!profileSurfaceRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsideProfileClick);
    return () => document.removeEventListener("pointerdown", handleOutsideProfileClick);
  }, []);

  useEffect(() => {
    if (!avatarEditorOpen || !cameraOpen) {
      return;
    }

    let active = true;
    setCameraError(null);

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Este navegador no permite usar la cámara desde esta pantalla.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: "user" }
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        cameraStreamRef.current = stream;
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          await cameraVideoRef.current.play();
        }
      } catch {
        setCameraError("No se pudo acceder a la cámara. Revisa el permiso del navegador.");
      }
    }

    void startCamera();
    return () => {
      active = false;
      stopCamera();
    };
  }, [avatarEditorOpen, cameraOpen]);

  function cropBaseScale(size: number, image: HTMLImageElement, rotation: number) {
    const rotated = Math.abs(rotation) % 180 === 90;
    const imageWidth = rotated ? image.naturalHeight : image.naturalWidth;
    const imageHeight = rotated ? image.naturalWidth : image.naturalHeight;
    return Math.max(size / imageWidth, size / imageHeight);
  }

  function drawCropCanvas() {
    const stage = cropStageRef.current;
    const canvas = cropCanvasRef.current;
    const image = cropImageRef.current;
    if (!stage || !canvas || !image || !cropImageReady || image.naturalWidth === 0 || image.naturalHeight === 0) {
      return;
    }

    const size = stage.clientWidth;
    if (size === 0) {
      return;
    }

    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.round(size * devicePixelRatio);
    canvas.height = Math.round(size * devicePixelRatio);
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.clearRect(0, 0, size, size);
    context.fillStyle = "#161216";
    context.fillRect(0, 0, size, size);

    const baseScale = cropBaseScale(size, image, cropRotation);
    const renderScale = baseScale * cropZoom;
    context.save();
    context.translate(size / 2 + cropOffset.x, size / 2 + cropOffset.y);
    context.rotate((cropRotation * Math.PI) / 180);
    context.scale(renderScale, renderScale);
    context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    context.restore();
  }

  useEffect(() => {
    if (!cropOpen || !cropImageReady) {
      return;
    }

    drawCropCanvas();
    const handleResize = () => drawCropCanvas();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [cropOpen, cropImageReady, cropOffset, cropRotation, cropZoom]);

  function stopCamera() {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
  }

  function openAvatarEditor() {
    setProfileOpen(false);
    setProfileMessage(null);
    setSelectedAvatarId(null);
    setCameraError(null);
    setCameraOpen(false);
    setAvatarEditorOpen(true);
  }

  function closeAvatarEditor() {
    if (profileBusy) {
      return;
    }
    setCameraOpen(false);
    setAvatarEditorOpen(false);
    setSelectedAvatarId(null);
    setCameraError(null);
    stopCamera();
  }

  function closeCropEditor() {
    if (profileBusy) {
      return;
    }
    if (cropImageUrl) {
      URL.revokeObjectURL(cropImageUrl);
    }
    setCropOpen(false);
    setCropImageUrl(null);
    setCropImageReady(false);
    setCropZoom(1);
    setCropRotation(0);
    setCropOffset({ x: 0, y: 0 });
    cropPointerRef.current = null;
  }

  function openCropEditor(file: File) {
    if (!file.type.startsWith("image/")) {
      setProfileMessage("Selecciona un archivo de imagen.");
      return;
    }

    if (cropImageUrl) {
      URL.revokeObjectURL(cropImageUrl);
    }
    setProfileMessage(null);
    setCropImageReady(false);
    setCropImageUrl(URL.createObjectURL(file));
    setCropZoom(1);
    setCropRotation(0);
    setCropOffset({ x: 0, y: 0 });
    setCropOpen(true);
  }

  function handleCropPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!cropImageReady || profileBusy) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    cropPointerRef.current = {
      originX: cropOffset.x,
      originY: cropOffset.y,
      startX: event.clientX,
      startY: event.clientY
    };
  }

  function handleCropPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pointer = cropPointerRef.current;
    if (!pointer) {
      return;
    }
    setCropOffset({
      x: pointer.originX + event.clientX - pointer.startX,
      y: pointer.originY + event.clientY - pointer.startY
    });
  }

  function handleCropPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    cropPointerRef.current = null;
  }

  function createCroppedAvatar() {
    const stage = cropStageRef.current;
    const image = cropImageRef.current;
    if (!stage || !image || image.naturalWidth === 0 || image.naturalHeight === 0) {
      throw new Error("La imagen todavía no está lista.");
    }

    const size = stage.clientWidth;
    const outputSize = 256;
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("No se pudo preparar la foto recortada.");
    }

    const cropDiameter = size * 0.86;
    const baseScale = cropBaseScale(size, image, cropRotation);
    const outputScale = outputSize / cropDiameter;
    context.beginPath();
    context.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
    context.clip();
    context.save();
    context.translate((cropDiameter / 2 + cropOffset.x) * outputScale, (cropDiameter / 2 + cropOffset.y) * outputScale);
    context.rotate((cropRotation * Math.PI) / 180);
    context.scale(baseScale * cropZoom * outputScale, baseScale * cropZoom * outputScale);
    context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    context.restore();
    return canvas.toDataURL("image/png");
  }

  async function confirmCrop() {
    try {
      const saved = await saveAvatar(createCroppedAvatar());
      if (saved) {
        closeCropEditor();
      }
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "No se pudo recortar la foto.");
    }
  }

  function handleBreadcrumbSelect(code: string) {
    const selectedItem = dynamicMenuFlat.find((item) => item.code === code);
    if (selectedItem && isNavigableMenuItem(selectedItem)) {
      setActiveModuleKey(selectedItem.code);
    }
  }

  function handleMenuSelect(code: string, collapseMobile = true) {
    setActiveModuleKey(code);
    if (collapseMobile && window.matchMedia("(max-width: 820px)").matches) {
      setSidebarCollapsed(true);
    }
  }

  const handleMfeInteraction = useCallback(() => {
    lastActivityAtRef.current = Date.now();
    resetIdleTimerRef.current?.();
    setOpenMenuPath([]);
  }, []);

  async function saveAvatar(avatarUrl: string): Promise<boolean> {
    if (!accessToken || !currentUser) {
      return false;
    }

    setProfileBusy(true);
    setProfileMessage(null);
    try {
      const response = await fetch("/api/identity/me/avatar", {
        body: JSON.stringify({ avatar_url: avatarUrl }),
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        method: "PATCH"
      });
      const payload = await response.json().catch(() => null) as CurrentUser | { error?: { message?: string } } | null;
      if (!response.ok) {
        const errorMessage = payload && "error" in payload ? payload.error?.message : undefined;
        throw new Error(errorMessage ?? "No se pudo actualizar la foto.");
      }

      const updatedUser = payload as CurrentUser;
      queryClient.setQueryData(["frontend-shell", "identity-session", accessToken], updatedUser);
      window.sessionStorage.setItem(identityUserStorageKey, JSON.stringify(updatedUser));
      setProfileMessage("Foto actualizada correctamente.");
      setCameraOpen(false);
      setAvatarEditorOpen(false);
      setSelectedAvatarId(null);
      stopCamera();
      setProfileOpen(true);
      return true;
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "No se pudo actualizar la foto.");
      return false;
    } finally {
      setProfileBusy(false);
    }
  }

  async function handleThemeToggle() {
    if (!accessToken || !currentUser || themeBusy) {
      return;
    }

    const nextDarkMode = !Boolean(currentUser.dark_mode);
    const cacheKey = ["frontend-shell", "identity-session", accessToken];
    const previousUser = currentUser;
    const optimisticUser = { ...previousUser, dark_mode: nextDarkMode };

    queryClient.setQueryData(cacheKey, optimisticUser);
    window.sessionStorage.setItem(identityUserStorageKey, JSON.stringify(optimisticUser));
    setThemeBusy(true);
    setProfileMessage(null);

    try {
      const response = await fetch("/api/identity/me/theme", {
        body: JSON.stringify({ dark_mode: nextDarkMode }),
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        method: "PATCH"
      });
      const payload = await response.json().catch(() => null) as CurrentUser | { error?: { message?: string } } | null;
      if (!response.ok) {
        const errorMessage = payload && "error" in payload ? payload.error?.message : undefined;
        throw new Error(errorMessage ?? "No se pudo guardar el tema.");
      }

      const updatedUser = payload as CurrentUser;
      queryClient.setQueryData(cacheKey, updatedUser);
      window.sessionStorage.setItem(identityUserStorageKey, JSON.stringify(updatedUser));
    } catch (error) {
      queryClient.setQueryData(cacheKey, previousUser);
      window.sessionStorage.setItem(identityUserStorageKey, JSON.stringify(previousUser));
      setProfileMessage(error instanceof Error ? error.message : "No se pudo guardar el tema.");
    } finally {
      setThemeBusy(false);
    }
  }

  function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !accessToken || !currentUser) {
      return;
    }

    openCropEditor(file);
  }

  async function saveSelectedAvatar() {
    const option = avatarCatalog.find((item) => item.id === selectedAvatarId);
    if (!option) {
      return;
    }

    try {
      await saveAvatar(createAvatarDataUrl(option));
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "No se pudo preparar el avatar.");
    }
  }

  async function captureCameraPhoto() {
    const video = cameraVideoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError("La cámara todavía no está lista. Inténtalo nuevamente.");
      return;
    }

    const maxDimension = 256;
    const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");

    if (!context) {
      setCameraError("No se pudo preparar la fotografía.");
      return;
    }

    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    await saveAvatar(canvas.toDataURL("image/jpeg", 0.84));
  }

  async function logout(revokeAllSessions = true) {
    if (accessToken) {
      try {
        await fetch(revokeAllSessions ? "/api/identity/auth/logout" : "/api/identity/auth/logout/current", {
          headers: { Authorization: `Bearer ${accessToken}` },
          method: "POST"
        });
      } catch {
        // The local session is still cleared when the service is unavailable.
      }
    }
    window.sessionStorage.removeItem(identityStorageKey);
    window.sessionStorage.removeItem(identityUserStorageKey);
    window.localStorage.setItem(identityLogoutEventKey, String(Date.now()));
    setSessionPinned(false);
    setAccessToken(null);
    router.replace("/login");
  }

  useEffect(() => {
    if (!authChecked || !accessToken || !hasCurrentUser || currentUserQuery.isPending || currentUserQuery.isError) {
      return;
    }

    let idleTimer: number | null = null;
    const resetIdleTimer = () => {
      lastActivityAtRef.current = Date.now();
      if (sessionPinned) {
        return;
      }

      if (idleTimer !== null) {
        window.clearTimeout(idleTimer);
      }

      idleTimer = window.setTimeout(() => {
        void logout(false);
      }, sessionIdleTimeoutMs);
    };
    resetIdleTimerRef.current = resetIdleTimer;
    const activityEvents = ["pointerdown", "pointermove", "keydown", "touchstart", "wheel", "scroll"] as const;

    activityEvents.forEach((eventName) => {
      document.addEventListener(eventName, resetIdleTimer, { passive: true });
    });
    resetIdleTimer();

    return () => {
      if (idleTimer !== null) {
        window.clearTimeout(idleTimer);
      }
      if (resetIdleTimerRef.current === resetIdleTimer) {
        resetIdleTimerRef.current = null;
      }
      activityEvents.forEach((eventName) => {
        document.removeEventListener(eventName, resetIdleTimer);
      });
    };
  }, [accessToken, authChecked, currentUserQuery.isError, currentUserQuery.isPending, hasCurrentUser, sessionPinned]);

  useEffect(() => {
    if (!authChecked || !accessToken || !hasCurrentUser || currentUserQuery.isPending || currentUserQuery.isError) {
      return;
    }

    let active = true;
    async function refreshSession() {
      if (!sessionPinned && Date.now() - lastActivityAtRef.current >= sessionIdleTimeoutMs) {
        return;
      }

      const refreshStartedAt = Date.now();
      if (refreshStartedAt - lastSessionRefreshAtRef.current < sessionRefreshCooldownMs) {
        return;
      }
      lastSessionRefreshAtRef.current = refreshStartedAt;

      try {
        const response = await fetch("/api/identity/auth/refresh", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
          method: "POST"
        });
        if (!response.ok) {
          return;
        }

        const payload = await response.json() as RefreshedSession;
        if (!active || !payload.access_token || !payload.user) {
          return;
        }

        queryClient.setQueryData(["frontend-shell", "identity-session", payload.access_token], payload.user);
        window.sessionStorage.setItem(identityStorageKey, payload.access_token);
        window.sessionStorage.setItem(identityUserStorageKey, JSON.stringify(payload.user));
        setAccessToken(payload.access_token);
      } catch {
        // The regular session validation will handle an unavailable identity service.
      }
    }

    if (sessionPinned) {
      void refreshSession();
    }

    const refreshTimer = window.setInterval(() => {
      void refreshSession();
    }, sessionRefreshIntervalMs);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, [accessToken, authChecked, currentUserQuery.isError, currentUserQuery.isPending, hasCurrentUser, queryClient, sessionPinned]);

  const selectedAvatar = avatarCatalog.find((item) => item.id === selectedAvatarId);

  function renderDynamicMenu(items: MenuItem[], parentPath: string[] = []): ReactNode {
    return (
      <div className={parentPath.length === 0 ? "nav-menu-level nav-menu-root" : "nav-menu-level"}>
        {items.map((item) => {
          const Icon = menuIcons[item.icon as keyof typeof menuIcons] ?? LayoutDashboard;
          const hasChildren = item.children.length > 0;
          const itemPath = [...parentPath, item.code];
          const isOpen = itemPath.every((code, index) => openMenuPath[index] === code) && openMenuPath.length >= itemPath.length;
          const enabled = isNavigableMenuItem(item);

          return (
            <div
              className={isOpen ? "nav-menu-entry nav-menu-entry-open" : "nav-menu-entry"}
              key={item.code}
              onMouseEnter={() => {
                if (hasChildren) {
                  setOpenMenuPath(itemPath);
                } else if (!hasChildren && openMenuPath.length > parentPath.length) {
                  setOpenMenuPath(parentPath);
                }
              }}
            >
              <button
                aria-expanded={hasChildren ? isOpen : undefined}
                aria-haspopup={hasChildren ? "menu" : undefined}
                className={activeModuleKey === item.code ? "nav-item nav-menu-item nav-item-active" : "nav-item nav-menu-item"}
                disabled={!enabled && !hasChildren}
                onClick={() => {
                  if (hasChildren) {
                    const samePath = openMenuPath.length === itemPath.length && itemPath.every((code, index) => openMenuPath[index] === code);
                    setOpenMenuPath(samePath ? parentPath : itemPath);
                    if (enabled) {
                      handleMenuSelect(item.code, false);
                    }
                    return;
                  }

                  if (enabled) {
                    handleMenuSelect(item.code);
                    setOpenMenuPath([]);
                  }
                }}
            title={hasChildren ? `Abrir ${item.label}` : item.informational_only ? "Solo informativo" : enabled ? item.label : "Modulo no configurado"}
                type="button"
              >
                <Icon aria-hidden="true" size={18} />
                <span>{item.label}</span>
                {hasChildren ? <ChevronRight aria-hidden="true" className="nav-menu-chevron" size={16} /> : null}
              </button>
              {hasChildren && isOpen ? <div className="nav-flyout">{renderDynamicMenu(item.children, itemPath)}</div> : null}
            </div>
          );
        })}
      </div>
    );
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
    <main
      className={[
        "shell-layout",
        currentUser?.dark_mode ? "shell-layout-dark" : "",
        sidebarCollapsed ? "shell-layout-sidebar-hidden" : ""
      ].filter(Boolean).join(" ")}
    >
      <div className="shell-session-actions global-session-actions" ref={profileSurfaceRef}>
        {sidebarCollapsed ? (
          <button
            aria-label="Mostrar barra lateral"
            className="icon-button sidebar-toggle workspace-sidebar-toggle"
            onClick={() => setSidebarCollapsed(false)}
            title="Mostrar barra lateral"
            type="button"
          >
            <PanelLeftOpen aria-hidden="true" className="sidebar-toggle-desktop-icon" size={18} />
            <ChevronDown aria-hidden="true" className="sidebar-toggle-mobile-icon" size={18} />
          </button>
        ) : null}
        {!sidebarCollapsed ? (
          <button
            aria-label="Ocultar barra lateral"
            className="icon-button sidebar-toggle mobile-sidebar-toggle workspace-sidebar-toggle"
            onClick={() => setSidebarCollapsed(true)}
            title="Ocultar barra lateral"
            type="button"
          >
            <PanelLeftClose aria-hidden="true" className="sidebar-toggle-desktop-icon" size={18} />
            <ChevronUp aria-hidden="true" className="sidebar-toggle-mobile-icon" size={18} />
          </button>
        ) : null}
        {currentUser ? (
          <>
            <button
              aria-label={sessionPinned ? "Desanclar sesión" : "Anclar sesión"}
              aria-pressed={sessionPinned}
              className={sessionPinned ? "session-pin-toggle session-pin-toggle-active" : "session-pin-toggle"}
              onClick={() => setSessionPinned((value) => !value)}
              title={sessionPinned ? "Desanclar sesión" : "Anclar sesión: mantener abierta"}
              type="button"
            >
              {sessionPinned ? <Pin aria-hidden="true" size={18} /> : <PinOff aria-hidden="true" size={18} />}
            </button>
            <button
              aria-label={currentUser.dark_mode ? "Activar modo claro" : "Activar modo oscuro"}
              aria-pressed={currentUser.dark_mode}
              className="theme-toggle"
              disabled={themeBusy}
              onClick={() => void handleThemeToggle()}
              title={currentUser.dark_mode ? "Activar modo claro" : "Activar modo oscuro"}
              type="button"
            >
              {currentUser.dark_mode ? <Sun aria-hidden="true" size={18} /> : <Moon aria-hidden="true" size={18} />}
            </button>
            <button
              aria-expanded={profileOpen}
              aria-haspopup="dialog"
              className="profile-trigger"
              onClick={() => {
                setProfileOpen((value) => !value);
                setProfileMessage(null);
              }}
              type="button"
            >
              <ProfileAvatar user={currentUser} />
              <span className="profile-trigger-copy">
                <strong>{currentUser.display_name || currentUser.login}</strong>
                <span>{currentUser.email || currentUser.login}</span>
              </span>
              {profileOpen ? <ChevronUp aria-hidden="true" size={17} /> : <ChevronDown aria-hidden="true" size={17} />}
            </button>
            {profileOpen ? (
              <div className="profile-popover" role="dialog" aria-label="Perfil de usuario">
                <div className="profile-popover-header">
                  <div className="profile-avatar-wrap">
                    <ProfileAvatar size="large" user={currentUser} />
                    <button
                      aria-label="Cambiar foto de perfil"
                      className="profile-avatar-edit"
                      disabled={profileBusy}
                      onClick={openAvatarEditor}
                      title="Cambiar foto de perfil"
                      type="button"
                    >
                      <Pencil aria-hidden="true" size={14} />
                    </button>
                  </div>
                  <div className="profile-account-copy">
                    <strong>{currentUser.display_name || currentUser.login}</strong>
                    <span>{currentUser.email || currentUser.login}</span>
                  </div>
                  <button
                    aria-label="Cerrar perfil"
                    className="profile-collapse"
                    onClick={() => setProfileOpen(false)}
                    type="button"
                  >
                    <ChevronUp aria-hidden="true" size={18} />
                  </button>
                </div>
                {profileMessage ? <p className="profile-message" role="status">{profileMessage}</p> : null}
                <div className="profile-divider" />
                <button className="profile-logout" disabled={profileBusy} onClick={() => void logout()} type="button">
                  <LogOut aria-hidden="true" size={20} />
                  <span>Cerrar sesión</span>
                </button>
                <div className="profile-links" aria-label="Información legal">
                  <span>Política de Privacidad</span>
                  <b aria-hidden="true">•</b>
                  <span>Términos del Servicio</span>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <button className="icon-button" onClick={() => void logout()} title="Cerrar sesion global" type="button">
            <LogOut aria-hidden="true" size={18} />
          </button>
        )}
      </div>

      {!sidebarCollapsed ? (
        <aside className="sidebar" aria-label="Navegacion principal" ref={menuSurfaceRef}>
          <div className="sidebar-header">
            <div className="brand">
              <span className="brand-mark">
                <BusFront aria-hidden="true" size={22} />
              </span>
              <div>
                <strong>Venta Pasajes</strong>
                <span>Cloud MVP</span>
              </div>
            </div>
            <button
              aria-label="Ocultar barra lateral"
              className="icon-button sidebar-toggle sidebar-header-toggle"
              onClick={() => setSidebarCollapsed(true)}
              title="Ocultar barra lateral"
              type="button"
            >
              <PanelLeftClose aria-hidden="true" className="sidebar-toggle-desktop-icon" size={18} />
              <ChevronDown aria-hidden="true" className="sidebar-toggle-mobile-icon" size={18} />
            </button>
          </div>

          <nav className="nav-list">
            {dynamicMenuItems.length > 0 ? renderDynamicMenu(dynamicMenuItems) : modules.map((item) => {
              const Icon = item.icon;
              return <button className={activeModuleKey === item.key ? "nav-item nav-item-active" : "nav-item"} disabled={!item.enabled} key={item.label} onClick={() => item.enabled && handleMenuSelect(item.key)} type="button"><Icon aria-hidden="true" size={18} /><span>{item.label}</span></button>;
            })}
          </nav>
          <div className="sidebar-clock">
            <div className="clock-card" aria-label="Fecha y hora actual">
              <CalendarClock aria-hidden="true" size={20} />
              <div>
                <strong>{currentTime}</strong>
                <span>{currentDate}</span>
              </div>
            </div>
          </div>
        </aside>
      ) : null}

      <section className="workspace">
        <section className="module-surface" aria-label="Modulo remoto">
          <RemoteMfeFrame
            accessToken={accessToken}
            breadcrumbs={breadcrumbLabels}
            entryUrl={activeModule && "entryUrl" in activeModule ? activeModule.entryUrl : undefined}
            fallbackTitle={activeModule.fallbackTitle ?? activeModule.label}
            key={activeModule.key}
            manifestUrl={activeModule.manifestUrl ?? ""}
            onAuthRevoked={logout}
            onBreadcrumbSelect={handleBreadcrumbSelect}
            onMfeInteraction={handleMfeInteraction}
            shellUser={currentUser}
          />
        </section>
      </section>
      {avatarEditorOpen ? (
        <div
          aria-hidden="false"
          className="avatar-editor-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAvatarEditor();
            }
          }}
        >
          <section aria-labelledby="avatar-editor-title" aria-modal="true" className="avatar-editor" role="dialog">
            <header className="avatar-editor-header">
              {cameraOpen ? (
                <button aria-label="Volver al catálogo de avatares" className="icon-button" onClick={() => setCameraOpen(false)} type="button">
                  <ChevronLeft aria-hidden="true" size={19} />
                </button>
              ) : (
                <span className="avatar-editor-header-spacer" />
              )}
              <h2 id="avatar-editor-title">Cambia la foto de perfil</h2>
              <button aria-label="Cerrar editor de foto" className="icon-button" disabled={profileBusy} onClick={closeAvatarEditor} type="button">
                <XCircle aria-hidden="true" size={19} />
              </button>
            </header>

            <div className="avatar-editor-body">
              {cameraOpen ? (
                <div className="avatar-camera-view">
                  {cameraError ? (
                    <div className="avatar-camera-error" role="alert">
                      <Camera aria-hidden="true" size={26} />
                      <p>{cameraError}</p>
                      <button className="avatar-secondary-button" onClick={() => setCameraOpen(false)} type="button">Volver a opciones</button>
                    </div>
                  ) : (
                    <>
                      <video aria-label="Vista previa de la cámara" autoPlay className="avatar-camera-video" muted playsInline ref={cameraVideoRef} />
                      <button aria-label="Tomar foto" className="avatar-capture-button" disabled={profileBusy} onClick={() => void captureCameraPhoto()} title="Tomar foto" type="button">
                        <Camera aria-hidden="true" size={22} />
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div className="avatar-editor-preview">
                    {selectedAvatar ? <AvatarIllustration large option={selectedAvatar} /> : currentUser ? <ProfileAvatar size="large" user={currentUser} /> : null}
                    <span className="avatar-editor-camera-badge"><Camera aria-hidden="true" size={17} /></span>
                  </div>

                  <div className="avatar-editor-actions">
                    <button className="avatar-editor-action" disabled={profileBusy} onClick={() => avatarInputRef.current?.click()} type="button">
                      <Upload aria-hidden="true" size={20} />
                      <span>Subir desde el dispositivo</span>
                    </button>
                    <button className="avatar-editor-action" disabled={profileBusy} onClick={() => setCameraOpen(true)} type="button">
                      <Camera aria-hidden="true" size={20} />
                      <span>Tomar una foto</span>
                    </button>
                  </div>

                  <div className="avatar-catalog-heading">
                    <div>
                      <strong>Elige un avatar</strong>
                      <span>Selecciona una ilustración para tu perfil</span>
                    </div>
                    <Images aria-hidden="true" size={20} />
                  </div>
                  <div className="avatar-catalog" aria-label="Catálogo de avatares">
                    {avatarCatalog.map((option) => (
                      <button
                        aria-label={`Seleccionar avatar ${option.label}`}
                        className={selectedAvatarId === option.id ? "avatar-catalog-option avatar-catalog-option-selected" : "avatar-catalog-option"}
                        key={option.id}
                        disabled={profileBusy}
                        onClick={() => setSelectedAvatarId(option.id)}
                        title={option.label}
                        type="button"
                      >
                        <AvatarIllustration option={option} />
                        {selectedAvatarId === option.id ? <Check aria-hidden="true" className="avatar-catalog-check" size={16} /> : null}
                      </button>
                    ))}
                  </div>

                  {profileMessage ? <p className="profile-message avatar-editor-message" role="status">{profileMessage}</p> : null}
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    className="profile-file-input"
                    onChange={handleAvatarUpload}
                    ref={avatarInputRef}
                    type="file"
                  />
                  {selectedAvatar ? (
                    <button className="avatar-save-button" disabled={profileBusy} onClick={() => void saveSelectedAvatar()} type="button">
                      {profileBusy ? "Guardando..." : "Usar este avatar"}
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </section>
        </div>
      ) : null}
      {cropOpen && cropImageUrl ? (
        <div
          className="avatar-crop-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCropEditor();
            }
          }}
        >
          <section aria-labelledby="avatar-crop-title" aria-modal="true" className="avatar-crop-editor" role="dialog">
            <header className="avatar-crop-header">
              <h2 id="avatar-crop-title">Recortar y centrar</h2>
              <button aria-label="Cerrar recorte" className="icon-button" disabled={profileBusy} onClick={closeCropEditor} type="button">
                <XCircle aria-hidden="true" size={19} />
              </button>
            </header>
            <div className="avatar-crop-body">
              <div
                aria-label="Área de recorte. Arrastra la imagen para centrarla."
                className="avatar-crop-stage"
                onPointerCancel={handleCropPointerUp}
                onPointerDown={handleCropPointerDown}
                onPointerMove={handleCropPointerMove}
                onPointerUp={handleCropPointerUp}
                ref={cropStageRef}
                role="application"
              >
                <canvas className="avatar-crop-canvas" ref={cropCanvasRef} />
                <div aria-hidden="true" className="avatar-crop-shade" />
                <div aria-hidden="true" className="avatar-crop-grid" />
                <div aria-hidden="true" className="avatar-crop-circle" />
              </div>
              <img
                alt=""
                className="avatar-crop-source"
                onLoad={() => setCropImageReady(true)}
                ref={cropImageRef}
                src={cropImageUrl}
              />
              <p className="avatar-crop-hint">Arrastra la imagen para centrarla dentro del círculo.</p>
              <div className="avatar-crop-controls">
                <label className="avatar-crop-zoom">
                  <span>Zoom</span>
                  <input
                    aria-label="Ajustar zoom de la foto"
                    max="3"
                    min="1"
                    onChange={(event) => setCropZoom(Number(event.target.value))}
                    step="0.05"
                    type="range"
                    value={cropZoom}
                  />
                </label>
                <button className="avatar-crop-tool" disabled={profileBusy} onClick={() => setCropRotation((value) => (value + 90) % 360)} type="button">
                  <RotateCw aria-hidden="true" size={18} />
                  <span>Rotar</span>
                </button>
                <button className="avatar-crop-tool" disabled={profileBusy} onClick={() => { setCropZoom(1); setCropOffset({ x: 0, y: 0 }); }} type="button">
                  <span>1:1</span>
                  <span>Centrar</span>
                </button>
              </div>
              {profileMessage ? <p className="profile-message avatar-editor-message" role="status">{profileMessage}</p> : null}
              <div className="avatar-crop-footer">
                <button className="avatar-crop-cancel" disabled={profileBusy} onClick={closeCropEditor} type="button">Cancelar</button>
                <button className="avatar-save-button" disabled={profileBusy || !cropImageReady} onClick={() => void confirmCrop()} type="button">
                  {profileBusy ? "Guardando..." : "Usar esta foto"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
