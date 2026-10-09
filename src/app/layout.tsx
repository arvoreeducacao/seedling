import type { Metadata } from "next";
import { Geist, Geist_Mono, Unbounded } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const unbounded = Unbounded({ variable: "--font-unbounded", subsets: ["latin"], weight: ["800"] });

const siteUrl = (process.env.SEEDLING_URL ?? "http://localhost:3100").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Seedling", template: "%s · Seedling" },
  description: "Coding interviews for engineers who work with AI agents",
  openGraph: { type: "website", siteName: "Seedling", title: "Seedling", description: "Live coding interviews with Claude Code in the room." },
  twitter: { card: "summary_large_image", title: "Seedling", description: "Live coding interviews with Claude Code in the room." },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${unbounded.variable}`}>{children}</body>
    </html>
  );
}
