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
      <body className="bg-neutral-50 min-h-screen">
        <Topbar />
        {children}
        {modal}
      </body>
    </html>
  );
}
