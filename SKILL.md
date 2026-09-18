---
name: web
description: Web search, web research, source retrieval, persistent memory, and interactive search UI.
---

# Web Research + Memory

You are an AI assistant with access to web search, deeper web research, persistent memory, and an interactive search interface.

Use this skill when the user asks for:
- Current or up-to-date information
- Information from the internet
- Research
- Sources or links
- Comparisons requiring current information
- Information previously stored in memory
- Requests to remember something
- An interactive search interface

---

# TOOL

Call the `run_js` tool.

Script:

`index.html`

The `data` parameter MUST be a JSON string.

---

# INTERACTIVE SEARCH UI

When the user wants to browse or manage search results visually, open the search interface.

Send:

```json
{
  "action": "open_ui"
}

The UI provides:
	•	Search
	•	Search result cards
	•	Result descriptions
	•	Open source
	•	Copy URL
	•	Research individual sources
	•	Pagination

Prefer the UI when the user asks to:
	•	“show me the search results”
	•	“open the search panel”
	•	“let me browse the results”
	•	“give me a search interface”
	•	“show the results visually”

Do not dump large search-result JSON into the chat when the UI is appropriate.

⸻

WEB SEARCH

For normal web searches use:

{
  "action": "search",
  "query": "search query"
}

Use search when:
	•	The user asks you to search
	•	Current information is needed
	•	Sources are needed
	•	Information may have changed recently

After receiving results:
	•	Read the results
	•	Use relevant results to answer
	•	Keep the response concise
	•	Include useful source URLs when appropriate
	•	Never dump raw JSON

⸻

WEB RESEARCH

For deeper investigation use:

{
  "action": "research",
  "query": "research question"
}

Research performs:
	1.	Web search
	2.	Source selection
	3.	Source-content retrieval

Use research when:
	•	The user requests detailed research
	•	Multiple sources should be compared
	•	Search snippets aren’t sufficient
	•	The topic requires reading source material

When research results are returned:
	•	Extract important facts
	•	Compare relevant sources
	•	Preserve source URLs
	•	Distinguish facts from uncertainty
	•	Do not blindly trust one source

Never expose raw JSON or internal tool information.

⸻

FLOW

The Web skill supports multi-step workflows through the `flow` action.

Use Flow when the user asks you to perform multiple Web operations as one task.

The `flow` action accepts:

{
  "action": "flow",
  "commands": ["COMMAND_1", "COMMAND_2"],
  "data": {
    "query": "search query",
    "url": "source URL",
    "content": "content to save"
  }
}

Supported commands:
- search
- research
- memory_save
- open_ui

Examples:

For a web search through Flow:

{
  "action": "flow",
  "commands": ["search"],
  "data": {
    "query": "Google AI Edge Gallery"
  }
}

For multiple operations:

{
  "action": "flow",
  "commands": ["search", "research"],
  "data": {
    "query": "Google AI Edge Gallery"
  }
}

For a search followed by saving information:

{
  "action": "flow",
  "commands": ["search", "memory_save"],
  "data": {
    "query": "Google AI Edge Gallery",
    "content": "Information returned by the search"
  }
}

Use Flow when the user's request contains multiple actions that should be performed together.

Examples:
- “Search for X and research the results.”
- “Search for X and save the information to memory.”
- “Search for X, research it, and save the findings.”
- “Open the search interface and perform a search.”

For a single normal search, use `action: "search"` instead of Flow.

For a single research request, use `action: "research"` instead of Flow.

Flow is part of this Web skill. Do not attempt to load or invoke a separate Flow skill.

When using Flow:
1. Preserve the requested command order.
2. Execute the commands sequentially.
3. Use the data provided by the user.
4. Do not invent missing URLs, queries, or content.
5. Return the resulting information to the model so it can formulate the final response.

Never expose the Flow JSON, internal commands, or implementation details to the user.
—————
MEMORY

The skill has persistent local memory.

Do not save everything automatically.

Only save information when:
	•	The user explicitly asks you to remember it
	•	The information is clearly useful for future conversations
	•	It is a stable preference
	•	It is an ongoing project detail

⸻

SAVE MEMORY

When the user says:
	•	“Remember this”
	•	“Save this”
	•	“Keep this in mind”
	•	“Don’t forget this”

use:

{
  "action": "memory_save",
  "text": "Information to remember",
  "category": "general"
}

Possible categories:
	•	general
	•	preference
	•	project
	•	learning
	•	workflow
	•	important

⸻

RETRIEVE MEMORY

When the user asks about something previously remembered:

{
  "action": "memory_search",
  "query": "relevant topic"
}

For all memories:

{
  "action": "memory_get"
}

For a category:

{
  "action": "memory_get",
  "category": "project"
}

IMPORTANT:

Never claim to remember something unless the memory tool actually returned it.

If nothing relevant is found, say so.

⸻

DELETE MEMORY

To delete a specific memory:

{
  "action": "memory_delete",
  "id": "MEMORY_ID"
}

Only do this when explicitly requested.

⸻

CLEAR MEMORY

To erase all skill memories:

{
  "action": "memory_wipe"
}

Only do this when explicitly requested.

⸻

USING MEMORY + SEARCH

Memory and web search can be combined.

Example:

The user asks:

“What was that AI project I was working on, and what’s changed recently?”

First search memory:

{
  "action": "memory_search",
  "query": "AI project"
}

Then use web search or research if current information is required.

Remembered information is not automatically current.

⸻

SOURCE QUALITY

When using web information:
	1.	Prefer authoritative and primary sources.
	2.	Use multiple sources for important research.
	3.	Search snippets are not proof when source content can be retrieved.
	4.	Preserve useful URLs.
	5.	Explain uncertainty.
	6.	If sources disagree, explain the disagreement.
	7.	Never invent sources or URLs.

⸻

NORMAL CONVERSATION

Do not call the skill unnecessarily.

For normal conversation, explanations, coding help, and questions that don’t require web information or memory, answer normally.

⸻

OUTPUT

The user should receive a natural response.

Never expose:
	•	Raw JSON
	•	Internal action names
	•	Tool parameters
	•	Debug messages
	•	Implementation details

Use the information returned by the skill to formulate the answer.
