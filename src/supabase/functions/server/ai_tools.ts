import { DeviceRepo } from "./repositories.ts";
import { logActivity } from "./core.ts";
import * as kv from "./kv_store.tsx";
import { searchKnowledge } from "./vector_store.ts";

// --- TOOL DEFINITIONS ---
export const IOT_TOOLS = [
  {
    type: "function",
    function: {
      name: "crm_capture_lead",
      description: "Saves a qualified lead to the CRM. Validate email before calling.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          company: { type: "string" },
          interest_level: { type: "string", enum: ["high", "medium", "low"] },
          notes: { type: "string" }
        },
        required: ["name", "email", "interest_level"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calendar_check_availability",
      description: "Checks REAL availability. Returns next 3 days with open slots.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calendar_book_meeting",
      description: "Books a meeting slot. Fails if already taken.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Format YYYY-MM-DD" },
          time: { type: "string", description: "Format HH:MM (e.g., 14:00)" },
          email: { type: "string" }
        },
        required: ["date", "time", "email"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "kb_search_product",
      description: "Semantic search in the company's Knowledge Base (PDFs, Docs). Use this to answer questions about products, policies, or technical details.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  // Legacy IoT Tools
  {
    type: "function",
    function: {
      name: "list_devices",
      description: "List IoT devices.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "control_device",
      description: "Control IoT device.",
      parameters: {
        type: "object",
        properties: { deviceId: { type: "string" }, action: { type: "string" } },
        required: ["deviceId", "action"],
      },
    },
  }
];

// --- HELPERS ---
function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getNext3BusinessDays() {
    const dates = [];
    let current = new Date();
    while (dates.length < 3) {
        current.setDate(current.getDate() + 1);
        if (current.getDay() !== 0 && current.getDay() !== 6) { // Skip weekends
            dates.push(current.toISOString().split('T')[0]);
        }
    }
    return dates;
}

// --- EXECUTOR ---
export async function executeTool(tenantId: string, toolName: string, args: any): Promise<string> {
    console.log(`[AI Tool Execution] ${toolName}`, args);

    try {
        // 1. CRM - With Validation
        if (toolName === "crm_capture_lead") {
            if (!isValidEmail(args.email)) {
                return JSON.stringify({ error: "Invalid email format. Please ask user for a valid email." });
            }
            
            const leadId = crypto.randomUUID();
            const leadData = { ...args, id: leadId, capturedAt: new Date().toISOString(), status: "new" };
            await kv.set(`tenant:${tenantId}:crm:lead:${leadId}`, leadData);
            
            await logActivity(tenantId, {
                agent: "Sonia_SDR",
                action: `Lead Captured: ${args.email} (${args.company || 'No Company'})`,
                type: "success",
                platform: "CRM"
            });
            return JSON.stringify({ success: true, message: "Lead saved." });
        }

        // 2. CALENDAR - Real Slot Management
        if (toolName === "calendar_check_availability") {
            const days = getNext3BusinessDays();
            const standardSlots = ["09:00", "11:00", "14:00", "16:00"];
            const availability = [];

            for (const date of days) {
                const daySlots = [];
                for (const time of standardSlots) {
                    // Check if this specific slot is already booked in KV
                    const isBooked = await kv.get(`tenant:${tenantId}:calendar:${date}:${time}`);
                    if (!isBooked) {
                        daySlots.push(time);
                    }
                }
                if (daySlots.length > 0) {
                    availability.push({ date, slots: daySlots });
                }
            }
            return JSON.stringify({ available_dates: availability });
        }

        if (toolName === "calendar_book_meeting") {
            const { date, time, email } = args;
            const slotKey = `tenant:${tenantId}:calendar:${date}:${time}`;
            
            // Atomic check (simulation)
            const isBooked = await kv.get(slotKey);
            if (isBooked) {
                return JSON.stringify({ error: "Sorry, that slot was just taken. Please pick another time." });
            }

            // Book it
            await kv.set(slotKey, { bookedBy: email, bookedAt: new Date().toISOString() });
            
            await logActivity(tenantId, {
                agent: "Sonia_SDR",
                action: `Meeting Confirmed: ${date} @ ${time} with ${email}`,
                type: "success",
                platform: "Calendar"
            });
            
            return JSON.stringify({ success: true, message: `Meeting confirmed for ${date} at ${time}.` });
        }

        // 3. KB - Real Vector Search (Qdrant)
        if (toolName === "kb_search_product") {
            const query = args.query;
            console.log(`[Vector Search] Querying Qdrant for: ${query}`);
            
            try {
                const results = await searchKnowledge(tenantId, query);
                
                if (results.length === 0) {
                     return JSON.stringify({ content: "No relevant documents found in the Knowledge Base." });
                }

                // Format results for the LLM
                const context = results.map((r: any, i: number) => 
                    `[Source ${i+1}] (Score: ${r.score.toFixed(2)})\n${r.content}`
                ).join("\n\n");

                return JSON.stringify({ content: context });

            } catch (err: any) {
                console.error("Vector Search Error:", err);
                return JSON.stringify({ error: "Failed to search knowledge base. " + err.message });
            }
        }

        // 4. IoT Legacy
        if (toolName === "list_devices") return JSON.stringify(await DeviceRepo.list(tenantId));
        if (toolName === "control_device") return JSON.stringify({ success: true, status: "updated" });

        return JSON.stringify({ error: "Unknown tool" });

    } catch (err) {
        console.error("Tool Error:", err);
        return JSON.stringify({ error: "Internal System Error during tool execution." });
    }
}
