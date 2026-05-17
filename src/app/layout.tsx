import type { Metadata } from "next";
import "./globals.css";
import { Topbar } from "@/components/layout/Topbar";

export const metadata: Metadata = {
  title: "SkateDreams",
  description: "Controle de aulas",
};

export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-brand-sky-soft min-h-screen text-brand-ink">
        <Topbar />
        {children}
        {modal}
      </body>
    </html>
  );
}
