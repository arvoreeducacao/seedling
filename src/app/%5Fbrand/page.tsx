import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Unbounded } from "next/font/google";
import { currentAdmin } from "@/lib/auth";
import { BrandShowcase } from "./showcase";

const display = Unbounded({ subsets: ["latin"], weight: ["800"], variable: "--font-display" });

export const metadata: Metadata = { title: "Brand", robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

export default async function BrandPage() {
  if (process.env.NODE_ENV === "production" && !(await currentAdmin())) notFound();
  return (
    <div className={display.variable}>
      <BrandShowcase />
    </div>
  );
}
