import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DryHome Office",
  description: "DryHome Damp Proofing Solutions Office",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
      {/* Browser-native spell checking (British English via lang) for all editable fields by default. */}
      <body spellCheck>{children}</body>
    </html>
  );
}