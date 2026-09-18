const SEARCH_ENDPOINT =
  "https://web.allancruise-fed.workers.dev/?q=";

window.ai_edge_gallery_get_result = async function(data) {
  try {
    // Accept JSON from the AI
    const input =
      typeof data === "string"
        ? JSON.parse(data)
        : data;

    const query = String(input?.query || "").trim();

    if (!query) {
      return JSON.stringify({
        error: "No search query provided."
      });
    }

    // Ask our Cloudflare Worker to search
    const response = await fetch(
      SEARCH_ENDPOINT + encodeURIComponent(query)
    );

    if (!response.ok) {
      throw new Error(
        "Search service returned HTTP " + response.status
      );
    }

    const searchData = await response.json();

    // Return the search results to Edge Gallery
    return JSON.stringify({
      result: searchData
    });

  } catch (error) {
    return JSON.stringify({
      error: "SEARCH_FAILED: " + error.message
    });
  }
};
