import type { Metadata } from "next";
import { Hanken_Grotesk, IBM_Plex_Mono, Source_Serif_4 } from "next/font/google";
import { cookies } from "next/headers";
import { Suspense } from "react";
import "./globals.css";
import { SignInPromptProvider } from "@/components/auth/SignInPromptProvider";
import { BalanceChip } from "@/components/layout/BalanceChip";
import { DailyBonusClaimer } from "@/components/layout/DailyBonusClaimer";
import { Header } from "@/components/layout/Header";
import { Skeleton } from "@/components/ui/Skeleton";
import { ToastProvider } from "@/components/ui/Toast";
import { APPEARANCE_COOKIE } from "@/lib/appearance";
import { getSession } from "@/lib/dal";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: "HuskyMarkets",
  description:
    "Prediction markets for Northeastern students — virtual HuskyCoin only.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [session, cookieStore] = await Promise.all([getSession(), cookies()]);
  const user = session ? { id: session.userId } : null;
  const isDark = cookieStore.get(APPEARANCE_COOKIE)?.value === "dark";

  return (
    <html
      lang="en"
      className={`${sourceSerif.variable} ${hanken.variable} ${plexMono.variable} h-full antialiased ${isDark ? "dark" : ""}`}
    >
      <body className="min-h-full bg-page font-sans text-text">
        <ToastProvider>
          <SignInPromptProvider>
            <Header
              authenticated={Boolean(user)}
              balance={
                user ? (
                  <Suspense
                    fallback={<Skeleton className="h-8 w-24 rounded-pill" />}
                  >
                    <BalanceChip />
                  </Suspense>
                ) : null
              }
            />
            {user ? <DailyBonusClaimer /> : null}
            <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
              {children}
            </main>
          </SignInPromptProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
