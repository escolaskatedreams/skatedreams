// Garante o usuário admin inicial. Rodado pelo entrypoint após as migrations.
// Idempotente via ON CONFLICT (email) DO NOTHING — não sobrescreve senha existente.
//
// JS puro (sem TS/tsx) pra rodar direto com `node` no runner do container,
// fora do bundle do Next, antes do app subir.

const { Client } = require("pg");
const bcrypt = require("bcryptjs");

async function main() {
  const { DATABASE_URL, SEED_EMAIL, SEED_PASSWORD } = process.env;

  if (!DATABASE_URL) {
    console.error("[seed] DATABASE_URL ausente — abortando.");
    process.exit(1);
  }
  if (!SEED_EMAIL || !SEED_PASSWORD) {
    console.warn("[seed] SEED_EMAIL/SEED_PASSWORD ausentes — pulando.");
    return;
  }

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const hash = await bcrypt.hash(SEED_PASSWORD, 12);
    const res = await client.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, 'admin')
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [SEED_EMAIL, hash],
    );
    if (res.rowCount > 0) {
      console.log(`[seed] criado admin ${SEED_EMAIL}`);
    } else {
      console.log(`[seed] admin ${SEED_EMAIL} já existe`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[seed] falhou:", err);
  process.exit(1);
});
