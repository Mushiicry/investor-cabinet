import { afterEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import assistantHandler from "../../api/assistant.js";

type MockResponse = ServerResponse & {
  body?: string;
  headers: Record<string, string | number | readonly string[]>;
};

type MockRequest = IncomingMessage & {
  body?: unknown;
};

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

const mockReq = (body: unknown = {}, method = "POST"): MockRequest => ({
  method,
  url: "/api/assistant",
  headers: { "content-type": "application/json" },
  body,
  [Symbol.asyncIterator]: async function* () {},
}) as MockRequest;

const mockRes = (): MockResponse => ({
  statusCode: 200,
  headers: {},
  setHeader(name: string, value: string | number | readonly string[]) {
    this.headers[name.toLowerCase()] = value;
    return this;
  },
  end(chunk?: unknown) {
    this.body = typeof chunk === "string" ? chunk : "";
    return this;
  },
}) as MockResponse;

const setEnv = () => {
  process.env.OPENAI_API_KEY = "test-openai-key";
  process.env.OPENAI_ASSISTANT_MODEL = "test-risk-model";
  process.env.INVESTOR_APPS_SCRIPT_URL = "https://apps-script.example/main";
};

const clientContext = {
  accountId: "main",
  renderedAt: "2026-08-11T14:51:42.000Z",
  currentPage: {
    id: "reports",
    label: "Отчёты",
    purpose: "История портфеля, журнал решений, история сделок и поведенческая дисциплина.",
    visibleBlocks: ["Сводка периода", "История портфеля", "Журнал решений", "История сделок", "Поведение"],
    facts: {
      historySummary: {
        points: 47,
        latest: { date: "2026-08-12T23:48:00.000Z", portfolioValue: 795.3, reserve: 620.34 },
      },
      behavior: {
        score: 100,
        status: "НОРМА",
        stats: { decisions24h: 0, blocked24h: 0 },
      },
    },
  },
  portfolio: {
    totalPortfolioValue: 640,
    totalInvested: 677,
    pnlUsd: -37,
    pnlPct: -0.05465,
    stableReserve: 468,
    reserveShare: 0.731,
    positionsCount: 7,
    healthFactor: 66,
    healthStatus: "BALANCED",
    riskLevel: "Удовлетворительно",
    deployableCapital: 468,
    spotDeployable: 120,
    futuresDeployable: 0,
  },
  health: {
    healthFactor: 66,
    status: "BALANCED",
    riskLevel: "Удовлетворительно",
    components: [
      {
        key: "reserve",
        v2Key: "reserve",
        label: "Резерв",
        score: 76,
        weight: 0.18,
        desc: "Резервный коридор",
        meta: {
          reserveFormula: ["Текущий резерв: 73%", "Цель: 30%"],
        },
      },
      {
        key: "diversification",
        v2Key: "diversification",
        label: "Диверсификация",
        score: 25,
        weight: 0.14,
        desc: "Спотовые рисковые классы",
        meta: {
          diversificationWarnings: ["Крупнейший класс выше 80% рисковой части"],
        },
      },
      {
        key: "futures",
        v2Key: "riskControl",
        label: "Контроль риска",
        score: 59,
        weight: 0.15,
        desc: "Активная торговля",
        meta: {
          futuresCapUsd: 67.7,
          futuresUsedUsd: 91.67,
          futuresRemainingUsd: 0,
          futuresBreachUsd: 23.97,
          futuresCapUtilization: 1.354,
          riskControlBlockers: ["Превышен лимит 10% активной торговли"],
        },
      },
    ],
  },
  healthInput: {
    cashShare: 0.731,
    cryptoShare: 0.225,
    futuresShare: 0.028,
    reserveShare: 0.731,
    portfolioValue: 640,
    investedCapital: 677,
    futuresDeployableUsd: 71.42,
  },
  allocation: [{ name: "Свободные деньги", value: 468, share: 0.731 }],
};

const overviewClientContext = {
  ...clientContext,
  currentPage: {
    id: "overview",
    label: "Обзор",
    purpose: "Главный экран состояния портфеля: капитал, резерв, здоровье, распределение, DCA и ключевые рекомендации.",
    visibleBlocks: ["Верхние метрики", "Здоровье портфеля", "Лестница капитала", "Распределение средств", "Стратегия DCA", "Рекомендации"],
    facts: {
      visibleHealthComponents: [
        {
          key: "reserve",
          label: "Резерв",
          score: 79,
          weight: 0.2,
          desc: "Резерв выше целевого коридора",
          blockers: [],
          warnings: ["Часть капитала простаивает"],
        },
        {
          key: "riskControl",
          label: "Контроль риска",
          score: 60,
          weight: 0.15,
          desc: "Превышен лимит 10% активной торговли",
          blockers: ["Превышен лимит 10% активной торговли"],
          warnings: [],
        },
      ],
      recommendations: [
        {
          level: 6,
          title: "Не добавлять новый риск",
          detail: "превышен лимит 10% активной торговли",
          action: "Сначала устранить блокировку контроля риска",
        },
      ],
    },
  },
};

const portfolioStakingClientContext = {
  ...clientContext,
  currentPage: {
    id: "portfolio",
    label: "Портфель",
    purpose: "Текущие позиции, доли, PnL, статусы активов и соответствие лимитам стратегии.",
    visibleBlocks: ["Позиции", "Активы", "PnL", "Стейкинг"],
    facts: {
      visibleInvestmentPositions: [
        {
          asset: "TON",
          category: "Крипта",
          value: 81.8,
          share: 0.1268,
          staking: {
            isStaked: true,
            label: "в стейке",
            source: "Tonstakers / tsTON",
            stakedAsset: "TON",
            stakedValueUsd: 81.8,
            dailyIncomeUsd: 0.01,
          },
        },
        {
          asset: "ATOM",
          category: "Крипта",
          value: 30.5,
          share: 0.047,
          staking: {
            isStaked: true,
            label: "в стейке",
            source: "Cosmos Hub / Keplr",
            stakedAsset: "ATOM",
            stakedValueUsd: 30.5,
            dailyIncomeUsd: 0.01,
          },
        },
        {
          asset: "BNB",
          category: "Крипта",
          value: 13.2,
          share: 0.0206,
          staking: { isStaked: false },
        },
      ],
    },
  },
};

const portfolioReportClientContext = {
  ...clientContext,
  currentPage: {
    id: "portfolio",
    label: "Портфель",
    purpose: "Текущие позиции, доли, PnL, статусы активов и соответствие лимитам стратегии.",
    visibleBlocks: ["Позиции", "Активы", "PnL", "Стейкинг"],
    facts: {
      portfolioValue: 667.8,
      invested: 698.9,
      pnlUsd: -31.1,
      pnlPct: -0.0445,
      reserveUsd: 473.34,
      reserveShare: 0.709,
      positionsCount: 9,
      dailyPnl: {
        source: "V2PortfolioPage visible P&L 24H formula",
        isAvailable: true,
        pnlUsd: 1.2,
        pnlPct: 0.18,
        previousSnapshotDate: "2026-08-18T23:48:00.000Z",
        previousPortfolioValue: 666.6,
        rule: "Это дневное изменение к предыдущему дневному снимку; не путать с общим P&L.",
      },
      fearGreed: {
        source: "fearGreedStrategy",
        currentIndex: 31,
        mode: "observation",
        currentZone: "Наблюдаем",
        marketMood: "Осторожный оптимизм",
      },
      visibleInvestmentPositions: [
        { asset: "TON", category: "Крипта", value: 86.25, invested: 105.7, share: 12.92, pnl: -19.44, pnlPct: -18.39 },
        { asset: "ATOM", category: "Крипта", value: 29.48, invested: 40.5, share: 4.41, pnl: -10.99, pnlPct: -27.16 },
        { asset: "BNB", category: "Крипта", value: 13.04, invested: 12.54, share: 1.95, pnl: 0.5, pnlPct: 4.02 },
      ],
      cashAndReserveRows: [
        { asset: "USDC", value: 250.1, share: 37.45, role: "резерв/стейбл для спота или общего резерва; не считать инвестиционным активом" },
        { asset: "USDC HL", value: 90, share: 13.48, role: "свободная HL-маржа для фьючерсов; не считать обычным спот-активом" },
      ],
    },
  },
  portfolio: {
    ...clientContext.portfolio,
    totalPortfolioValue: 667.8,
    totalInvested: 698.9,
    pnlUsd: -31.1,
    pnlPct: -0.0445,
    stableReserve: 473.34,
    reserveShare: 0.709,
    positionsCount: 9,
    healthFactor: 66,
    riskLevel: "Баланс",
  },
};

const healthPageClientContext = {
  ...clientContext,
  currentPage: {
    id: "health",
    label: "Здоровье",
    purpose: "Подробная расшифровка здоровья портфеля: общий показатель, компоненты, веса, блокировки, предупреждения и правила стратегии.",
    visibleBlocks: ["Показатель здоровья", "Компоненты здоровья", "Формулы", "Блокировки", "Предупреждения"],
    facts: {
      pageGuide: {
        source: "V2HealthPage visible structure",
        purpose: "Вкладка «Здоровье» объясняет, почему портфель находится в текущем состоянии, какие правила стратегии действуют и что нужно проверить перед любым новым риском.",
        answerRule: "Если пользователь спрашивает про вкладку/страницу «Здоровье», сначала объясняй назначение страницы и видимые разделы.",
        visibleSections: [
          { title: "Оценка здоровья инвестора", meaning: "общий показатель здоровья портфеля и текущий диагноз" },
          { title: "Инвестиционная стратегия", meaning: "базовая структура 60/10/10/10/10, лимиты классов и лимиты внутри крипто-блока" },
          { title: "ДНК инвестора", meaning: "что подходит пользователю как типу инвестора, отдельно от стратегии портфеля" },
          { title: "Симулятор здоровья", meaning: "гипотетическая проверка сценария, сделки не выполняет" },
        ],
      },
      visibleHealthComponents: [
        { key: "reserve", label: "Резерв", score: 79, weight: 0.2, desc: "Резерв выше целевого коридора" },
        { key: "riskControl", label: "Контроль риска", score: 60, weight: 0.15, desc: "Превышен лимит 10% активной торговли" },
      ],
    },
  },
};

describe("assistant serverless endpoint", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns controlled JSON when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const res = mockRes();

    await assistantHandler(mockReq({ question: "Почему здоровье такое?", accountId: "main" }), res);

    expect(res.statusCode).toBe(503);
    expect(res.headers["content-type"]).toBe("application/json; charset=utf-8");
    expect(JSON.parse(res.body ?? "{}")).toMatchObject({
      success: false,
      code: "OPENAI_API_KEY_MISSING",
    });
  });

  it("uses read-only investor context and the OpenAI Responses API", async () => {
    setEnv();
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });

      if (url === "https://apps-script.example/main?accountId=main") {
        return Response.json({
          success: true,
          overview: {
            portfolioValue: 1000,
            invested: 900,
            pnl: 100,
            pnlPct: 0.111111,
            reserve: 300,
            health: 82,
            categories: [{ name: "Свободные деньги", value: 300, share: 0.3 }],
            action: "Не добавлять риск без проверки резерва",
          },
          risk: {
            reserveShare: 0.3,
            futuresShare: 0,
            largestRiskAsset: "ETH",
            largestRiskShare: 0.28,
            deployableCash: 120,
          },
          portfolio: [
            { asset: "ETH", category: "Крипта", invested: 400, currentValue: 460, pnl: 60, pnlPct: 15, share: 46, status: "HOLD" },
            { asset: "USDC", category: "Свободные деньги", invested: 300, currentValue: 300, pnl: 0, pnlPct: 0, share: 30, status: "RESERVE" },
          ],
          decisions: [],
          scenarios: [],
          signals: {},
        });
      }

      if (url === "https://api.openai.com/v1/responses") {
        return Response.json({
          id: "resp_test",
          output_text: "Здоровье высокое, но концентрацию ETH надо держать в лимите.",
        });
      }

      return Response.json({}, { status: 404 });
    }) as typeof fetch;
    const res = mockRes();

    await assistantHandler(mockReq({ question: "Почему здоровье такое?", accountId: "main", clientContext }), res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? "{}")).toMatchObject({
      success: true,
      answer: "Здоровье высокое, но концентрацию ETH надо держать в лимите.",
      accountId: "main",
      source: "/api/investor",
      readOnly: true,
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(calls[0]).toMatchObject({
      url: "https://apps-script.example/main?accountId=main",
      init: { method: "GET" },
    });
    expect(calls[0].init?.body).toBeUndefined();
    expect(calls[1]).toMatchObject({
      url: "https://api.openai.com/v1/responses",
      init: { method: "POST" },
    });

    const openAiBody = JSON.parse(String(calls[1].init?.body ?? "{}"));
    const serializedOpenAiBody = JSON.stringify(openAiBody);
    const inputText = openAiBody.input[0].content[0].text as string;
    expect(openAiBody.model).toBe("test-risk-model");
    expect(openAiBody.store).toBe(false);
    expect(openAiBody.max_output_tokens).toBe(1100);
    expect(inputText).toContain('"readOnly": true');
    expect(inputText).toContain('"source": "/api/investor"');
    expect(inputText).toContain('"uiSnapshot"');
    expect(inputText).toContain('"currentPage"');
    expect(inputText).toContain('"label": "Отчёты"');
    expect(inputText).toContain("История портфеля");
    expect(inputText).toContain("uiSnapshot.currentPage");
    expect(inputText).toContain('"healthFactor": 66');
    expect(inputText).toContain('"canonicalForVisibleNumbers": true');
    expect(inputText).not.toContain('"spotDeployableCash": 0');
    expect(inputText).not.toContain('"futuresDeployableCash": 0');
    expect(inputText).toContain("Не выполняй новую математику");
    expect(inputText).toContain("Ответ должен заканчиваться полным предложением");
    expect(inputText).toContain("Запреты, blockers");
    expect(inputText).toContain("рекомендация положительная");
    expect(inputText).toContain("futuresFacts");
    expect(inputText).toContain("riskBudgetBreakdown");
    expect(inputText).toContain("Это не биржевая маржа");
    expect(inputText).toContain("estimatedOpenFuturesMarginUsd");
    expect(inputText).toContain("Не используй английское слово breakdown");
    expect(inputText).toContain("visibleInvestmentPositions");
    expect(inputText).toContain("cashAndReserveRows");
    expect(inputText).toContain("не как инвестиционные активы");
    expect(inputText).toContain("Отвечай строго на заданный вопрос");
    expect(inputText).toContain("Не добавляй соседние темы");
    expect(inputText).toContain("Для вопроса 'что такое стратегия DCA'");
    expect(inputText).toContain("20-29 покупка на 1%");
    expect(inputText).toContain("15-19 покупка на 1.5%");
    expect(inputText).toContain("Не используй английские служебные слова");
    expect(inputText).toContain('"knowledgePack"');
    expect(inputText).toContain('"source": "docs/ASSISTANT_KNOWLEDGE_MAIN.md"');
    expect(inputText).toContain("Health Formula");
    expect(serializedOpenAiBody).not.toContain("setMaxLevel");
    expect(serializedOpenAiBody).not.toContain("saveInvestorDNAAnswers");
    expect(openAiBody.tools).toBeUndefined();
  });

  it("focuses visible overview recommendation questions on visible cards only", async () => {
    setEnv();
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });

      if (url === "https://apps-script.example/main?accountId=main") {
        return Response.json({
          success: true,
          overview: { portfolioValue: 1000, invested: 900, health: 67 },
          risk: {},
          portfolio: [
            { asset: "TON", category: "Крипта", currentValue: 120, share: 0.12 },
          ],
          decisions: [],
          scenarios: [{ asset: "ATOM", actionZone: "Точка сработала" }],
          signals: { interest: { action: "Проверить ценовую точку" } },
        });
      }

      if (url === "https://api.openai.com/v1/responses") {
        return Response.json({ id: "resp_test", output_text: "Это видимые risk-first рекомендации." });
      }

      return Response.json({}, { status: 404 });
    }) as typeof fetch;

    const res = mockRes();
    await assistantHandler(mockReq({
      question: "что означают рекомендации справа от радара здоровье портфеля?",
      accountId: "main",
      clientContext: overviewClientContext,
    }), res);

    expect(res.statusCode).toBe(200);
    const openAiBody = JSON.parse(String(calls[1].init?.body ?? "{}"));
    const inputText = openAiBody.input[0].content[0].text as string;

    expect(inputText).toContain('"type": "visible_overview_recommendations"');
    expect(inputText).toContain("Отвечай только по uiSnapshot.currentPage.facts.recommendations");
    expect(inputText).toContain("Не подтягивай ценовые точки");
    expect(inputText).toContain("Не объясняй 'точка сработала' как ценовой сигнал");
    expect(inputText).toContain("title = что сделать/не делать");
    expect(inputText).toContain("Это не приказ и не автоматическое действие");
  });

  it("focuses staking questions on visible staked positions", async () => {
    setEnv();
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });

      if (url === "https://apps-script.example/main?accountId=main") {
        return Response.json({
          success: true,
          overview: { portfolioValue: 1000, invested: 900, health: 67 },
          risk: {},
          portfolio: [
            { asset: "TON", category: "Крипта", currentValue: 120, share: 0.12, status: "CLOSED" },
            { asset: "ATOM", category: "Крипта", currentValue: 40, share: 0.04, status: "EXITED" },
            { asset: "BNB", category: "Крипта", currentValue: 20, share: 0.02, status: "HOLD" },
          ],
          decisions: [],
          scenarios: [],
          signals: {},
        });
      }

      if (url === "https://api.openai.com/v1/responses") {
        return Response.json({ id: "resp_test", output_text: "В стейкинге вижу TON и ATOM." });
      }

      return Response.json({}, { status: 404 });
    }) as typeof fetch;

    const res = mockRes();
    await assistantHandler(mockReq({
      question: "какие монеты я держу в стейкинге?",
      accountId: "main",
      clientContext: portfolioStakingClientContext,
    }), res);

    expect(res.statusCode).toBe(200);
    const openAiBody = JSON.parse(String(calls[1].init?.body ?? "{}"));
    const inputText = openAiBody.input[0].content[0].text as string;

    expect(inputText).toContain('"type": "visible_portfolio_staking"');
    expect(inputText).toContain("visibleInvestmentPositions[].staking");
    expect(inputText).toContain('"isStaked": true');
    expect(inputText).toContain('"asset": "TON"');
    expect(inputText).toContain('"asset": "ATOM"');
    expect(inputText).toContain("Не отвечай, что данных нет");
    expect(inputText).toContain("не писать, что данных нет");
    expect(inputText).toContain("Не приплетай статусы позиций");
    expect(inputText).not.toContain('"status": "CLOSED"');
    expect(inputText).not.toContain('"status": "EXITED"');
  });

  it("builds a precise daily portfolio report context from visible portfolio facts", async () => {
    setEnv();
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });

      if (url === "https://apps-script.example/main?accountId=main") {
        return Response.json({
          success: true,
          overview: {
            portfolioValue: 667.8,
            invested: 698.9,
            pnl: -31.1,
            pnlPct: -0.0445,
            reserve: 473.34,
            health: 66,
          },
          risk: {},
          portfolio: [
            { asset: "TON", category: "Крипта", invested: 105.7, currentValue: 86.25, pnl: -19.44, pnlPct: -18.39, share: 12.92 },
            { asset: "USDC", category: "Свободные деньги", invested: 250.1, currentValue: 250.1, pnl: 0, pnlPct: 0, share: 37.45 },
          ],
          decisions: [],
          scenarios: [],
          signals: {},
        });
      }

      if (url === "https://api.openai.com/v1/responses") {
        return Response.json({ id: "resp_test", output_text: "Краткий отчет построен по dailyReport." });
      }

      return Response.json({}, { status: 404 });
    }) as typeof fetch;

    const res = mockRes();
    await assistantHandler(mockReq({
      question: "сделай для меня краткий отчет по моему портфелю сегодня, сколько вложил сколько прибыль или убыток, какие позиции есть и сколько весит каждая в минус или плюс и какой сегодня хелс фактор, и какой индекс страха и жадности сегодня",
      accountId: "main",
      clientContext: portfolioReportClientContext,
    }), res);

    expect(res.statusCode).toBe(200);
    const openAiBody = JSON.parse(String(calls[1].init?.body ?? "{}"));
    const inputText = openAiBody.input[0].content[0].text as string;

    expect(inputText).toContain('"type": "portfolio_daily_report"');
    expect(inputText).toContain('"dailyReport"');
    expect(inputText).toContain('"dailyPnl"');
    expect(inputText).toContain('"pnlUsd": 1.2');
    expect(inputText).toContain('"currentIndex": 31');
    expect(inputText).toContain('"investmentPositions"');
    expect(inputText).toContain('"asset": "TON"');
    expect(inputText).toContain('"sharePct": 12.92');
    expect(inputText).toContain('"cashAndReserveRows"');
    expect(inputText).toContain('"asset": "USDC HL"');
    expect(inputText).toContain('"totalPnlIsDaily": false');
    expect(inputText).toContain("Не называй общий P&L дневным");
    expect(inputText).toContain("Позиции перечисляй только из dailyReport.investmentPositions");
    expect(inputText).toContain("Fear & Greed называй только если dataAvailability.hasFearGreed=true");
  });

  it("focuses detailed health questions on visible health components", async () => {
    setEnv();
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });

      if (url === "https://apps-script.example/main?accountId=main") {
        return Response.json({
          success: true,
          overview: { portfolioValue: 1000, invested: 900, health: 67 },
          risk: {},
          portfolio: [],
          decisions: [{ asset: "TON", nextAction: "старый план" }],
          scenarios: [{ asset: "ATOM", actionZone: "Точка сработала" }],
          signals: { interest: { action: "Проверить ценовую точку" } },
        });
      }

      if (url === "https://api.openai.com/v1/responses") {
        return Response.json({ id: "resp_test", output_text: "Разбор здоровья построен по видимым компонентам." });
      }

      return Response.json({}, { status: 404 });
    }) as typeof fetch;

    const res = mockRes();
    await assistantHandler(mockReq({
      question: "Дай подробный разбор здоровья портфеля по всем компонентам",
      accountId: "main",
      clientContext: overviewClientContext,
    }), res);

    expect(res.statusCode).toBe(200);
    const openAiBody = JSON.parse(String(calls[1].init?.body ?? "{}"));
    const inputText = openAiBody.input[0].content[0].text as string;

    expect(inputText).toContain('"type": "detailed_health_components"');
    expect(inputText).toContain("visibleHealthComponents");
    expect(inputText).toContain('"label": "Резерв"');
    expect(inputText).toContain('"score": 79');
    expect(inputText).toContain('"label": "Контроль риска"');
    expect(inputText).toContain('"score": 60');
    expect(inputText).toContain("Не пересчитывай баллы");
    expect(inputText).toContain("видимые компоненты здоровья");
    expect(inputText).toContain("Формулы — только как переданная расшифровка");
    expect(inputText).not.toContain("Проверить ценовую точку");
    expect(inputText).not.toContain("Точка сработала");
    expect(inputText).not.toContain("старый план");
  });

  it("explains the Health tab as a page when the question asks about the sidebar tab", async () => {
    setEnv();
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });

      if (url === "https://apps-script.example/main?accountId=main") {
        return Response.json({
          success: true,
          overview: { portfolioValue: 1000, invested: 900, health: 67 },
          risk: {},
          portfolio: [],
          decisions: [{ asset: "TON", nextAction: "старый план" }],
          scenarios: [{ asset: "ATOM", actionZone: "Точка сработала" }],
          signals: { interest: { action: "Проверить ценовую точку" } },
        });
      }

      if (url === "https://api.openai.com/v1/responses") {
        return Response.json({ id: "resp_test", output_text: "Вкладка Здоровье объясняет состояние портфеля и правила риска." });
      }

      return Response.json({}, { status: 404 });
    }) as typeof fetch;

    const res = mockRes();
    await assistantHandler(mockReq({
      question: "что расскажешь по страницу здоровье 3 вкладка в сайдбаре?",
      accountId: "main",
      clientContext: healthPageClientContext,
    }), res);

    expect(res.statusCode).toBe(200);
    const openAiBody = JSON.parse(String(calls[1].init?.body ?? "{}"));
    const inputText = openAiBody.input[0].content[0].text as string;

    expect(inputText).toContain('"type": "health_page_overview"');
    expect(inputText).toContain("Вопрос про назначение вкладки/страницы Здоровье");
    expect(inputText).toContain('"pageGuide"');
    expect(inputText).toContain("Инвестиционная стратегия");
    expect(inputText).toContain("ДНК инвестора");
    expect(inputText).toContain("Симулятор здоровья");
    expect(inputText).toContain("Не делай подробный расчет Health Factor");
    expect(inputText).toContain("Не уходи в подробный расчет всех компонентов");
    expect(inputText).not.toContain('"Health Formula"');
    expect(inputText).not.toContain("Проверить ценовую точку");
    expect(inputText).not.toContain("Точка сработала");
    expect(inputText).not.toContain("старый план");
  });
});
