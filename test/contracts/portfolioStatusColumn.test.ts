import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

describe("portfolio status column", () => {
  it("reads the position label instead of the unrelated closed-trades status", () => {
    const code = readFileSync(resolve(process.cwd(), "apps-script/Код.js"), "utf8");
    const context = vm.createContext({ console }) as Record<string, (...args: unknown[]) => unknown>;
    vm.runInContext(code, context);

    const columns = context.getPortfolioColumns([
      "Актив", "Категория", "Количество", "Средняя входа", "Вложено",
      "Текущая цена", "Текущая стоимость", "PnL $", "PnL %", "Доля %",
      "Метка", "Показатель", "Значение", "", "asset", "status",
    ]) as { status: number };

    expect(columns.status).toBe(10);
    expect(context.normalizePortfolioStatus("GOLD", "Металлы", "Hedge", 0.005686, 20, 24.7))
      .toBe("Hedge");
  });

  it("keeps the exact XAUT quantity even when the sheet displays five decimals", () => {
    const code = readFileSync(resolve(process.cwd(), "apps-script/Код.js"), "utf8");
    const context = vm.createContext({ console }) as Record<string, (...args: unknown[]) => unknown>;
    vm.runInContext(code, context);
    const headers = [
      "Актив", "Категория", "Количество", "Средняя входа", "Вложено",
      "Текущая цена", "Текущая стоимость", "PnL $", "PnL %", "Доля %", "Метка",
    ];
    const gold = [
      "GOLD", "Металлы", "0,00569", "3517,41", "20,00", "4345,35",
      "24,71", "4,71", "23,54%", "3,48%", "Hedge",
    ];
    const sheet = {
      getLastRow: () => 2,
      getLastColumn: () => headers.length,
      getRange: (row: number, column: number) => ({
        getDisplayValues: () => row === 1 ? [headers] : [gold],
        getValues: () => column === 3 ? [[0.005686]] : [],
      }),
    };

    const portfolio = context.getPortfolio(sheet) as Array<{ asset: string; quantity: number; status: string }>;

    expect(portfolio[0]).toMatchObject({ asset: "GOLD", quantity: 0.005686, status: "Hedge" });
  });
});
