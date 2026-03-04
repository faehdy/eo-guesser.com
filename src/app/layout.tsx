import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EO Guesser – Guess the Satellite Location",
  description:
    "A GeoGuessr-style game where you identify Sentinel-2 satellite image locations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}

