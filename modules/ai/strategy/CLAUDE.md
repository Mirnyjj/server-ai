# AI Strategy

`strategy.agent.ts` отвечает за стратегическое планирование контента и действий AI-профиля.

Strategy layer анализирует доступный profile context, memory/knowledge и текущие данные, после чего формирует структурированную стратегию/план.

Strategy не должна напрямую публиковать Instagram content. Она передаёт результат в plan/pipeline слои.

При изменении strategy schema обновлять consumer, Telegram agent и queue jobs, которые используют результат.
