export type MicrofrontendStatus = "online" | "degraded" | "offline";

export interface MicrofrontendManifest {
  name: string;
  title: string;
  version: string;
  status: MicrofrontendStatus;
  mount_path: string;
  entry_url: string;
  health_url: string;
  exposed_at: string;
  capabilities: string[];
}
