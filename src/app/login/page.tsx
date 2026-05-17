"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, null);

  return (
    <main className="min-h-screen grid place-items-center bg-brand-sky px-4">
      <form action={formAction} className="w-full max-w-sm space-y-4 bg-brand-cloud p-6 rounded-lg shadow">
        <div className="flex items-center gap-3 mb-2">
          <img src="/skatedreams-logo.jpg" alt="SkateDreams" className="w-12 h-12 rounded-full" />
          <h1 className="text-2xl font-bold font-display text-brand-ink">SkateDreams</h1>
        </div>
        <p className="text-sm text-brand-muted">Entrar no sistema</p>

        <div>
          <label className="block text-sm mb-1">Email</label>
          <input name="email" type="email" required className="w-full border rounded px-3 py-2" />
        </div>

        <div>
          <label className="block text-sm mb-1">Senha</label>
          <input name="password" type="password" required className="w-full border rounded px-3 py-2" />
        </div>

        {state?.error && <p className="text-red-600 text-sm">{state.error}</p>}

        <button className="w-full bg-brand-primary text-brand-cloud py-2 rounded font-medium hover:bg-brand-primary-strong">Entrar</button>
      </form>
    </main>
  );
}
