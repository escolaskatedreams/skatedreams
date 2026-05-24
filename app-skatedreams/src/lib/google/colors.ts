/**
 * Paleta oficial de event colors do Google Calendar.
 * O Google envia colorId numérico (1-11); este é o mapeamento canônico para HEX
 * usado pela própria interface do Google. Mantido em código (a API
 * `calendar.colors.get` retorna isso dinamicamente, mas é estável historicamente).
 *
 * Eventos sem colorId herdam a cor padrão do calendário — usamos Peacock
 * (`#039BE5`) como fallback, que é a cor default do próprio Google Calendar.
 */

export const GOOGLE_EVENT_COLORS: Record<string, { name: string; bg: string; fg: string }> = {
  "1": { name: "Lavender", bg: "#7986CB", fg: "#FFFFFF" },
  "2": { name: "Sage", bg: "#33B679", fg: "#FFFFFF" },
  "3": { name: "Grape", bg: "#8E24AA", fg: "#FFFFFF" },
  "4": { name: "Flamingo", bg: "#E67C73", fg: "#FFFFFF" },
  "5": { name: "Banana", bg: "#F6BF26", fg: "#0F1B3D" },
  "6": { name: "Tangerine", bg: "#F4511E", fg: "#FFFFFF" },
  "7": { name: "Peacock", bg: "#039BE5", fg: "#FFFFFF" },
  "8": { name: "Graphite", bg: "#616161", fg: "#FFFFFF" },
  "9": { name: "Blueberry", bg: "#3F51B5", fg: "#FFFFFF" },
  "10": { name: "Basil", bg: "#0B8043", fg: "#FFFFFF" },
  "11": { name: "Tomato", bg: "#D50000", fg: "#FFFFFF" },
};

export const DEFAULT_EVENT_BG = "#039BE5"; // Peacock (default do Google Calendar)
export const DEFAULT_EVENT_FG = "#FFFFFF";
export const CANCELLED_BG = "#6B7A99"; // brand-muted
export const CANCELLED_FG = "#FFFFFF";

export function colorForEvent(
  colorId: string | null | undefined,
  status: "confirmed" | "cancelled",
): { bg: string; fg: string } {
  if (status === "cancelled") return { bg: CANCELLED_BG, fg: CANCELLED_FG };
  if (colorId && GOOGLE_EVENT_COLORS[colorId]) {
    const c = GOOGLE_EVENT_COLORS[colorId];
    return { bg: c.bg, fg: c.fg };
  }
  return { bg: DEFAULT_EVENT_BG, fg: DEFAULT_EVENT_FG };
}
