export type AssistantKnowledgePack = {
  source: string
  mode: string
  sections: string[]
  text: string
}

export function selectAssistantKnowledge(question: string, options?: { excludeSections?: string[] }): AssistantKnowledgePack
