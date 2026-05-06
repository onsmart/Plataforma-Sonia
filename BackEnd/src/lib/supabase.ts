import './env'
import { createClient } from '@supabase/supabase-js'
import type { WebSocketLikeConstructor } from '@supabase/realtime-js'
import WebSocket from 'ws'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

// Servidor Node: realtime-js usa WebSocket; antes do Node 22 não há API nativa — usa pacote `ws`.
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  realtime: {
    transport: WebSocket as unknown as WebSocketLikeConstructor,
  },
})
