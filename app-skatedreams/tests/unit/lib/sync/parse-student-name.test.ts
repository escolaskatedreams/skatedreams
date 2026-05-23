import { describe, it, expect } from "vitest";
import { parseStudentName } from "@/lib/sync/parse-student-name";

describe("parseStudentName", () => {
  it("extrai do padrão real da SkateDreams 'Nome | id: N'", () => {
    expect(parseStudentName("Vivian Buelau | id: 50")).toBe("Vivian Buelau");
    expect(parseStudentName("Anne Caroline | id: 241")).toBe("Anne Caroline");
    expect(parseStudentName("Livia | id: 261")).toBe("Livia");
  });

  it("extrai padrão 'Nome | id: N' tolerante a espaçamento", () => {
    expect(parseStudentName("Pedro|id:7")).toBe("Pedro");
    expect(parseStudentName("Maria Silva  |  id:  99")).toBe("Maria Silva");
  });

  it("extrai do padrão 'Aula — Nome — 16h'", () => {
    expect(parseStudentName("Aula — Joãozinho — 16h")).toBe("Joãozinho");
  });

  it("extrai do padrão 'Aula - Nome - 16h' (hífen ASCII)", () => {
    expect(parseStudentName("Aula - Joãozinho - 16h")).toBe("Joãozinho");
  });

  it("extrai do padrão 'Aula <Nome>'", () => {
    expect(parseStudentName("Aula Maria")).toBe("Maria");
    expect(parseStudentName("Aula Maria Silva")).toBe("Maria Silva");
  });

  it("extrai do padrão '<Nome> — 16h'", () => {
    expect(parseStudentName("Lucas — 16h")).toBe("Lucas");
  });

  it("retorna null quando não bate nenhum padrão", () => {
    expect(parseStudentName("")).toBeNull();
    expect(parseStudentName("Reunião administrativa")).toBeNull();
    expect(parseStudentName("Almoço")).toBeNull();
  });

  it("normaliza espaços extras e trim", () => {
    expect(parseStudentName("Aula —   Pedro   — 14h")).toBe("Pedro");
  });

  it("não pega 'Aula' nem horários como nome", () => {
    expect(parseStudentName("Aula 16h")).toBeNull();
    expect(parseStudentName("16h Aula")).toBeNull();
  });
});
