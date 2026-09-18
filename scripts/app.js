const SEARCH_ENDPOINT =
  "https://web.allancruise-fed.workers.dev/";


// ======================================================
// MEMORY
// ======================================================

const MEMORY_KEY = "web_skill_memory_v1";

function loadMemory() {
  try {
    return JSON.parse(localStorage.getItem(MEMORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveMemoryStore(memory) {
  localStorage.setItem(
    MEMORY_KEY,
    JSON.stringify(memory)
  );
}


// ======================================================
// SEARCH
// ======================================================

async function searchWeb(query, research = false) {
  const url =
    SEARCH_ENDPOINT +
    "?q=" +
    encodeURIComponent(query) +
    (research ? "&research=1" : "");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      "Search service returned HTTP " +
      response.status
    );
  }

  return await response.json();
}


// ======================================================
// MEMORY ACTIONS
// ======================================================

function remember(text, category = "general") {
  const memory = loadMemory();

  const item = {
    id: Date.now().toString(),
    text: String(text),
    category: String(category),
    createdAt: new Date().toISOString()
  };

  memory.push(item);

  saveMemoryStore(memory);

  return {
    success: true,
    message: "Memory saved.",
    memory: item
  };
}


function getMemories(category = null) {
  const memory = loadMemory();

  if (!category) {
    return memory;
  }

  return memory.filter(
    item => item.category === category
  );
}


function searchMemory(query) {
  const memory = loadMemory();

  const words = String(query)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  return memory.filter(item => {
    const text = item.text.toLowerCase();

    return words.some(word =>
      text.includes(word)
    );
  });
}


function deleteMemory(id) {
  const memory = loadMemory();

  const updated = memory.filter(
    item => item.id !== String(id)
  );

  saveMemoryStore(updated);

  return {
    success: true,
    deleted: memory.length - updated.length
  };
}


function wipeMemory() {
  localStorage.removeItem(MEMORY_KEY);

  return {
    success: true,
    message: "All memories cleared."
  };
}


// ======================================================
// AI EDGE GALLERY BRIDGE
// ======================================================

window.ai_edge_gallery_get_result =
  async function(data) {

    try {

      const input =
        typeof data === "string"
          ? JSON.parse(data)
          : data;


      // --------------------------------------------------
      // Determine action
      // --------------------------------------------------

      const action =
        String(input?.action || "search")
          .toLowerCase();


      // --------------------------------------------------
      // SEARCH
      // --------------------------------------------------

      if (action === "search") {

        const query =
          String(input?.query || "").trim();

        if (!query) {
          return JSON.stringify({
            error: "A search query is required."
          });
        }

        const results =
          await searchWeb(query, false);

        return JSON.stringify({
          result: {
            action: "search",
            query,
            data: results
          }
        });
      }


      // --------------------------------------------------
      // RESEARCH
      // --------------------------------------------------

      if (action === "research") {

        const query =
          String(input?.query || "").trim();

        if (!query) {
          return JSON.stringify({
            error: "A research question is required."
          });
        }

        const results =
          await searchWeb(query, true);

        return JSON.stringify({
          result: {
            action: "research",
            query,
            data: results
          }
        });
      }


      // --------------------------------------------------
      // SAVE MEMORY
      // --------------------------------------------------

      if (action === "memory_save") {

        const text =
          String(input?.text || "").trim();

        const category =
          String(
            input?.category || "general"
          );

        if (!text) {
          return JSON.stringify({
            error: "Memory text is required."
          });
        }

        return JSON.stringify({
          result: remember(
            text,
            category
          )
        });
      }


      // --------------------------------------------------
      // GET MEMORY
      // --------------------------------------------------

      if (action === "memory_get") {

        const category =
          input?.category || null;

        return JSON.stringify({
          result: {
            memories:
              getMemories(category)
          }
        });
      }


      // --------------------------------------------------
      // SEARCH MEMORY
      // --------------------------------------------------

      if (action === "memory_search") {

        const query =
          String(input?.query || "").trim();

        if (!query) {
          return JSON.stringify({
            error: "Memory search query is required."
          });
        }

        return JSON.stringify({
          result: {
            memories:
              searchMemory(query)
          }
        });
      }


      // --------------------------------------------------
      // DELETE MEMORY
      // --------------------------------------------------

      if (action === "memory_delete") {

        const id =
          String(input?.id || "").trim();

        if (!id) {
          return JSON.stringify({
            error: "Memory ID is required."
          });
        }

        return JSON.stringify({
          result:
            deleteMemory(id)
        });
      }


      // --------------------------------------------------
      // WIPE MEMORY
      // --------------------------------------------------

      if (action === "memory_wipe") {

        return JSON.stringify({
          result:
            wipeMemory()
        });
      }


      // --------------------------------------------------
      // UNKNOWN ACTION
      // --------------------------------------------------

      return JSON.stringify({
        error:
          "Unknown action: " + action
      });


    } catch (error) {

      return JSON.stringify({
        error:
          "WEB_SKILL_ERROR: " +
          error.message
      });

    }
  };
