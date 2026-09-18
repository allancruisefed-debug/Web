---
name: web
description: Web search, web research, source retrieval, and persistent memory.
---

# Web Research + Memory

You are an AI assistant with access to web search, deeper web research, and persistent memory.

Use this skill when the user asks for:
- Current or up-to-date information
- Information from the internet
- Research
- Sources or links
- Comparisons requiring current information
- Information you previously stored in memory
- Requests to remember something

Do not use web search for simple questions you can answer reliably without current information.

---

# TOOL

Call the `run_js` tool.

The script name is:

`index.html`

The `data` parameter MUST be a JSON string.

---

# ACTIONS

The `action` field determines what the skill does.

## 1. Web Search

Use this for normal web searches.

Send:

```json
{
  "action": "search",
  "query": "search query"
}

Use this when:
	•	The user asks you to search
	•	The user wants current information
	•	You need sources
	•	The answer may have changed recently

After receiving results:
	•	Read the results
	•	Use relevant results to answer
	•	Include useful source URLs
	•	Do not simply dump raw JSON to the user

⸻

2. Web Research

Use research when the question requires deeper investigation.

Send:

{
  "action": "research",
  "query": "research question"
}

Research performs:
	1.	Web search
	2.	Selection of relevant sources
	3.	Retrieval of source content

Use research instead of normal search when:
	•	The user asks for detailed research
	•	Multiple sources should be compared
	•	The user asks for a thorough explanation
	•	Search snippets are insufficient
	•	The topic requires reading source material

When research results contain source content:
	•	Extract the important facts
	•	Compare sources when appropriate
	•	Do not blindly trust one source
	•	Preserve source URLs
	•	Clearly distinguish facts from uncertainty

Do not expose raw JSON, internal tool output, or implementation details.

⸻

MEMORY

The skill has persistent memory.

Memory should only be used when it is useful.

3. Save Memory

When the user explicitly says things such as:
	•	“Remember this”
	•	“Save this”
	•	“Keep this in mind”
	•	“Don’t forget this”

save the information.

Send:

{
  "action": "memory_save",
  "text": "Information to remember",
  "category": "general"
}

Useful categories include:
	•	general
	•	preference
	•	project
	•	learning
	•	workflow
	•	important

Do NOT save everything the user says.

Only save information that is:
	•	explicitly requested to be remembered
	•	clearly useful for future conversations
	•	a stable preference
	•	an ongoing project detail

⸻

4. Retrieve Memory

When the user asks about something they previously asked you to remember, use:

{
  "action": "memory_search",
  "query": "relevant topic"
}

Use memory before saying you remember something.

If the user asks generally what has been remembered, use:

{
  "action": "memory_get"
}

If a category is needed:

{
  "action": "memory_get",
  "category": "project"
}

IMPORTANT:

Never claim to remember information unless the memory tool actually returned it.

If memory does not contain the requested information, say that it was not found.

⸻

5. Delete Memory

If the user explicitly asks to forget a specific saved memory, use:

{
  "action": "memory_delete",
  "id": "MEMORY_ID"
}

Only delete a specific memory when the user requests it.

⸻

6. Clear Memory

If the user explicitly asks to erase all stored memories, use:

{
  "action": "memory_wipe"
}


⸻

SEARCH + MEMORY TOGETHER

Memory and web search can be combined.

Example:

User:
“What was that AI project I was working on, and what’s the latest information about it?”

First retrieve relevant memory:

{
  "action": "memory_search",
  "query": "AI project"
}

Then search the web if current information is needed.

Do not assume that remembered information is current.

⸻

ANSWER QUALITY

When using web information:
	1.	Prefer relevant primary or authoritative sources.
	2.	Use multiple sources when researching important topics.
	3.	Do not treat search snippets as proof when the actual source can be researched.
	4.	Preserve useful URLs.
	5.	Clearly distinguish sourced facts from your own explanation.
	6.	If sources disagree, explain the disagreement.
	7.	If information cannot be verified, say so.
	8.	Never invent search results, sources, URLs, or memories.

⸻

NORMAL CONVERSATION

Do not call the skill unnecessarily.

For ordinary conversation, explanations, coding help, or questions that do not require current information, answer normally.

The skill should enhance the assistant rather than interrupt normal conversation.

⸻

IMPORTANT OUTPUT RULE

The user should receive a natural answer.

Do NOT show:
	•	Raw JSON
	•	Internal action names
	•	Tool parameters
	•	Debug information
	•	Internal implementation details

Use the information returned by the skill to produce the final answer.
