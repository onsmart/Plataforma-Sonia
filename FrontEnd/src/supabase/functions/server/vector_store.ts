
import { OpenAI } from "https://deno.land/x/openai@v4.24.0/mod.ts";

// --- CONFIGURATION ---
// In production, these should be strictly environment variables.
// Using provided credentials as fallback for immediate "Go Live" auditing stability.
const QDRANT_URL = Deno.env.get("QDRANT_URL") || "https://3fbf1733-7584-42d4-a84f-31827395e1a9.sa-east-1-0.aws.cloud.qdrant.io";
const QDRANT_KEY = Deno.env.get("QDRANT_API_KEY") || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.2Mq8vS_deKNwukdRroQ-Z7ZHt7EXSTKeKyHF7I0xhNY";
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");

const COLLECTION_NAME = "sonia_knowledge_base";

// --- OPENAI EMBEDDINGS ---
async function getEmbedding(text: string, agentApiKey?: string): Promise<number[]> {
    // Prioridade: agentApiKey > env
    const apiKey = agentApiKey?.trim() || OPENAI_KEY;
    
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY. Configure a API key do agente ou a variável OPENAI_API_KEY");
    
    const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            input: text,
            model: "text-embedding-3-small"
        })
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI Embedding Error: ${err}`);
    }

    const data = await res.json();
    return data.data[0].embedding;
}

// --- QDRANT OPERATIONS ---

export async function ensureCollection() {
    // Check if collection exists
    const checkRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
        headers: { "api-key": QDRANT_KEY }
    });

    if (checkRes.ok) return; // Already exists

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
        throw new Error(`Failed to create Qdrant collection: ${err}`);
    }
}

export async function upsertDocument(tenantId: string, docId: string, content: string, metadata: any = {}, agentApiKey?: string) {
    await ensureCollection();
    
    // Chunking logic (Basic split by paragraphs for now)
    // For Enterprise, you'd want a more robust chunking strategy (e.g., langchain recursive splitter)
    // We'll treat the whole file snippet as one chunk for this implementation context, 
    // or split if it's too large. Ideally, 'content' passed here is already a chunk.
    
    const embedding = await getEmbedding(content, agentApiKey);

    const point = {
        id: docId, // Must be UUID
        vector: embedding,
        payload: {
            tenant_id: tenantId,
            content: content,
            ...metadata
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
        throw new Error(`Qdrant Search Error: ${err}`);
    }

    const data = await res.json();
    return data.result.map((item: any) => ({
        score: item.score,
        content: item.payload.content,
        metadata: item.payload
    }));
}
