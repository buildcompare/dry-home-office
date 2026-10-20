import type { Metadata, Viewport } from "next";
import ServiceWorkerRegister from "@/components/pwa/ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "DryHome Office",
  description: "DryHome Damp Proofing Solutions Office",
  applicationName: "DryHome Office",
  appleWebApp: {
    capable: true,
    title: "DryHome",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#252525",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
      {/* Browser-native spell checking (British English via lang) for all editable fields by default. */}
      <body spellCheck>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}