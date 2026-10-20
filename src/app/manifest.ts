import type { MetadataRoute } from "next";

/* Installable app. "/" sends owners to the dashboard and employees to /staff (proxy). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "DryHome Office",
    short_name: "DryHome",
    description: "Dry Home Damp Proofing Solutions office and staff app",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#252525",
    theme_color: "#252525",
    lang: "en-GB",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
