import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { AuthProvider } from "@/features/auth/components/AuthProvider";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Voicenk",
    template: "%s | Voicenk",
  },
  description:
    "Voicenk is the universal voice messenger. Speak your language and hear every message in yours.",
  applicationName: "Voicenk",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#111111",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
