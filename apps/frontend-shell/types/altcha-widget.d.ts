import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "altcha-widget": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        auto?: "off" | "onfocus" | "onload" | "onsubmit";
        challenge?: string;
        hidelogo?: string;
        hidefooter?: string;
        language?: string;
        name?: string;
        type?: "native" | "checkbox" | "switch";
        workers?: string;
      };
    }
  }
}
