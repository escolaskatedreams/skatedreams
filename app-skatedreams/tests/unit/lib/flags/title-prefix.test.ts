import { describe, it, expect } from "vitest";
import { stripFlagPrefix, buildTitleWithFlags } from "@/lib/flags/title-prefix";

describe("stripFlagPrefix", () => {
  it("retorna o título original quando não tem prefixo", () => {
    expect(stripFlagPrefix("Carla Beatriz | id: 233")).toBe("Carla Beatriz | id: 233");
  });

  it("remove prefixo de uma flag", () => {
    expect(stripFlagPrefix("❌ Carla Beatriz | id: 233")).toBe("Carla Beatriz | id: 233");
  });

  it("remove prefixo composto", () => {
    expect(stripFlagPrefix("❌ ⏱️ Carla Beatriz | id: 233")).toBe("Carla Beatriz | id: 233");
  });

  it("trata ⏱️⏱️ como token único", () => {
    expect(stripFlagPrefix("⏱️⏱️ Carla")).toBe("Carla");
    expect(stripFlagPrefix("❌ ⏱️⏱️ Carla")).toBe("Carla");
  });

  it("preserva emoji no meio do título", () => {
    expect(stripFlagPrefix("Carla ❌ id: 233")).toBe("Carla ❌ id: 233");
  });
});

describe("buildTitleWithFlags", () => {
  it("retorna título limpo quando não há flags", () => {
    expect(buildTitleWithFlags("Carla", [])).toBe("Carla");
  });

  it("aplica ordem fixa independente da ordem do input", () => {
    expect(buildTitleWithFlags("Carla", ["teacher_late", "student_absent"])).toBe("❌ ⏱️ Carla");
  });

  it("não duplica prefixo quando o título já vem com ele", () => {
    expect(buildTitleWithFlags("❌ Carla", ["teacher_late"])).toBe("⏱️ Carla");
  });

  it("remove prefixo se flags ficarem vazias", () => {
    expect(buildTitleWithFlags("❌ ⏱️ Carla", [])).toBe("Carla");
  });

  it("usa ⏱️⏱️ pra teacher_very_late", () => {
    expect(buildTitleWithFlags("Carla", ["teacher_very_late"])).toBe("⏱️⏱️ Carla");
  });
});
