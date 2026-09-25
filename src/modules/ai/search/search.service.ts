import { env } from "../../../config/env.js";

export type WebSearchResult = {
  title: string;
  url: string;
  description: string;
  source?: string;
};

type BraveSearchResponse = {
  web?: {
    results?: Array<{
      title?: string;
      url?: string;
      description?: string;
      profile?: {
        long_name?: string;
      };
    }>;
  };
};

export async function searchWeb(
  query: string,
  options: {
    limit?: number;
    country?: string;
    searchLang?: string;
    freshness?: string;
  } = {},
): Promise<WebSearchResult[]> {
  const apiKey = env.BRAVE_SEARCH_API_KEY;

  if (!apiKey) {
    throw new Error("BRAVE_SEARCH_API_KEY не настроен");
  }

  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    throw new Error("Поисковый запрос не может быть пустым");
  }

  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", normalizedQuery.slice(0, 600));
  url.searchParams.set("count", String(Math.min(options.limit ?? 6, 20)));
  url.searchParams.set("country", options.country ?? "RU");
  url.searchParams.set("search_lang", options.searchLang ?? "ru");

  if (options.freshness) {
    url.searchParams.set("freshness", options.freshness);
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Brave Search API error ${response.status}: ${body.slice(0, 500)}`);
  }

  const data = (await response.json()) as BraveSearchResponse;

  return (data.web?.results ?? [])
    .map((item) => ({
      title: item.title?.trim() ?? "",
      url: item.url?.trim() ?? "",
      description: item.description?.trim() ?? "",
      source: item.profile?.long_name?.trim(),
    }))
    .filter((item) => item.title && item.url)
    .slice(0, Math.min(options.limit ?? 6, 20));
}

export function formatWebSearchContext(results: WebSearchResult[]): string {
  return results
    .map(
      (result, index) =>
        `[${index + 1}] ${result.title}\nURL: ${result.url}\n${result.description}`,
    )
    .join("\n\n");
}
