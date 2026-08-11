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
    ],
  },
  healthInput: {
    cashShare: 0.731,
    cryptoShare: 0.225,
    futuresShare: 0.028,
    reserveShare: 0.731,
    portfolioValue: 640,
    investedCapital: 677,
  },
  allocation: [{ name: "Свободные деньги", value: 468, share: 0.731 }],
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
    expect(inputText).toContain('"healthFactor": 66');
    expect(inputText).toContain('"canonicalForVisibleNumbers": true');
    expect(inputText).not.toContain('"spotDeployableCash": 0');
    expect(inputText).not.toContain('"futuresDeployableCash": 0');
    expect(inputText).toContain("Не выполняй новую математику");
    expect(inputText).toContain("Ответ должен заканчиваться полным предложением");
    expect(inputText).toContain("Запреты, blockers");
    expect(inputText).toContain("рекомендация положительная");
    expect(inputText).toContain("futuresFacts");
    expect(inputText).toContain('"knowledgePack"');
    expect(inputText).toContain('"source": "docs/ASSISTANT_KNOWLEDGE_MAIN.md"');
    expect(inputText).toContain("Health Formula");
    expect(serializedOpenAiBody).not.toContain("setMaxLevel");
    expect(serializedOpenAiBody).not.toContain("saveInvestorDNAAnswers");
    expect(openAiBody.tools).toBeUndefined();
  });
});
