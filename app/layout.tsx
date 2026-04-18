import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AnalyticsProvider from "@/components/AnalyticsProvider";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import ToasterProvider from "@/components/ToasterProvider";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { getToken } from "@/lib/auth-server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  applicationName: "QuickShow",
  title: {
    default: "QuickShow | Movie Booking Demo",
    template: "%s | QuickShow",
  },
  description:
    "A modern movie booking demo built with Next.js, Convex, Better Auth, and TMDB. Browse films, save favorites, hold seats, and move through a realistic ticketing flow.",
  keywords: [
    "movie booking",
    "Next.js",
    "Convex",
    "Better Auth",
    "TMDB",
    "ticketing demo",
  ],
  openGraph: {
    type: "website",
    siteName: "QuickShow",
    title: "QuickShow | Movie Booking Demo",
    description:
      "Browse movies, save favorites, hold seats, and explore a production-minded booking demo.",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "QuickShow | Movie Booking Demo",
    description:
      "Browse movies, save favorites, hold seats, and explore a production-minded booking demo.",
  },
  alternates: {
    canonical: "/",
  },
  category: "entertainment",
};

export const viewport = {
  themeColor: "#120909",
  colorScheme: "dark",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const token = await getToken();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-full flex flex-col">
        <ConvexClientProvider initialToken={token}>
          <AnalyticsProvider />
          <ToasterProvider />
          <Navbar />
          {children}
          <Footer />
        </ConvexClientProvider>
      </body>
    </html>
  );
}
