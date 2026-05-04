export interface NovadaProxyOptions {
  user?: string;
  pass?: string;
  host?: string;
  port?: string | number;
  apiKey?: string;
  browserWs?: string;
  provider?: string;
}

export interface FetchOptions {
  url: string;
  country?: string;
  city?: string;
  sessionId?: string;
  format?: "raw" | "markdown";
  timeout?: number;
}

export interface BatchFetchOptions {
  urls: string[];
  country?: string;
  sessionId?: string;
  format?: "raw" | "markdown";
  timeout?: number;
  concurrency?: number;
}

export interface SearchOptions {
  query: string;
  engine?: "google";
  num?: number;
  country?: string;
  language?: string;
}

export interface ExtractOptions {
  url: string;
  fields: string[];
  schema?: Record<string, string>;
  country?: string;
  city?: string;
  sessionId?: string;
  timeout?: number;
  renderFallback?: boolean;
}

export interface MapOptions {
  url: string;
  limit?: number;
  includeExternal?: boolean;
  country?: string;
  timeout?: number;
}

export interface CrawlOptions {
  url: string;
  depth?: number;
  limit?: number;
  includeContent?: boolean;
  country?: string;
  timeout?: number;
  format?: "markdown" | "raw";
}

export interface ResearchOptions {
  query: string;
  depth?: "quick" | "standard" | "deep";
  country?: string;
  timeout?: number;
}

export interface RenderOptions {
  url: string;
  format?: "markdown" | "html" | "text";
  waitFor?: string;
  timeout?: number;
}

export interface SessionOptions {
  sessionId: string;
  url: string;
  country?: string;
  city?: string;
  format?: "raw" | "markdown";
  timeout?: number;
  verifySticky?: boolean;
}
