import { ASSISTANT_SYSTEM_PROMPT, buildAssistantContext } from "./_assistantContext.js";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_QUESTION_LENGTH = 1200;
const MAX_BODY_LENGTH = 64_000;

const sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
};

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeErrorMessage = (error) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (!message || message === "fetch failed") {
    return "Assistant upstream temporarily unavailable. Retry the request in a few seconds.";
  }
  return message;
};

async function readBody(req) {
  if (isRecord(req.body)) return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");

  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY_LENGTH) {
      throw new Error("Request body is too large");
    }
  }
  return raw ? JSON.parse(raw) : {};
}

function extractOutputText(responseJson) {
  if (typeof responseJson.output_text === "string" && responseJson.output_text.trim()) {
    return responseJson.output_text.trim();
  }

  const output = Array.isArray(responseJson.output) ? responseJson.output : [];
  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (typeof part.text === "string" && part.text.trim()) return part.text.trim();
      if (typeof part.output_text === "string" && part.output_text.trim()) return part.output_text.trim();
    }
  }

  return "";
}

async function callOpenAI({ apiKey, model, question, context }) {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: ASSISTANT_SYSTEM_PROMPT,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "Вопрос пользователя:",
                question,
                "",
                "Формат ответа:",
                "Ответ должен помещаться в маленькое окно чата.",
                "Обычный ответ: 1200-1800 знаков. Если пользователь просит подробно — до 2600 знаков.",
                "Структура: 1) вывод одной строкой; 2) 4-7 коротких причин с точными цифрами; 3) что проверить дальше.",
                "Отвечай строго на заданный вопрос. Не добавляй соседние темы только потому, что они есть в контексте.",
                "Если вопрос понятийный ('что такое DCA/резерв/лимит'), дай объяснение понятия и максимум 1-2 релевантные цифры. Не пересказывай весь портфель, стейблы, Health Factor, фьючерсы или blockers, если пользователь прямо не спрашивал.",
                "Для вопроса про стратегию DCA обязательно объясни зоны индекса: 30-100 наблюдаем; 20-29 покупка на 1%; 15-19 покупка на 1.5%; 0-14 покупка на 2%. Укажи текущий индекс и текущую зону, если они есть в контексте.",
                "Для вопроса 'что такое стратегия DCA' объясни: что это плановый поэтапный добор, когда используется, чем отличается от ручного спот-добора, и что это не разрешение нарушать проверку риска. Не перечисляй резерв, стейблы, HL-маржу и все блокировки.",
                "Не используй английские служебные слова в русском ответе: cautious, Balanced, risk-gate, blockers, breakdown, status, mode. Замени на русские слова: осторожная зона, баланс, проверка риска, блокировки, расшифровка, статус, режим.",
                "Не упоминай статусы позиций в ответе, если пользователь прямо не спрашивает про статусы.",
                "Не перечисляй все компоненты, если они не нужны для ответа.",
                "Не используй markdown-таблицы.",
                "Не используй markdown-разметку вообще: без **жирного**, без таблиц, без заголовков markdown.",
                "Ответ должен заканчиваться полным предложением. Если места не хватает, сократи список причин, но не обрывай последнюю фразу.",
                "Не выполняй новую математику, если в контексте нет всех исходных полей.",
                "Если актив выше лимита или есть blocker по концентрации, запрещено писать: 'рекомендация положительная', 'есть накопление', 'можно купить', 'можно добрать'. Пиши только: увеличение заблокировано до возврата в лимит.",
                "По фьючерсам называй только явно переданные поля. Если число пришло из Health Formula, подпиши это как расчет health-formula, а не как факт маржи на бирже.",
                "Если видишь конфликт или недостаточную детализацию по фьючерсам, прямо скажи, что точную разбивку нужно сверить в Лестнице капитала или Risk screen.",
                "Не используй английское слово breakdown в русском ответе; говори 'расшифровка' или 'разбивка'.",
                "На вкладке Портфель при вопросе про активы сначала используй visibleInvestmentPositions. cashAndReserveRows называй отдельно как кэш/резерв/HL-маржу, не как инвестиционные активы.",
                "",
                "Read-only контекст кабинета:",
                JSON.stringify(context, null, 2),
              ].join("\n"),
            },
          ],
        },
      ],
      max_output_tokens: 1100,
      store: false,
    }),
  });

  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: json.error?.message ?? "OpenAI API returned an error",
    };
  }

  return {
    ok: true,
    answer: extractOutputText(json),
    responseId: json.id,
  };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { success: false, error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    sendJson(res, 503, {
      success: false,
      code: "OPENAI_API_KEY_MISSING",
      error: "AI помощник пока не подключен: отсутствует server-side OPENAI_API_KEY.",
    });
    return;
  }

  try {
    const body = await readBody(req);
    const question = String(body.question ?? body.message ?? "").trim();
    const accountId = body.accountId === "wife" ? "wife" : "main";

    if (!question) {
      sendJson(res, 400, { success: false, error: "Question is required" });
      return;
    }

    if (question.length > MAX_QUESTION_LENGTH) {
      sendJson(res, 413, { success: false, error: "Question is too long" });
      return;
    }

    const contextResult = await buildAssistantContext(accountId, body.clientContext, question);
    if (!contextResult.ok) {
      sendJson(res, contextResult.status, contextResult.body);
      return;
    }

    const model = process.env.OPENAI_ASSISTANT_MODEL?.trim() || "gpt-5.6-luna";
    const result = await callOpenAI({
      apiKey,
      model,
      question,
      context: contextResult.context,
    });

    if (!result.ok) {
      sendJson(res, 502, {
        success: false,
        error: "OpenAI assistant request failed",
        detail: result.error,
        upstreamStatus: result.status,
      });
      return;
    }

    sendJson(res, 200, {
      success: true,
      answer: result.answer || "Не удалось получить текст ответа. Повтори вопрос позже.",
      accountId: contextResult.accountId,
      model,
      source: contextResult.context.source,
      readOnly: true,
    });
  } catch (error) {
    sendJson(res, 500, {
      success: false,
      error: normalizeErrorMessage(error),
    });
  }
}
