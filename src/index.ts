#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import Parser from "rss-parser";
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const HOME_DIR = process.env.HOME || process.env.USERPROFILE || "";
const CONFIG_DIR = join(HOME_DIR, ".rss-mcp");
const USER_FEEDS_FILE = join(CONFIG_DIR, "feeds.json");
const BUNDLED_FEEDS_FILE = join(__dirname, "..", "feeds.json");

// Use user config if it exists, otherwise fall back to bundled default
function getFeedsFile(): string {
  if (existsSync(USER_FEEDS_FILE)) {
    return USER_FEEDS_FILE;
  }
  // If bundled feeds.json exists and user config doesn't, copy it as default
  if (existsSync(BUNDLED_FEEDS_FILE)) {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    copyFileSync(BUNDLED_FEEDS_FILE, USER_FEEDS_FILE);
    return USER_FEEDS_FILE;
  }
  // No feeds file anywhere — will create on first save
  return USER_FEEDS_FILE;
}

const FEEDS_FILE = getFeedsFile();

const parser = new Parser();

interface Feed {
  name: string;
  url: string;
  category?: string;
}

interface FeedsConfig {
  categories: string[];
  feeds: Feed[];
}

interface BlogArticle {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  category?: string;
  summary?: string;
}

function loadFeeds(): FeedsConfig {
  try {
    const data = readFileSync(FEEDS_FILE, "utf-8");
    const config = JSON.parse(data);
    if (!config.categories) {
      config.categories = ["seo", "content", "social", "email", "analytics", "crm", "news"];
    }
    return config;
  } catch {
    return {
      categories: ["seo", "content", "social", "email", "analytics", "crm", "news"],
      feeds: []
    };
  }
}

function saveFeeds(config: FeedsConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(FEEDS_FILE, JSON.stringify(config, null, 2));
}

