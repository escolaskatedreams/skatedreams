import { requireSession } from "@/lib/auth/guards";
import { getConnection } from "@/lib/google/connection";
import { getCalendarId } from "@/lib/google/auth";
import { forceSyncAction, logoutAction } from "./actions";

export default async function ConfigPage() {
  await requireSession();
  const conn = await getConnection();
  const calendarId = getCalendarId();

  return (
    <main className="max-w-2xl mx-auto p-8 space-y-8">
      <h1 className="text-3xl font-bold">Configurações</h1>

      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="text-xl font-semibold">Google Calendar</h2>
        <p className="text-sm text-neutral-600">
          Conectado via <strong>service account</strong> ao calendário{" "}
          <code className="bg-neutral-100 px-1 rounded">{calendarId}</code>.
        </p>
        {conn ? (
          <p className="text-sm text-neutral-600">
            Última sincronização:{" "}
            {conn.lastSyncAt
              ? new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(conn.lastSyncAt)
              : "ainda não rodou"}
            .
          </p>
        ) : (
          <p className="text-sm text-neutral-600">
            Aguardando primeira sincronização. Clique no botão abaixo para forçar agora.
          </p>
        )}
        <form action={forceSyncAction}>
          <button className="bg-neutral-900 text-white px-4 py-2 rounded">Sincronizar agora</button>
        </form>
      </section>

      <section className="border rounded-lg p-4">
        <form action={logoutAction}>
          <button className="text-red-600 underline">Sair</button>
        </form>
      </section>
    </main>
  );
}
