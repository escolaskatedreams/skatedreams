import type { Metadata } from "next";
import "./globals.css";
import { Topbar } from "@/components/layout/Topbar";

export const metadata: Metadata = {
  title: "SkateDreams",
  description: "Controle de aulas",
};

// Topbar consulta o DB no SSR. Sem isso, o pre-render estático
// de /_not-found e / tenta conectar no Postgres durante o build.
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-brand-sky-soft bg-atmosphere min-h-screen text-brand-ink font-body antialiased">
        <Topbar />
        {children}
        {modal}
      </body>
    </html>
  );
}
