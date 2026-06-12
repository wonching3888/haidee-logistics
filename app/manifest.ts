import type { MetadataRoute } from "next";
import { DEFAULT_AUTHED_ROUTE } from "@/lib/routes";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "海利物流管理系统",
    short_name: "海利物流",
    description: "HAI DEE LOGISTICS CO., LTD — Powered by DMC SYSTEM",
    start_url: DEFAULT_AUTHED_ROUTE,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F5F7FA",
    theme_color: "#0A1628",
    icons: [
      {
        src: "/icon.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-touch-icon.svg",
        sizes: "180x180",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
