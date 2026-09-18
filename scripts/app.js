const SEARCH_INSTANCE = "https://searxng.gdebest.net";

window.ai_edge_gallery_get_result = async function(data) {
    try {
        const input =
            typeof data === "string"
                ? JSON.parse(data)
                : data;

        const query = String(input?.query || "").trim();

        if (!query) {
            throw new Error("No search query was provided.");
        }

        const url =
            SEARCH_INSTANCE +
            "/search?q=" +
            encodeURIComponent(query);

        const response = await fetch(url);

        return JSON.stringify({
            result: {
                success: true,
                query: query,
                httpStatus: response.status,
                contentType: response.headers.get("content-type"),
                url: url,
                message: "SearXNG request reached the server."
            }
        });

    } catch (error) {

        return JSON.stringify({
            error: "SEARCH_FAILED: " + error.message
        });
    }
};
