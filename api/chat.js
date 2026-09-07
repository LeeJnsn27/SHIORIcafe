const DEFAULT_MODEL = "gemini-3.6-flash";

module.exports = async function handler(request, response) {
    if (request.method !== "POST") {
        response.status(405).json({ error: "Only POST requests are allowed." });
        return;
    }

    const message = String(request.body?.message || "").trim();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!message) {
        response.status(400).json({ error: "A message is required." });
        return;
    }

    if (!apiKey) {
        response.status(500).json({ error: "The AI service is not configured." });
        return;
    }

    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
    const payload = {
        system_instruction: {
            parts: [{
                text: "You are a warm, concise study companion for a quiet cafe. Help students think through questions without doing dishonest academic work for them."
            }]
        },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig: { maxOutputTokens: 250 }
    };

    try {
        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": apiKey
                },
                body: JSON.stringify(payload)
            }
        );

        if (!geminiResponse.ok) {
            response.status(502).json({ error: "The AI service rejected the request." });
            return;
        }

        const data = await geminiResponse.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
        response.status(200).json({ reply: reply || "I could not create a reply this time." });
    } catch (error) {
        response.status(502).json({ error: "The AI service could not be reached." });
    }
};