function parseDateRange(range: string): Date {
  const now = new Date();
  const lowerRange = range.toLowerCase();

  if (lowerRange === "today" || lowerRange === "1d") {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
  if (lowerRange === "this_week" || lowerRange === "1w" || lowerRange === "7d") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  if (lowerRange === "this_month" || lowerRange === "1m" || lowerRange === "30d") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const match = lowerRange.match(/^(\d+)d$/);
  if (match) {
    const days = parseInt(match[1], 10);
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
}

function truncateSummary(text: string | undefined, maxLength: number = 200): string {
  if (!text) return "";
  const cleaned = text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.substring(0, maxLength).trim() + "...";
}

async function fetchFeed(feed: Feed, sinceDate?: Date): Promise<BlogArticle[]> {
  try {
    const result = await parser.parseURL(feed.url);
    const articles: BlogArticle[] = [];

    for (const item of result.items) {
      const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();

      if (sinceDate && pubDate < sinceDate) {
        continue;
      }

      const rawSummary = item.contentSnippet || item.content || item.summary || "";

      articles.push({
        title: item.title || "Untitled",
        link: item.link || "",
        pubDate: pubDate.toISOString(),
        source: feed.name,
        category: feed.category,
        summary: truncateSummary(rawSummary),
      });
    }

    return articles;
  } catch (error) {
    console.error(`Error fetching ${feed.name}:`, error);
    return [];
  }
}

function formatArticles(articles: BlogArticle[], showCategory: boolean = true): string {
  return articles
    .map((a) => {
      let line = `- **${a.title}**\n`;
      line += `  Source: ${a.source}`;
      if (showCategory && a.category) {
        line += ` | Category: ${a.category}`;
      }
      line += ` | ${new Date(a.pubDate).toLocaleDateString()}\n`;
      if (a.summary) {
        line += `  ${a.summary}\n`;
      }
      line += `  ${a.link}`;
      return line;
    })
    .join("\n\n");
}

const server = new McpServer({
  name: "rss-feeds",
  version: "2.0.0",
});

// List all categories
server.tool(
  "list_categories",
  "List all available feed categories for organizing content",
  {},
  async () => {
    const config = loadFeeds();
    const categoryList = config.categories.map((c) => `- ${c}`).join("\n");

    return {
      content: [{
        type: "text",
        text: `## Available Categories\n\n${categoryList}\n\nUse these categories when adding feeds or filtering content.`
      }],
    };
  }
);

// List all feeds with categories
server.tool(
  "list_feeds",
  "List all configured RSS feeds with their categories",
  {},
  async () => {
    const config = loadFeeds();

    if (config.feeds.length === 0) {
      return {
        content: [{ type: "text", text: "No feeds configured. Use add_feed to add some!" }],
      };
    }

    const feedList = config.feeds
      .map((f, i) => `${i + 1}. **${f.name}** [${f.category || "uncategorized"}]\n   ${f.url}`)
      .join("\n");

    return {
      content: [{ type: "text", text: `## Configured RSS Feeds\n\n${feedList}` }],
    };
  }
);

// Add feed with category
server.tool(
  "add_feed",
  "Add a new RSS feed with optional category",
  {
    name: z.string().describe("Name for the feed (e.g., 'techcrunch')"),
    url: z.string().url().describe("RSS feed URL"),
    category: z.string().optional().describe("Category: seo, content, social, email, analytics, crm, news"),
  },
  async ({ name, url, category }) => {
    const config = loadFeeds();

    const exists = config.feeds.find(
      (f) => f.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      return {
        content: [{ type: "text", text: `Feed "${name}" already exists. Remove it first to update.` }],
      };
    }

    const newFeed: Feed = {
      name: name.toLowerCase(),
      url,
      category: category?.toLowerCase() || "content"
    };
    config.feeds.push(newFeed);
    saveFeeds(config);

    return {
      content: [{ type: "text", text: `Added feed "${name}" [${newFeed.category}] with URL: ${url}` }],
    };
  }
);

// Remove feed
server.tool(
  "remove_feed",
  "Remove an RSS feed by name",
  {
    name: z.string().describe("Name of the feed to remove"),
  },
  async ({ name }) => {
    const config = loadFeeds();
    const initialLength = config.feeds.length;

    config.feeds = config.feeds.filter(
      (f) => f.name.toLowerCase() !== name.toLowerCase()
    );

    if (config.feeds.length === initialLength) {
      return {
        content: [{ type: "text", text: `Feed "${name}" not found.` }],
      };
    }

    saveFeeds(config);
    return {
      content: [{ type: "text", text: `Removed feed "${name}".` }],
    };
  }
);

// Fetch blogs with limit
server.tool(
  "fetch_blogs",
  "Fetch latest blogs from all feeds with date range and limit",
  {
    range: z
      .string()
      .optional()
      .describe("Date range: '1d', '7d', '1w', '30d', '1m', 'this_week', 'this_month' (default: 7d)"),
    limit: z
      .number()
      .optional()
      .describe("Maximum number of articles to return (default: 20)"),
  },
  async ({ range, limit }) => {
    const config = loadFeeds();
    const maxResults = limit || 20;

    if (config.feeds.length === 0) {
      return {
        content: [{ type: "text", text: "No feeds configured. Use add_feed to add some!" }],
      };
    }

    const sinceDate = parseDateRange(range || "7d");
    const allArticles: BlogArticle[] = [];

    for (const feed of config.feeds) {
      const articles = await fetchFeed(feed, sinceDate);
      allArticles.push(...articles);
    }

    allArticles.sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );

    const limitedArticles = allArticles.slice(0, maxResults);

    if (limitedArticles.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No articles found since ${sinceDate.toLocaleDateString()}.`,
          },
        ],
      };
    }

    const formatted = formatArticles(limitedArticles);

    return {
      content: [
        {
          type: "text",
          text: `## Latest Blog Posts (since ${sinceDate.toLocaleDateString()})\n\nShowing ${limitedArticles.length} of ${allArticles.length} articles:\n\n${formatted}`,
        },
      ],
    };
  }
);

// Fetch by category
server.tool(
  "fetch_by_category",
  "Fetch blogs from a specific category (seo, content, social, email, analytics, crm, news)",
  {
    category: z.string().describe("Category to filter by: seo, content, social, email, analytics, crm, news"),
    range: z
      .string()
      .optional()
      .describe("Date range: '1d', '7d', '1w', '30d', '1m' (default: 7d)"),
    limit: z
      .number()
      .optional()
      .describe("Maximum number of articles to return (default: 20)"),
  },
  async ({ category, range, limit }) => {
    const config = loadFeeds();
    const maxResults = limit || 20;
    const categoryLower = category.toLowerCase();

    const categoryFeeds = config.feeds.filter(
      (f) => f.category?.toLowerCase() === categoryLower
    );

    if (categoryFeeds.length === 0) {
      const available = [...new Set(config.feeds.map((f) => f.category).filter(Boolean))].join(", ");
      return {
        content: [
          {
            type: "text",
            text: `No feeds in category "${category}". Available categories with feeds: ${available || "none"}`,
          },
        ],
      };
    }

    const sinceDate = parseDateRange(range || "7d");
    const allArticles: BlogArticle[] = [];

    for (const feed of categoryFeeds) {
      const articles = await fetchFeed(feed, sinceDate);
      allArticles.push(...articles);
    }

    allArticles.sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );

    const limitedArticles = allArticles.slice(0, maxResults);

    if (limitedArticles.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No ${category} articles found since ${sinceDate.toLocaleDateString()}.`,
          },
        ],
      };
    }

    const formatted = formatArticles(limitedArticles, false);

    return {
      content: [
        {
          type: "text",
          text: `## ${category.toUpperCase()} Blog Posts (since ${sinceDate.toLocaleDateString()})\n\nShowing ${limitedArticles.length} of ${allArticles.length} articles:\n\n${formatted}`,
        },
      ],
    };
  }
);

