
// --- CONFIGURATION ---
// In production, these should be strictly environment variables.
const QDRANT_URL = Deno.env.get("QDRANT_URL") || "";
const QDRANT_KEY = Deno.env.get("QDRANT_API_KEY") || "";
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");

const COLLECTION_NAME = "sonia_knowledge_base";

// Cache for collection existence to reduce API roundtrips
let isCollectionReady = false;

// --- OPENAI EMBEDDINGS ---
async function getEmbedding(text: string, agentApiKey?: string): Promise<number[]> {
    const apiKey = agentApiKey?.trim() || OPENAI_KEY;

    if (!apiKey) throw new Error("Missing OPENAI_API_KEY. Configure the agent API key or the OPENAI_API_KEY environment variable.");

    const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            input: text.trim(),
            model: "text-embedding-3-small"
        })
    });

    if (!res.ok) {
        const err = await res.text();
        console.error(`[Vector Store] OpenAI Embedding Error: ${err}`);
        throw new Error(`OpenAI Embedding Error: ${err}`);
    }

    const data = await res.json();
    if (!data.data?.[0]?.embedding) {
        throw new Error("Invalid response from OpenAI Embeddings API");
    }
    return data.data[0].embedding;
}

// --- QDRANT OPERATIONS ---

export async function ensureCollection() {
    if (isCollectionReady) return;

    // Check if collection exists
    const checkRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
        headers: { "api-key": QDRANT_KEY }
    });

    if (checkRes.ok) {
        isCollectionReady = true;
        return;
    }

    // Create Collection (1536 dims for text-embedding-3-small)
    console.log(`[Vector Store] Creating collection ${COLLECTION_NAME}...`);
    const createRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
        method: "PUT",
        headers: {
            "api-key": QDRANT_KEY,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            vectors: {
                size: 1536,
                distance: "Cosine"
            }
        })
    });

    if (!createRes.ok) {
        const err = await createRes.text();
        console.error(`[Vector Store] Failed to create collection: ${err}`);
        throw new Error(`Failed to create Qdrant collection: ${err}`);
    }

    isCollectionReady = true;
}

export async function upsertDocument(tenantId: string, docId: string, content: string, metadata: any = {}, agentApiKey?: string) {
    await ensureCollection();

    // In production, split large content into smaller chunks.
    // For this context, we assume the caller provides manageable snippets.
    const embedding = await getEmbedding(content, agentApiKey);

    const point = {
        id: docId, // Must be UUID or Int
        vector: embedding,
        payload: {
            tenant_id: tenantId,
            content: content,
            ...metadata,
            updated_at: new Date().toISOString()
        }
    };

    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points?wait=true`, {
        method: "PUT",
        headers: {
            "api-key": QDRANT_KEY,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            points: [point]
        })
    });

    if (!res.ok) {
        const err = await res.text();
        console.error(`[Vector Store] Qdrant Upsert Error: ${err}`);
        throw new Error(`Qdrant Upsert Error: ${err}`);
    }
}

export async function searchKnowledge(tenantId: string, query: string, limit: number = 3, agentApiKey?: string) {
    await ensureCollection();

    const queryVector = await getEmbedding(query, agentApiKey);

    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
        method: "POST",
        headers: {
            "api-key": QDRANT_KEY,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            vector: queryVector,
            limit: limit,
            with_payload: true,
            filter: {
                must: [
                    {
                        key: "tenant_id",
                        match: { value: tenantId }
                    }
                ]
            }
        })
    });

    if (!res.ok) {
        const err = await res.text();
        console.error(`[Vector Store] Qdrant Search Error: ${err}`);
        throw new Error(`Qdrant Search Error: ${err}`);
    }

    const data = await res.json();

    if (!data.result || !Array.isArray(data.result)) {
        return [];
    }

    return data.result.map((item: any) => ({
        id: item.id,
        score: item.score,
        content: item.payload?.content || "",
        metadata: item.payload || {}
    }));
}
