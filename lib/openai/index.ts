export const openAiConfig = {
  model: "gpt-5.4-mini",
  apiKey: process.env.OPENAI_API_KEY,
};

export function isOpenAiConfigured() {
  return Boolean(openAiConfig.apiKey);
}
