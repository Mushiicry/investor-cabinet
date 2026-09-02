import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("manual signal limit levels", () => {
  it("wires the site action through proxy and Apps Script", () => {
    const api = read("src/api/signalLimitLevels.ts");
    const proxy = read("api/_investorProxy.js");
    const mainScript = read("apps-script/Код.js");
    const signalScript = read("apps-script/signalPriceAlerts.gs");

    expect(api).toContain('url.searchParams.set("action", "createSignalLimitLevel")');
    expect(api).toContain('url.searchParams.set("action", "deleteSignalLimitLevel")');
    expect(proxy).toContain('"createSignalLimitLevel"');
    expect(proxy).toContain('"deleteSignalLimitLevel"');
    expect(proxy).toContain("if (allowedPostActions.has(action))");
    expect(proxy).toContain('upstreamUrl.searchParams.set("action", action)');
    expect(mainScript).toContain('action === "createSignalLimitLevel"');
    expect(mainScript).toContain('action === "deleteSignalLimitLevel"');
    expect(mainScript).toContain("IC_SIGNAL_ALERT_handleCreateLimitLevel_(ss, e)");
    expect(mainScript).toContain("IC_SIGNAL_ALERT_handleDeleteLimitLevel_(ss, e)");
    expect(signalScript).toContain("function IC_SIGNAL_ALERT_handleCreateLimitLevel_");
    expect(signalScript).toContain("function IC_SIGNAL_ALERT_handleDeleteLimitLevel_");
  });

  it("handles Apps Script POST redirects without replaying the form POST", () => {
    const proxy = read("api/_investorProxy.js");

    expect(proxy).toContain("async function fetchInvestorPostUpstream");
    expect(proxy).toContain('redirect: "manual"');
    expect(proxy).toContain('method: "GET"');
    expect(proxy).toContain("await redirected.text()");
  });

  it("keeps manual levels alert-only and pending for Telegram processing", () => {
    const signalScript = read("apps-script/signalPriceAlerts.gs");
    const page = read("src/v2/components/V2SignalsPage.tsx");

    expect(signalScript).toContain("'PENDING'");
    expect(signalScript).toContain("sheet.getRange(sheet.getLastRow() + 1, 1, 1, 12).setValues([row])");
    expect(page).toContain("Это не сделка и не приказ бирже");
    expect(page).toContain("Сохранить напоминание");
    expect(page).toContain("Кабинет не отправляет ордер на Hyperliquid");
    expect(page).toContain("createSignalLimitLevel");
    expect(page).not.toContain("Выставить и ждать");
  });

  it("deletes manual limit levels by exact sheet id", () => {
    const signalScript = read("apps-script/signalPriceAlerts.gs");
    const mainScript = read("apps-script/Код.js");
    const page = read("src/v2/components/V2SignalsPage.tsx");

    expect(signalScript).toContain("payload.signalId");
    expect(signalScript).toContain("'CANCELLED'");
    expect(signalScript).toContain("archived: true");
    expect(mainScript).toContain('status !== "CANCELLED"');
    expect(mainScript).toContain('telegram !== "CANCELLED"');
    expect(page).toContain("deleteSignalLimitLevel({ signalId: signal.id })");
    expect(page).toContain("Удалить");
    expect(page).toContain("v2-sig-delete-message");
    expect(page).not.toContain("setLimitModalOpen(true);\\n    } finally");
  });

  it("lets the user acknowledge triggered signals without deleting the level", () => {
    const page = read("src/v2/components/V2SignalsPage.tsx");

    expect(page).toContain("ACKNOWLEDGED_SIGNAL_STORAGE_KEY");
    expect(page).toContain("acknowledgeSignal(primaryTriggered.id)");
    expect(page).toContain("openCandidate(primaryTriggered, true)");
    expect(page).toContain("sortBySignalPriority(alertSignals)");
    expect(page).toContain("✓ Принято");
  });
});
