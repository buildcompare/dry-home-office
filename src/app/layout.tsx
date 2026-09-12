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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}