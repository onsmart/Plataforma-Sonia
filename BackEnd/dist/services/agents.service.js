"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgents = getAgents;
const supabase_1 = require("../lib/supabase");
async function getAgents() {
    const { data, error } = await supabase_1.supabase
        .from('tb_agents')
        .select('*');
    if (error) {
        console.error('SUPABASE RPC ERROR:', error);
        throw error;
    }
    return data;
}
