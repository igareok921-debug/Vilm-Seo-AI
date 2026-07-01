import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import { I18nProvider } from "@/components/i18n-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { getCurrentAppLocale } from "@/lib/i18n/server";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: {
    default: "VILM SEO AI",
    template: "%s | VILM SEO AI",
  },
  description: "AI-powered SEO platform for monitoring, auditing and growth.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const appLocale = await getCurrentAppLocale();

  return (
    <html lang={appLocale} suppressHydrationWarning>
      <body className={`${inter.variable} ${manrope.variable} font-[var(--font-inter)]`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <I18nProvider initialLocale={appLocale}>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
