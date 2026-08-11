import { readFileSync } from "node:fs";

const KNOWLEDGE_FILE_URL = new URL("../docs/ASSISTANT_KNOWLEDGE_MAIN.md", import.meta.url);
const MAX_KNOWLEDGE_CHARS = 8500;

const FALLBACK_KNOWLEDGE = `# Investor Cabinet Assistant Knowledge - Main

## Core
Risk first. Discipline first. PnL second. Investor Cabinet protects capital, discipline, reserve, limits, and decision quality.

## Source Priority
Use uiSnapshot Health Factor for visible screen health when present. Google Sheets and Apps Script API are accounting source of truth. overview.health and risk.health may be legacy.

## Health Formula
Health Factor = weighted score of Reserve 18%, Survival 18%, Risk control 18%, Concentration 18%, Diversification 14%, Discipline 14%.

## Answer Style
Answer in Russian. Start with conclusion. Do not tell the user to buy or sell. Explain risk, limits, checks, and missing data.`;

const ALWAYS_SECTIONS = ["Core", "Source Priority", "Answer Style"];

const SECTION_KEYWORDS = [
  { section: "Main Strategy", keywords: ["стратег", "лимит", "запрещ", "разреш", "main", "основ"] },
  { section: "Investor Profile", keywords: ["профил", "портрет", "цель", "цели", "горизонт", "мои"] },
  { section: "Health Formula", keywords: ["здоров", "health", "66", "формул", "балл", "score"] },
  { section: "Reserve", keywords: ["резерв", "свобод", "деньг", "кэш", "stable", "стейбл"] },
  { section: "Survival", keywords: ["выживаем", "просад", "шок", "stress", "паден"] },
  { section: "Risk Control", keywords: ["риск", "фьючер", "плеч", "ликвидац", "active", "trading"] },
  { section: "Concentration", keywords: ["концентрац", "актив", "тон", "ton", "eth", "btc", "лимит"] },
  { section: "Diversification", keywords: ["диверсиф", "крипт", "металл", "акци", "класс"] },
  { section: "Discipline", keywords: ["дисциплин", "журнал", "cooldown", "план", "fomo"] },
  { section: "Free Money", keywords: ["свобод", "деньг", "deploy", "доступ", "резерв"] },
  { section: "Pre-Trade Checks", keywords: ["провер", "сделк", "куп", "прод", "действ", "безопас"] },
];

function readKnowledgeFile() {
  try {
    return readFileSync(KNOWLEDGE_FILE_URL, "utf8");
  } catch {
    return FALLBACK_KNOWLEDGE;
  }
}

function parseSections(markdown) {
  const sections = new Map();
  let current = "Intro";
  let buffer = [];

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      sections.set(current, buffer.join("\n").trim());
      current = heading[1];
      buffer = [line];
    } else {
      buffer.push(line);
    }
  }

  sections.set(current, buffer.join("\n").trim());
  return sections;
}

function scoreSections(question) {
  const normalized = String(question || "").toLowerCase();
  return SECTION_KEYWORDS
    .map(({ section, keywords }) => ({
      section,
      score: keywords.reduce((sum, keyword) => sum + (normalized.includes(keyword) ? 1 : 0), 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.section);
}

export function selectAssistantKnowledge(question) {
  const markdown = readKnowledgeFile();
  const sections = parseSections(markdown);
  const selectedNames = [...new Set([...ALWAYS_SECTIONS, ...scoreSections(question)])];
  const selectedSections = selectedNames
    .map((name) => sections.get(name))
    .filter(Boolean);
  const text = selectedSections.join("\n\n").slice(0, MAX_KNOWLEDGE_CHARS);

  return {
    source: "docs/ASSISTANT_KNOWLEDGE_MAIN.md",
    mode: "selected-md-sections",
    sections: selectedNames.filter((name) => sections.has(name)),
    text,
  };
}
