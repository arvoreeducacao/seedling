import type { Metadata } from "next";
import { Geist, Geist_Mono, Unbounded } from "next/font/google";
import { I18nProvider } from "@/components/i18n";
import { getI18n } from "@/lib/i18n/server";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const unbounded = Unbounded({ variable: "--font-unbounded", subsets: ["latin"], weight: ["800"] });

const siteUrl = (process.env.SEEDLING_URL ?? "http://localhost:3100").replace(/\/$/, "");

const htmlLang = { en: "en", pt: "pt-BR" } as const;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    metadataBase: new URL(siteUrl),
    title: { default: t("app.title"), template: `%s · ${t("app.title")}` },
    description: t("app.description"),
    openGraph: { type: "website", siteName: t("app.title"), title: t("app.title"), description: t("app.tagline") },
    twitter: { card: "summary_large_image", title: t("app.title"), description: t("app.tagline") },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale } = await getI18n();
  return (
    <html lang={htmlLang[locale]}>
      <body className={`${geistSans.variable} ${geistMono.variable} ${unbounded.variable}`}>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
