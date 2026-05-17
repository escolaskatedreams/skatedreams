"use client";

import { useActionState } from "react";
import Image from "next/image";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, null);

  return (
    <main className="min-h-screen grid lg:grid-cols-2 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full bg-brand-primary/10 blur-3xl pointer-events-none"
      />
      <div
        aria-hidden
        className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-brand-sky/60 blur-3xl pointer-events-none"
      />

      <section className="hidden lg:flex flex-col justify-between p-12 bg-cloud-gradient relative">
        <div className="flex items-center gap-3">
          <Image
            src="/skatedreams-logo.jpg"
            alt=""
            width={48}
            height={48}
            className="rounded-2xl object-cover shadow-soft-md"
          />
          <span className="font-display text-2xl text-brand-ink tracking-tight">
            skate<span className="text-brand-primary">dreams</span>
          </span>
        </div>

        <div className="space-y-6 max-w-md animate-fade-in-up">
          <h1 className="font-display text-5xl xl:text-6xl leading-none text-brand-ink">
            Cada aula é um <span className="text-brand-primary">novo voo</span>.
          </h1>
          <p className="text-brand-muted text-lg font-body">
            Sistema interno para acompanhar aulas, marcar flags e cuidar do que importa
            na pista — segura e divertida.
          </p>
        </div>

        <p className="text-xs text-brand-muted/70">
          escola skate dreams · chácara santo antônio · são paulo
        </p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <form
          action={formAction}
          className="w-full max-w-sm space-y-5 bg-brand-cloud rounded-3xl shadow-soft-xl p-8 ring-1 ring-brand-ink/5 relative z-10"
        >
          <div className="lg:hidden flex items-center gap-3 mb-2">
            <Image
              src="/skatedreams-logo.jpg"
              alt=""
              width={40}
              height={40}
              className="rounded-xl object-cover shadow-soft"
            />
            <span className="font-display text-xl text-brand-ink">
              skate<span className="text-brand-primary">dreams</span>
            </span>
          </div>

          <div>
            <h2 className="font-display text-2xl text-brand-ink">Entrar</h2>
            <p className="text-sm text-brand-muted mt-1">acesso interno</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-brand-ink mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                className="w-full bg-brand-sky-soft border-0 rounded-xl px-4 py-3 font-body focus:ring-2 focus:ring-brand-primary focus:bg-brand-cloud transition-all outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-brand-ink mb-1.5 uppercase tracking-wider">
                Senha
              </label>
              <input
                name="password"
                type="password"
                required
                className="w-full bg-brand-sky-soft border-0 rounded-xl px-4 py-3 font-body focus:ring-2 focus:ring-brand-primary focus:bg-brand-cloud transition-all outline-none"
              />
            </div>
          </div>

          {state?.error && (
            <p className="text-brand-danger text-sm font-medium bg-brand-danger/10 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

          <button className="w-full bg-brand-primary text-brand-cloud rounded-xl py-3.5 font-semibold tracking-wide hover:bg-brand-primary-strong shadow-glow transition-all active:animate-scale-press">
            Entrar
          </button>
        </form>
      </section>
    </main>
  );
}
