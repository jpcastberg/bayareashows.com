export async function get(path: string, data: Record<string, string> = {}): Promise<Record<string, unknown>> {
    const url = new URL(path, window.location.origin);
    Object.entries(data).forEach(([key, value]) => url.searchParams.append(key, value));

    const response = await fetch(url.toString(), {
        method: "GET",
    });


    if (!response.ok) {
        let errorBody = "";
        try {
            errorBody = await response.text();
        } catch (e) { // eslint-disable-line @typescript-eslint/no-unused-vars
        }
        throw new Error(`API request failed with status ${response.status}: ${response.statusText}${errorBody ? `, response body: ${errorBody}` : ""}`);
    }

    return await response.json();
}
