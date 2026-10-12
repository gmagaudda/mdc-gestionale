import type { MetadataRoute } from "next";
import messages from "@/messages/it.json";
import colors from "@/lib/pwa/colors.json";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: messages.common.appName,
    short_name: messages.common.appName,
    description: messages.common.appDescription,
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "it",
    background_color: colors.backgroundLight,
    theme_color: colors.backgroundLight,
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
