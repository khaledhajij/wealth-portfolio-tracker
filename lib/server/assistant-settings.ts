import "server-only";

export function assistantSettings(env: NodeJS.ProcessEnv = process.env) {
  const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  const model = env.AI_MODEL?.trim();
  // No implicit model/provider/Gateway fallback and no secret returned to clients.
  if (!apiKey || !model) return null;
  return { apiKey, model };
}

export function assistantAvailability() {
  return assistantSettings()
    ? {
        enabled: true,
        message:
          "AI configuration detected; provider availability is checked when you send a question.",
      }
    : {
        enabled: false,
        message:
          "Assistant unavailable: server AI configuration is missing. Set GOOGLE_GENERATIVE_AI_API_KEY and AI_MODEL privately, then restart the application.",
      };
}
