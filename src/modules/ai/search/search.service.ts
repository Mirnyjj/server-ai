import { env } from "../../../config/env.js";

export type WebSearchResult = {
  title: string;
  url: string;
  description: string;
  source?: string;
};

type SearxngSearchResponse = {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    engine?: string;
  }>;
};

export async function searchWeb(
  query: string,
  options: {
    limit?: number;
    language?: string;
    timeRange?: "day" | "month" | "year";
  } = {},
): Promise<WebSearchResult[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    throw new Error("Поисковый запрос не может быть пустым");
  }

  const url = new URL("/search", env.SEARXNG_BASE_URL);
  url.searchParams.set("q", normalizedQuery.slice(0, 600));
  url.searchParams.set("format", "json");
  url.searchParams.set("language", options.language ?? "ru");
  url.searchParams.set("safesearch", "1");

  if (options.timeRange) {
    url.searchParams.set("time_range", options.timeRange);
  }

  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `SearXNG search error ${response.status}: ${body.slice(0, 500)}`,
    );
  }

  const data = (await response.json()) as SearxngSearchResponse;

  return (data.results ?? [])
    .map((item) => ({
      title: item.title?.trim() ?? "",
      url: item.url?.trim() ?? "",
      description: item.content?.trim() ?? "",
      source: item.engine?.trim(),
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
