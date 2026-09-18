// FLOW ENGINE
// Handles multiple Web actions in sequence.

window.webFlow = async function(commands, data = {}) {

    const results = [];

    for (const command of commands) {

        try {

            if (command === "search") {

                const query = data.query || "";

                const result =
                    await window.webSearch(query);

                results.push({
                    action: "search",
                    success: true,
                    result: result
                });

            }

            else if (command === "research") {

                const url =
                    data.url || "";

                const result =
                    await window.webResearch(url);

                results.push({
                    action: "research",
                    success: true,
                    result: result
                });

            }

            else if (command === "memory_save") {

                const content =
                    data.content || "";

                const result =
                    await window.webMemorySave(content);

                results.push({
                    action: "memory_save",
                    success: true,
                    result: result
                });

            }

            else if (command === "open_ui") {

                results.push({
                    action: "open_ui",
                    success: true
                });

            }

            else {

                results.push({
                    action: command,
                    success: false,
                    error: "Unknown Flow command"
                });

            }

        } catch (error) {

            results.push({
                action: command,
                success: false,
                error: error.message
            });

        }
    }

    return results;
};
