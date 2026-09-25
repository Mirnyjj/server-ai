import type { AgentRole } from "./agent.types.js";
import type { AgentToolName } from "../../mcp/tools.js";

export const AGENT_TOOL_DESCRIPTIONS: Record<AgentToolName, string> = {
  system_status: "получить состояние системы и счётчики",
  list_profiles: "получить список AI-профилей и подключённых Instagram",
  pending_reviews: "получить комментарии и Direct, требующие решения",
  sync_media: "запустить синхронизацию Instagram публикаций",
  run_pipeline: "создать контент через основной AI pipeline",
  run_plan_slot: "выполнить один слот контент-плана",
  run_strategy: "запустить анализ стратегии и метрик",
  publish_post: "поставить готовую публикацию в очередь Instagram",
  process_comment: "обработать комментарий агентом",
  process_dm: "обработать Direct-сообщение агентом",
  list_references: "получить reference pack персонажа",
  add_reference: "добавить reference персонажа",
  web_search: "найти актуальную информацию в интернете через SearXNG",
};

export const AGENT_TOOLSETS: Record<AgentRole, readonly AgentToolName[]> = {
  platform: [
    "system_status",
    "list_profiles",
    "pending_reviews",
    "sync_media",
    "list_references",
    "add_reference",
  ],
  content: [
    "run_pipeline",
    "run_plan_slot",
    "list_references",
    "add_reference",
    "web_search",
  ],
  analytics: [
    "system_status",
    "list_profiles",
    "run_strategy",
    "web_search",
  ],
  community: [
    "pending_reviews",
    "process_comment",
    "process_dm",
    "web_search",
  ],
};

export const AGENT_ROLE_DESCRIPTIONS: Record<AgentRole, string> = {
  platform:
    "Администратор платформы. Управляет состоянием, профилями, синхронизацией и техническими операциями.",
  content:
    "Контент-агент. Отвечает за контент-план, сценарии, генерацию и подготовку публикаций.",
  analytics:
    "Аналитик. Анализирует стратегию, метрики и внешние данные и формирует выводы для контент-агента.",
  community:
    "Community-агент. Отвечает за комментарии, Direct и эскалацию важных обращений владельцу.",
};

export function isToolAllowed(
  role: AgentRole,
  tool: AgentToolName,
): boolean {
  return AGENT_TOOLSETS[role].includes(tool);
}
