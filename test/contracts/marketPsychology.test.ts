import { describe, expect, it } from "vitest";
import { getMarketPsychology } from "../../src/v2/lib/marketPsychology";

describe("рыночная психология", () => {
  it("эйфория переводит рынок в защиту капитала и блокирует увеличение риска", () => {
    const psychology = getMarketPsychology(92);

    expect(psychology.emotion).toBe("Эйфория");
    expect(psychology.riskMode).toBe("защита_капитала");
    expect(psychology.gate.severity).toBe("block");
  });

  it("жадность не блокирует сама по себе, но требует ручной проверки", () => {
    const psychology = getMarketPsychology(80);

    expect(psychology.emotion).toBe("Жадность");
    expect(psychology.riskMode).toBe("снижать_риск");
    expect(psychology.gate.severity).toBe("warning");
  });

  it("оптимизм 72 даёт прямую рекомендацию пользователю не покупать без плана", () => {
    const psychology = getMarketPsychology(72);

    expect(psychology.emotion).toBe("Оптимизм и возбуждение");
    expect(psychology.stanceLabel).toBe("Не покупать без плана");
    expect(psychology.disciplined).toContain("Не покупай только потому, что рынок растёт");
    expect(psychology.dangerous).toContain("Не догоняй рост");
    expect(psychology.disciplined).not.toContain("Фиксирует прибыль");
    expect(psychology.disciplined).not.toContain("Не покупает");
    expect(psychology.gate.text).toContain("Не покупай просто из-за роста");
    expect(psychology.gate.text).toContain("проверки причины, размера и выживаемости");
  });

  it("рост из страха остаётся зоной планового добора", () => {
    const psychology = getMarketPsychology(18, [
      { value: 8 },
      { value: 9 },
      { value: 10 },
      { value: 11 },
    ]);

    expect(psychology.emotion).toBe("Неверие");
    expect(psychology.riskMode).toBe("покупать_по_плану");
    expect(psychology.gate.severity).toBe("info");
  });
});
