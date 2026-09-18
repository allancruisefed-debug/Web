---
name: web
description: Search the web using SearXNG.
---

# Web Search

Use this skill when the user asks you to search the web or find current information online.

Call the `run_js` tool with:

- script name: index.html
- data: A JSON string containing:
  - query: String. The user's search query.

Example:

{"query":"latest Google AI Edge Gallery documentation"}

The JavaScript skill returns search results containing:
- title
- URL
- snippet
