import { z } from "zod";

const schema = z
  .object({
    DATABASE_URL: z.string().url(),
    ENCRYPTION_KEY: z.string().min(32),
    SESSION_SECRET: z.string().min(32),
    SEED_EMAIL: z.string().email(),
    SEED_PASSWORD: z.string().min(8),
    // Uma das duas formas de prover o service account:
    //  - JSON inteiro em base64 (preferido em produção; cabe numa env var)
    //  - Caminho pra arquivo no disco (preferido em dev local)
    GOOGLE_SERVICE_ACCOUNT_JSON: z.string().min(1).optional(),
    GOOGLE_SERVICE_ACCOUNT_KEY_PATH: z.string().min(1).optional(),
    GOOGLE_CALENDAR_ID: z.string().min(1),
    SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(300000),
    SYNC_WINDOW_PAST_DAYS: z.coerce.number().int().positive().default(90),
    SYNC_WINDOW_FUTURE_DAYS: z.coerce.number().int().positive().default(30),
  })
  .refine(
    (v) => !!(v.GOOGLE_SERVICE_ACCOUNT_JSON || v.GOOGLE_SERVICE_ACCOUNT_KEY_PATH),
    {
      message:
        "Defina GOOGLE_SERVICE_ACCOUNT_JSON (base64) ou GOOGLE_SERVICE_ACCOUNT_KEY_PATH (path).",
      path: ["GOOGLE_SERVICE_ACCOUNT_JSON"],
    },
  );

type Env = z.infer<typeof schema>;

let cached: Env | null = null;

// Durante `next build` o Next avalia módulos pra coletar page data, e várias
// libs (db pool, iron-session) tocam env.X no top-level. Nessa fase, devolvemos
// process.env sem validar — o build não precisa de envs reais. Em runtime
// (entrypoint do container), a validação completa roda no primeiro acesso.
function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

function load(): Env {
  if (cached) return cached;
  if (isBuildPhase()) {
    return process.env as unknown as Env;
  }
  cached = schema.parse(process.env);
  return cached;
}

export const env = new Proxy({} as Env, {
  get(_target, key: string) {
    return load()[key as keyof Env];
  },
});
