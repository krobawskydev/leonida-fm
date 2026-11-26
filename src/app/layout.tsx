import type { Metadata } from "next";
import { projectAuthor } from "@/lib/project-author";
import "./globals.css";

const title = "Leonida FM · Your World. Your Frequency.";
const description = "Sintoniza Leonida Radio y crea tu propia radio con playlists de Spotify y YouTube.";
const deploymentUrl = process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined);

export const metadata: Metadata = {
  metadataBase: new URL(deploymentUrl ?? "http://localhost:3000"),
  title,
  description,
  applicationName: "Leonida FM",
  authors: [projectAuthor],
  openGraph: {
    title,
    description,
    siteName: "Leonida FM",
    type: "website",
    locale: "es_PE",
    images: [{ url: "/social-card.jpg", width: 1200, height: 630, alt: "Leonida FM · Your World. Your Frequency." }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/social-card.jpg"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
