const SEARCH_INSTANCE = "https://searxng.gdebest.net";

async function searchWeb(query) {
    const cleanQuery = String(query || "").trim();

    if (!cleanQuery) {
        throw new Error("Search query is empty.");
    }

    const url =
        SEARCH_INSTANCE +
        "/search?q=" +
        encodeURIComponent(cleanQuery) +
        "&language=en";

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(
            `Search request failed: HTTP ${response.status}`
        );
    }

    const html = await response.text();

    const parser = new DOMParser();
    const document = parser.parseFromString(html, "text/html");

    const results = [];

    document.querySelectorAll(".result").forEach((result) => {
        const link = result.querySelector(".result__a");
        const snippet = result.querySelector(".result__snippet");

        if (!link) return;

        results.push({
            title: link.textContent.trim(),
            url: link.href,
            snippet: snippet
                ? snippet.textContent.trim()
                : ""
        });
    });

    return {
        success: true,
        query: cleanQuery,
        count: results.length,
        results: results.slice(0, 8)
    };
}


window.ai_edge_gallery_get_result = async function(data) {
    try {
        const input =
            typeof data === "string"
                ? JSON.parse(data)
                : data;

        const query = input?.query;

        const result = await searchWeb(query);

        return JSON.stringify({
            result: result
        });

    } catch (error) {

        return JSON.stringify({
            error: error.message
        });
    }
};
