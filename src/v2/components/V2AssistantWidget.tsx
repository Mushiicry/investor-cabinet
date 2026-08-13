import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { InvestorStrategyId } from "../lib/investorStrategy";
import type { HealthInput, PortfolioHealth } from "../../lib/portfolioHealth";
import type { V2Page, V2Portfolio } from "../InvestorCabinetV2Lab";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type Props = {
  accountId: InvestorStrategyId;
  disabled?: boolean;
  uiContext?: {
    currentPage: AssistantPageContext;
    portfolio: V2Portfolio;
    health: PortfolioHealth;
    healthInput: HealthInput;
    allocation: Array<{ name: string; share: number; value: number }>;
  };
};

export type AssistantPageContext = {
  id: V2Page;
  label: string;
  purpose: string;
  visibleBlocks: string[];
  facts: Record<string, unknown>;
};

const starterByAccount: Record<InvestorStrategyId, string> = {
  main: "Могу объяснить здоровье, резерв, лимиты и что сейчас запрещает стратегия.",
  wife: "Могу объяснить портфель Полины, защитные лимиты, резерв и запрет фьючерсов.",
};

function messageId() {
  return `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function starterMessage(accountId: InvestorStrategyId): ChatMessage {
  return {
    id: `assistant-starter-${accountId}`,
    role: "assistant",
    text: starterByAccount[accountId],
  };
}

function chatStorageKey(accountId: InvestorStrategyId) {
  return `investor-cabinet-assistant-chat:${accountId}`;
}

function readStoredMessages(accountId: InvestorStrategyId): ChatMessage[] {
  if (typeof window === "undefined") return [starterMessage(accountId)];

  try {
    const raw = window.localStorage.getItem(chatStorageKey(accountId));
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return [starterMessage(accountId)];

    const messages = parsed.filter((item): item is ChatMessage => (
      Boolean(item)
      && typeof item.id === "string"
      && (item.role === "assistant" || item.role === "user")
      && typeof item.text === "string"
      && item.text.trim().length > 0
    ));

    return messages.length > 0 ? messages.slice(-30) : [starterMessage(accountId)];
  } catch {
    return [starterMessage(accountId)];
  }
}

function assistantErrorText(error: unknown) {
  const text = String(error ?? "").trim();
  if (!text || text === "fetch failed") {
    return "Не удалось связаться с AI endpoint. Проверь, что локальный сервер запущен, и повтори вопрос через несколько секунд.";
  }
  return text;
}

export function V2AssistantWidget({ accountId, disabled = false, uiContext }: Props) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null);
  const storageKey = chatStorageKey(accountId);
  const [messages, setMessages] = useState<ChatMessage[]>(() => readStoredMessages(accountId));
  const trimmedQuestion = question.trim();
  const canSend = !disabled && !loading && trimmedQuestion.length > 0;
  const title = accountId === "wife" ? "AI помощник · Полина" : "AI помощник · Main";
  const quickQuestions = useMemo(
    () => accountId === "wife"
      ? ["Почему фьючерсы запрещены?", "Что мешает здоровью?", "Сколько резерва?"]
      : ["Почему здоровье такое?", "Сколько свободных денег?", "Где главный риск?"],
    [accountId],
  );

  useEffect(() => {
    const node = logRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(messages.slice(-30)));
  }, [messages, storageKey]);

  function clearChat() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
    }
    setMessages([starterMessage(accountId)]);
  }

  async function askAssistant(text: string) {
    const nextQuestion = text.trim();
    if (!nextQuestion || loading || disabled) return;

    const userMessage: ChatMessage = { id: messageId(), role: "user", text: nextQuestion };
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId,
          question: nextQuestion,
          clientContext: uiContext
            ? {
                accountId,
                renderedAt: new Date().toISOString(),
                currentPage: uiContext.currentPage,
                portfolio: uiContext.portfolio,
                health: uiContext.health,
                healthInput: uiContext.healthInput,
                allocation: uiContext.allocation,
              }
            : undefined,
        }),
      });
      const json = await response.json();

      setMessages((current) => [
        ...current,
        {
          id: messageId(),
          role: "assistant",
          text: json.success
            ? String(json.answer ?? "")
            : assistantErrorText(json.error ?? "AI помощник временно недоступен."),
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: messageId(),
          role: "assistant",
          text: assistantErrorText(error instanceof Error ? error.message : error),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const widget = (
    <aside className={`v2-assistant ${open ? "is-open" : ""}`} aria-label="AI помощник Investor Cabinet">
      {!open ? (
        <button
          className="v2-assistant-fab"
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          aria-label="Открыть AI помощника"
          title={disabled ? "Войдите, чтобы открыть AI помощника" : "AI помощник"}
        >
          <span className="v2-assistant-fab-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 6.8A4.2 4.2 0 0 1 9.2 2.6h5.6A4.2 4.2 0 0 1 19 6.8v3.6a4.2 4.2 0 0 1-4.2 4.2h-3.9L6.5 18v-3.7A4.2 4.2 0 0 1 5 10.4V6.8Z" strokeLinejoin="round" />
              <path d="M9 7.6h6M9 10.4h4.2" strokeLinecap="round" />
            </svg>
          </span>
          <span className="v2-assistant-fab-copy">
            <span className="v2-assistant-fab-text">
              <span className="v2-assistant-fab-text-full">AI помощник</span>
              <span className="v2-assistant-fab-text-short">AI</span>
            </span>
            <span className="v2-assistant-fab-status">
              <span aria-hidden="true" />
              онлайн
            </span>
          </span>
        </button>
      ) : (
        <div className="v2-assistant-panel">
          <header className="v2-assistant-head">
            <div>
              <span className="v2-assistant-kicker">READ ONLY</span>
              <strong>{title}</strong>
            </div>
            <div className="v2-assistant-actions">
              <button
                className="v2-assistant-clear"
                type="button"
                onClick={clearChat}
                aria-label="Очистить историю AI помощника"
                title="Очистить историю"
              >
                Очистить
              </button>
              <button
                className="v2-assistant-close"
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Свернуть AI помощника"
                title="Свернуть"
              >
                ×
              </button>
            </div>
          </header>

          <div ref={logRef} className="v2-assistant-log" aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={`v2-assistant-msg is-${message.role}`}>
                {message.text}
              </div>
            ))}
            {loading && <div className="v2-assistant-msg is-assistant">Сверяю портфель и риск-правила...</div>}
          </div>

          <div className="v2-assistant-quick" aria-label="Быстрые вопросы">
            {quickQuestions.map((item) => (
              <button key={item} type="button" onClick={() => void askAssistant(item)} disabled={loading || disabled}>
                {item}
              </button>
            ))}
            <button type="button" onClick={() => void askAssistant("Дай подробный разбор здоровья портфеля по всем компонентам")} disabled={loading || disabled}>
              Подробно
            </button>
          </div>

          <form
            className="v2-assistant-form"
            onSubmit={(event) => {
              event.preventDefault();
              void askAssistant(trimmedQuestion);
            }}
          >
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.shiftKey) return;
                event.preventDefault();
                if (canSend) void askAssistant(trimmedQuestion);
              }}
              placeholder="Спроси про риск, резерв, лимиты..."
              disabled={loading || disabled}
              rows={2}
              maxLength={1200}
            />
            <button type="submit" disabled={!canSend}>
              Ответить
            </button>
          </form>
        </div>
      )}
    </aside>
  );

  return createPortal(widget, document.body);
}
