const TIME_TOKEN = /^\d{1,2}h(\d{2})?$/i;

function isHourish(token: string): boolean {
  return TIME_TOKEN.test(token);
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Heurística de extração do nome do aluno a partir do título do evento.
 * Padrões cobertos, em ordem de preferência:
 *   - "Nome | id: N"  ← padrão real usado pela SkateDreams hoje (ID externo, ex.: planilha)
 *   - "Aula — Nome — 16h" / "Aula - Nome - 16h"
 *   - "Aula Nome [Sobrenome ...]"
 *   - "Nome — 16h"
 * Retorna null quando nenhum bate ou o resultado seria vazio / um horário / a palavra "Aula".
 */
export function parseStudentName(title: string): string | null {
  if (!title) return null;
  const normalized = clean(title.replace(/[–—]/g, "—"));

  // Padrão SkateDreams: "Nome | id: N"
  const pipeIdMatch = normalized.match(/^(.+?)\s*\|\s*id\s*:\s*\d+\s*$/i);
  if (pipeIdMatch) {
    const name = clean(pipeIdMatch[1]);
    if (name && !isHourish(name) && name.toLowerCase() !== "aula") return name;
  }

  const segmented = normalized.split(/\s+[—-]\s+/).map(clean).filter(Boolean);
  if (segmented.length >= 2) {
    const head = segmented[0].toLowerCase();
    if (head === "aula") {
      const candidate = segmented[1];
      if (candidate && !isHourish(candidate) && candidate.toLowerCase() !== "aula") return candidate;
    } else if (!isHourish(segmented[0]) && segmented.slice(1).every(isHourish)) {
      return segmented[0];
    }
  }

  const m = normalized.match(/^Aula\s+(.+)$/i);
  if (m) {
    const rest = clean(m[1]);
    const firstToken = rest.split(/\s+/)[0];
    if (!isHourish(firstToken) && firstToken.toLowerCase() !== "aula") {
      const nameTokens = rest.split(/\s+/).filter((t) => !isHourish(t));
      const name = nameTokens.join(" ");
      return name || null;
    }
  }

  return null;
}
