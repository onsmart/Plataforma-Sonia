import * as kv from "./kv_store.tsx";
import { executeTool, IOT_TOOLS } from "./ai_tools.ts";

// --- MODERATION LAYER ---
async function runModeration(input: string, apiKey: string) {
    const res = await fetch("https://api.openai.com/v1/moderations", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ input })
    });

    const data = await res.json();
    const result = data.results?.[0];

    if (result?.flagged) {
        throw new Error(`Content flagged by Safety Systems. Categories: ${Object.keys(result.categories).filter(k => result.categories[k]).join(", ")}`);
    }
}

// --- CORE LLM LOOP ---
export async function callLLM(
    provider: string,
    model: string,
    messages: any[],
    systemPrompt: string,
    tenantId: string,
    agentApiKey?: string // API key do agente (opcional, busca do banco se não fornecido)
) {
    // 1. Get Credentials
    // Prioridade: agentApiKey > tenant config > env
    let apiKey = agentApiKey?.trim();
    
    if (!apiKey) {
        const config = await kv.get(`tenant:${tenantId}:config:llm`) || {};
        apiKey = config.apiKey || Deno.env.get("OPENAI_API_KEY");
    }

    if (!apiKey) throw new Error("LLM API Key not found");

    // 2. Safety Check (Moderation) - Enterprise Feature
    const lastUserMsg = messages[messages.length - 1];
    if (lastUserMsg && lastUserMsg.role === 'user') {
        await runModeration(lastUserMsg.content, apiKey);
    }

    // 3. Prepare Initial Payload
    const fullMessages = [
        { role: "system", content: systemPrompt },
        ...messages
    ];

    const MAX_TURNS = 5; // Prevent infinite loops
    let currentTurn = 0;
    let currentMessages = [...fullMessages];

    // 4. Execution Loop (Reasoning -> Action -> Observation)
    while (currentTurn < MAX_TURNS) {
        currentTurn++;

        console.log(`[AI Loop] Turn ${currentTurn}, Messages: ${currentMessages.length}`);

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: model || "gpt-4o",
                messages: currentMessages,
                tools: IOT_TOOLS, // Inject IoT Capabilities
                tool_choice: "auto", 
                temperature: 0.2 // Low temp for reliable actions
            })
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`LLM Provider Error: ${err}`);
        }

        const data = await res.json();
        const choice = data.choices[0];
        const responseMsg = choice.message;

        // Case A: Model wants to call a function (Tool Call)
        if (responseMsg.tool_calls && responseMsg.tool_calls.length > 0) {
            // Append the "assistant's thought" (intent to call tool) to history
            currentMessages.push(responseMsg);

            // Execute all requested tools in parallel
            for (const toolCall of responseMsg.tool_calls) {
                const fnName = toolCall.function.name;
                const fnArgs = JSON.parse(toolCall.function.arguments);

                // Run the Tool
                const toolResult = await executeTool(tenantId, fnName, fnArgs);

                // Feed result back to LLM as "tool" role
                currentMessages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: toolResult
                });
            }
            // Loop continues to let LLM process the tool result
        } 
        // Case B: Model has a final text answer
        else {
            return data; // Return final response object
        }
    }

    throw new Error("Max execution turns reached. Agent loop stuck.");
}

// --- VISION UTILS (Legacy) ---
export async function describeImage(imageBlob: Blob, mimeType: string, agentApiKey?: string): Promise<string> {
    // Prioridade: agentApiKey > env
    const apiKey = agentApiKey?.trim() || Deno.env.get("OPENAI_API_KEY");
    
    if (!apiKey) throw new Error("OpenAI API Key not found for image description");
    // Convert blob to base64
    const buffer = await imageBlob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Describe this image in detail for a security audit. Focus on safety hazards or people." },
                        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }
                    ]
                }
            ],
            max_tokens: 300
        })
    });

    const data = await res.json();
    return data.choices[0].message.content;
}
