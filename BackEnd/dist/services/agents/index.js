"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgentsByEmail = getAgentsByEmail;
const supabase_1 = require("../../lib/supabase");
async function getAgentsByEmail(email) {
    const { data, error } = await supabase_1.supabase.rpc('sp_get_agents_playground_by_email', { p_user_email: email });
    if (error) {
        console.error('Supabase error:', error);
        throw new Error('Failed to fetch agents');
    }
    return data;
}
