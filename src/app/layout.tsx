import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Reesha - Creator Acquisition Workspace",
  description: "Saudi creator acquisition operating system powered by AI. Discover, qualify, contact, and convert Saudi creators into registered platform members.",
  keywords: ["Risha360", "Creator Acquisition", "Saudi Arabia", "AI", "Influencer Marketing", "Next.js", "TypeScript"],
  authors: [{ name: "Risha360 Team" }],
  icons: {
    icon: "/reesha-logo-ar.svg",
  },
  openGraph: {
    title: "Reesha - Creator Acquisition Workspace",
    description: "Discover, qualify, contact, and convert Saudi creators",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Reesha - Creator Acquisition Workspace",
    description: "Discover, qualify, contact, and convert Saudi creators",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