// Fetch from specific source
server.tool(
  "fetch_from_source",
  "Fetch blogs from a specific source",
  {
    name: z.string().describe("Name of the feed source"),
    range: z
      .string()
      .optional()
      .describe("Date range: '1d', '7d', '1w', '30d', '1m' (default: 7d)"),
    limit: z
      .number()
      .optional()
      .describe("Maximum number of articles to return (default: 20)"),
  },
  async ({ name, range, limit }) => {
    const config = loadFeeds();
    const maxResults = limit || 20;
    const feed = config.feeds.find(
      (f) => f.name.toLowerCase() === name.toLowerCase()
    );

    if (!feed) {
      const available = config.feeds.map((f) => f.name).join(", ");
      return {
        content: [
          {
            type: "text",
            text: `Feed "${name}" not found. Available feeds: ${available || "none"}`,
          },
        ],
      };
    }

    const sinceDate = parseDateRange(range || "7d");
    const articles = await fetchFeed(feed, sinceDate);

    articles.sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );

    const limitedArticles = articles.slice(0, maxResults);

    if (limitedArticles.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No articles from ${name} since ${sinceDate.toLocaleDateString()}.`,
          },
        ],
      };
    }

    const formatted = formatArticles(limitedArticles, false);

    return {
      content: [
        {
          type: "text",
          text: `## ${feed.name} Blog Posts (since ${sinceDate.toLocaleDateString()})\n\nShowing ${limitedArticles.length} of ${articles.length} articles:\n\n${formatted}`,
        },
      ],
    };
  }
);

// Search blogs by keyword
server.tool(
  "search_blogs",
  "Search blogs by keyword across all feeds - great for finding content ideas on specific topics",
  {
    keyword: z.string().describe("Keyword or phrase to search for (e.g., 'email marketing', 'AI', 'SEO tips')"),
    range: z
      .string()
      .optional()
      .describe("Date range: '1d', '7d', '1w', '30d', '1m' (default: 30d)"),
    limit: z
      .number()
      .optional()
      .describe("Maximum number of articles to return (default: 20)"),
  },
  async ({ keyword, range, limit }) => {
    const config = loadFeeds();
    const maxResults = limit || 20;
    const searchTerm = keyword.toLowerCase();

    if (config.feeds.length === 0) {
      return {
        content: [{ type: "text", text: "No feeds configured. Use add_feed to add some!" }],
      };
    }

    const sinceDate = parseDateRange(range || "30d");
    const allArticles: BlogArticle[] = [];

    for (const feed of config.feeds) {
      const articles = await fetchFeed(feed, sinceDate);
      allArticles.push(...articles);
    }

    // Filter by keyword in title or summary
    const matchingArticles = allArticles.filter((article) => {
      const titleMatch = article.title.toLowerCase().includes(searchTerm);
      const summaryMatch = article.summary?.toLowerCase().includes(searchTerm);
      return titleMatch || summaryMatch;
    });

    matchingArticles.sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );

    const limitedArticles = matchingArticles.slice(0, maxResults);

    if (limitedArticles.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No articles matching "${keyword}" found since ${sinceDate.toLocaleDateString()}. Try a different keyword or broader date range.`,
          },
        ],
      };
    }

    const formatted = formatArticles(limitedArticles);

    return {
      content: [
        {
          type: "text",
          text: `## Search Results for "${keyword}" (since ${sinceDate.toLocaleDateString()})\n\nFound ${matchingArticles.length} matching articles, showing ${limitedArticles.length}:\n\n${formatted}`,
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("RSS Feed MCP server v2.0 running - Digital Marketer Edition");
}

main().catch(console.error);
