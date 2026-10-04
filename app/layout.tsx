import type { Metadata } from "next";
import { Geist, Geist_Mono, Unbounded } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const display = Unbounded({ variable: "--font-display-latin", subsets: ["latin"], weight: ["500", "700", "800"] });

export const metadata: Metadata = {
  title: "PATCHRUN — AI experimentation infrastructure for game systems",
  description: "Simulate players. Test agents. Generate interventions. Verify outcomes. AI proposes. Simulation competes. Evidence decides.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
