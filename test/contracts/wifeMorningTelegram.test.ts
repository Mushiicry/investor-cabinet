import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe("wife morning Telegram", () => {
  it("keeps the wife recipient, live data and schedule isolated", () => {
    const script = read("apps-script/wifeMorningTelegram.gs");
    const router = read("apps-script/Код.js");

    expect(script).toContain("TELEGRAM_WIFE_CHAT_ID");
    expect(script).toContain("https://investor-cabinet.vercel.app/api/investor-wife");
    expect(script).toContain(".atHour(8)");
    expect(script).toContain(".nearMinute(30)");
    expect(script).toContain("Доброе утро, Полина!");
    expect(script).toContain("За 24 часа: ждём снимок прошлого дня.");
    expect(script).toContain("Здоровье портфеля:");
    expect(script).toContain("Рекомендации:");
    expect(script).toContain("❤️‍🩹");
    expect(script).toContain("🍀");
    expect(script).toContain("By Mushii 💋");
    expect(script).not.toContain("Фьючерсы и импульсивные сделки сегодня не использовать.");
    expect(script).toContain("IC_SIGNAL_ALERT_sendTelegram_");
    expect(router).toContain('action === "testWifeMorningTelegram"');
    expect(router).toContain('action === "setupWifeMorningTelegram"');
  });

  it("calculates the current wife Health Factor instead of reading legacy overview.health", () => {
    const script = read("apps-script/wifeMorningTelegram.gs");
    const context = vm.createContext({
      console,
      Utilities: {
        formatDate: () => "2026-08-20",
      },
    });
    vm.runInContext(script, context);

    const payload = {
      overview: {
        portfolioValue: 8759.59,
        invested: 10188.28,
        pnl: -1428.69,
        pnlPct: -0.140227,
        reserve: 653.28,
        health: 13,
      },
      risk: { reserveShare: 7.46 },
      fearGreedStrategy: { currentIndex: 50 },
      history: [],
      portfolio: [
        { asset: "ETH", category: "Крипта", currentValue: 6867.8, invested: 7465, pnl: -597.2, pnlPct: -8 },
        { asset: "TON", category: "Крипта", currentValue: 824.7, invested: 1672, pnl: -847.3, pnlPct: -50.7 },
        { asset: "BTC", category: "Крипта", currentValue: 108.3, invested: 130, pnl: -21.7, pnlPct: -16.7 },
        { asset: "SOL", category: "Крипта", currentValue: 18.15, invested: 20, pnl: -1.85, pnlPct: -9.3 },
        { asset: "USDT", category: "Кэш / Стейблы", currentValue: 653.28, invested: 653.28, pnl: 0, pnlPct: 0 },
        { asset: "GOLD", category: "Металлы", currentValue: 148.8, invested: 133, pnl: 15.8, pnlPct: 11.9 },
        { asset: "SpaceX", category: "Акции", currentValue: 139.8, invested: 115, pnl: 24.8, pnlPct: 21.5 },
      ],
    };

    const message = context.IC_WIFE_MORNING_buildMessage_(payload, new Date("2026-08-20T05:30:00.000Z"), false);
    expect(message).toContain("Здоровье портфеля: 33/100.");
    expect(message).toContain("ETH: -8,00% / -597,20 $ ❤️‍🩹");
    expect(message).toContain("GOLD: +11,90% / +15,80 $ 🍀");
    expect(message).not.toContain("USDT:");
    expect(message).not.toContain("Тестовое сообщение");
    expect(message).toContain("By Mushii 💋");
  });
});
