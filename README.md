# RSS Feeds MCP Server

[![npm version](https://img.shields.io/npm/v/rss-feeds-mcp)](https://www.npmjs.com/package/rss-feeds-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![rss-feeds-mcp MCP server](https://glama.ai/mcp/servers/lionkiii/rss-feeds-mcp/badges/score.svg)](https://glama.ai/mcp/servers/lionkiii/rss-feeds-mcp)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that lets AI assistants like **Claude Desktop**, **Cursor**, **Windsurf**, and any MCP client fetch, filter, and search RSS feeds. Monitor blogs, track industry news, and research content — all through natural language.

> **Zero configuration.** Install and start reading RSS feeds immediately. No API keys, no authentication.

## What Can You Do?

Ask Claude questions like:
- *"What are the latest SEO blog posts this week?"*
- *"Search all feeds for articles about AI marketing"*
- *"Show me the latest posts from HubSpot"*
- *"Add TechCrunch to my feeds"*
- *"What content marketing articles were published today?"*

## Quick Start

```bash
npx rss-feeds-mcp
```

Or install globally:

```bash
npm install -g rss-feeds-mcp
```

Ships with default feeds — customize your own at `~/.rss-mcp/feeds.json`.

## Claude Desktop Configuration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "rss": {
      "command": "npx",
      "args": ["-y", "rss-feeds-mcp"]
    }
  }
}
```

Restart Claude Desktop. Done — RSS feeds are now available in Claude.

### Use with Other MCP Clients

Works with any MCP-compatible client including **Cursor**, **Windsurf**, **VS Code + Cline**, and more:

```bash
npx rss-feeds-mcp
```

## Available Tools (8 Tools)

| Tool | Description |
|------|-------------|
| `list_categories` | List all available feed categories (SEO, content, social, email, analytics, CRM, news) |
| `list_feeds` | List all configured RSS feeds with their categories |
| `add_feed` | Add a new RSS feed with name, URL, and category |
| `remove_feed` | Remove a feed by name |
| `fetch_blogs` | Fetch latest posts from all feeds with date range and limit |
| `fetch_by_category` | Fetch posts filtered by category |
| `fetch_from_source` | Fetch posts from a specific named source |
| `search_blogs` | Search across all feeds by keyword (matches title and summary) |

## Examples

### Example 1: Add a feed and fetch latest posts

**User prompt:** "Add the HubSpot blog RSS feed and show me the latest 5 posts"

**Expected behavior:**
- Calls `add_feed` with name "hubspot", URL "https://blog.hubspot.com/rss", and category "content"
- Then calls `fetch_from_source` with name "hubspot" and limit 5
- Returns the 5 most recent HubSpot blog posts with titles, publication dates, summaries, and links

### Example 2: Search across all feeds for a topic

**User prompt:** "Search all my feeds for articles about 'content marketing' from the last month"

**Expected behavior:**
- Calls `search_blogs` with keyword "content marketing" and range "30d"
- Searches all configured feeds for articles containing "content marketing" in their title or summary
- Returns matching articles sorted by date with title, source, publication date, and link

### Example 3: Get posts from a specific category

**User prompt:** "Show me the latest SEO articles from this week"

**Expected behavior:**
- Calls `fetch_by_category` with category "seo" and range "1w"
- Fetches posts from all feeds tagged with the "seo" category
- Returns articles from SEO-focused blogs published in the last 7 days, sorted by date

## Use Cases

- **Content Research** — Find trending topics and content ideas from industry blogs
- **Competitive Monitoring** — Track what competitors are publishing
- **News Aggregation** — Stay on top of industry news across multiple sources
- **Content Curation** — Collect and filter articles for newsletters or social media
- **SEO Research** — Monitor SEO blogs for algorithm updates and best practices
- **Marketing Intelligence** — Track marketing trends across channels

## Feed Configuration

Feeds are stored at `~/.rss-mcp/feeds.json`. On first run, a default config is created with sample feeds. Manage feeds dynamically using the `add_feed` and `remove_feed` tools, or edit the file directly:

```json
{
  "categories": ["seo", "content", "social", "email", "analytics", "crm", "news"],
  "feeds": [
    { "name": "hubspot", "url": "https://blog.hubspot.com/rss", "category": "content" },
    { "name": "techcrunch", "url": "https://techcrunch.com/feed/", "category": "news" },
    { "name": "searchengineland", "url": "https://searchengineland.com/feed", "category": "seo" }
  ]
}
```

## Requirements

- **Node.js** >= 18
- No API keys or authentication needed

## Related

- [Model Context Protocol](https://modelcontextprotocol.io) — The open standard for AI-tool integration
- [Claude Desktop](https://claude.ai/download) — Anthropic's desktop AI assistant
- [MCP Server Registry](https://github.com/punkpeye/awesome-mcp-servers) — Curated list of MCP servers

## Privacy Policy

See [PRIVACY.md](./PRIVACY.md) for our complete privacy policy.

**TL;DR:** This extension runs locally on your machine. All feed fetching happens directly from your machine to public RSS endpoints. No data is collected, stored, or transmitted to any third party by this MCP server. No API keys or authentication required.

## License

MIT
