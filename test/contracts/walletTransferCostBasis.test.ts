import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

type Cell = {
  getValue: () => number;
  setValue: (value: number) => void;
  setFormula: (formula: string) => void;
};

function calculationSheet(quantity: number, avgEntry: number) {
  const values = new Map<string, number>([
    ["2:3", quantity],
    ["2:4", avgEntry],
  ]);
  const formulas = new Map<string, string>();

  return {
    values,
    formulas,
    getRange: (row: number, column: number): Cell => ({
      getValue: () => values.get(`${row}:${column}`) ?? 0,
      setValue: (value) => { values.set(`${row}:${column}`, value); },
      setFormula: (formula) => { formulas.set(`${row}:${column}`, formula); },
    }),
  };
}

function loadImporter(file: string, findRowHelper: string) {
  const context = vm.createContext({ console });
  vm.runInContext(read(file), context);
  const importer = context as Record<string, (...args: unknown[]) => unknown>;
  importer[findRowHelper] = () => 2;
  return importer;
}

describe("wallet transfer cost basis", () => {
  it("keeps SOL invested capital unchanged when only the wallet quantity grows", () => {
    const sheet = calculationSheet(0.35, 100);
    const context = loadImporter("apps-script/solanaWalletImport.gs", "IC_SOLANA_findAssetRow_");

    context.IC_SOLANA_setCalculationQuantity_(sheet, "SOL", 0.49);

    expect(sheet.values.get("2:3")).toBe(0.49);
    expect(sheet.values.get("2:4")! * sheet.values.get("2:3")!).toBeCloseTo(35, 10);
    expect(sheet.formulas.get("2:5")).toBe("=C2*D2");
  });

  it("keeps ETH invested capital unchanged when an unpaired transfer arrives", () => {
    const sheet = calculationSheet(0.015, 35 / 0.015);
    const context = loadImporter("apps-script/arbitrumWalletImport.gs", "IC_EVM_findAssetRow_");

    context.IC_EVM_setCalculationQuantity_(sheet, "ETH", 0.02);

    expect(sheet.values.get("2:3")).toBe(0.02);
    expect(sheet.values.get("2:4")! * sheet.values.get("2:3")!).toBeCloseTo(35, 10);
    expect(sheet.formulas.get("2:5")).toBe("=C2*D2");
  });
});
