import type { Metadata, Viewport } from "next";
import "./globals.css";
import { I18nProvider } from "@/components/I18nProvider";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "ThunderGym — Member & Subscription Tracking",
  description:
    "QR-based gym membership tracking. Scan with your phone, see remaining days instantly, and send WhatsApp reminders in one tap.",
  applicationName: "ThunderGym",
  icons: {
    icon: [
      {
        url:
          "data:image/svg+xml," +
          encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#FFC531"/><path d="M13 3 5.5 13.2A.6.6 0 0 0 6 14h4.2l-.9 6.6a.5.5 0 0 0 .9.36L18 10.8a.6.6 0 0 0-.5-.96h-4.2l.8-6.5a.5.5 0 0 0-.8-.34Z" fill="#1A1200"/></svg>`
          ),
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#07090E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <I18nProvider>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
