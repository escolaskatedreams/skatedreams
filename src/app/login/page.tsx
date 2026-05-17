"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, null);

  return (
    <main className="min-h-screen grid place-items-center bg-neutral-50 px-4">
      <form action={formAction} className="w-full max-w-sm space-y-4 bg-white p-6 rounded-lg shadow">
        <h1 className="text-2xl font-bold">SkateDreams</h1>
        <p className="text-sm text-neutral-600">Entrar no sistema</p>

        <div>
          <label className="block text-sm mb-1">Email</label>
          <input name="email" type="email" required className="w-full border rounded px-3 py-2" />
        </div>

        <div>
          <label className="block text-sm mb-1">Senha</label>
          <input name="password" type="password" required className="w-full border rounded px-3 py-2" />
        </div>

        {state?.error && <p className="text-red-600 text-sm">{state.error}</p>}

        <button className="w-full bg-neutral-900 text-white py-2 rounded font-medium">Entrar</button>
      </form>
    </main>
  );
}
