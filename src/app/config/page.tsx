import { requireSession } from "@/lib/auth/guards";
import { getConnection } from "@/lib/google/connection";
import { startGoogleOAuth, disconnectGoogle, logoutAction } from "./actions";

export default async function ConfigPage() {
  await requireSession();
  const conn = await getConnection();

  return (
    <main className="max-w-2xl mx-auto p-8 space-y-8">
      <h1 className="text-3xl font-bold">Configurações</h1>

      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="text-xl font-semibold">Google Calendar</h2>
        {conn ? (
          <>
            <p className="text-sm text-neutral-600">
              Conectado como <strong>{conn.googleEmail}</strong>.
            </p>
            <p className="text-sm text-neutral-600">
              Última sync:{" "}
              {conn.lastSyncAt
                ? new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(conn.lastSyncAt)
                : "ainda não"}
            </p>
            <form action={disconnectGoogle}>
              <button className="bg-red-600 text-white px-4 py-2 rounded">Desconectar</button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-neutral-600">Nenhuma conta Google conectada.</p>
            <form action={startGoogleOAuth}>
              <button className="bg-blue-600 text-white px-4 py-2 rounded">
                Conectar Google Calendar
              </button>
            </form>
          </>
        )}
      </section>

      <section className="border rounded-lg p-4">
        <form action={logoutAction}>
          <button className="text-red-600 underline">Sair</button>
        </form>
      </section>
    </main>
  );
}
