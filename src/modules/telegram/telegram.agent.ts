import { runAgentOrchestrator } from "../agents/orchestrator.js";

export async function runTelegramAgent(input: {
  profileId: string;
  request: string;
  onPostGenerated?: (postId: string) => Promise<void>;
}): Promise<string> {
  return runAgentOrchestrator({
    profileId: input.profileId,
    request: input.request,
    onPostGenerated: input.onPostGenerated,
  });
}
