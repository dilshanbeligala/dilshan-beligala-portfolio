import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./theme.css";
import { ThemeProvider } from "@/components/theme-provider";
import { initializeTheme } from "@/lib/theme";
import { NeuralConstellation } from "@/components/neural-constellation";
import "./professional.css";
import { professionalDescription } from "@/lib/professional-history";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dilshan Beligala | Software Engineer",
  description: professionalDescription,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* The inline bootstrap must run before the browser paints the body. */}
        <script dangerouslySetInnerHTML={{ __html: initializeTheme }} />
      </head>
      <body className="min-h-full flex flex-col"><ThemeProvider />{children}<NeuralConstellation /></body>
    </html>
  );
}
