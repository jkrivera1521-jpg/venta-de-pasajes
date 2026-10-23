import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@xyflow/react/dist/style.css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Constructor visual de fórmulas",
  description: "Construye formulas de negocio con bloques visuales para AviatorScript"
};

export const viewport: Viewport = {
  initialScale: 1,
  viewportFit: "cover",
  width: "device-width"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
