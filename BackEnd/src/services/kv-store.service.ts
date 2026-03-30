import { supabase } from '../lib/supabase'

const KV_TABLE = 'kv_store_eeb342a4'

export async function getKVValue<T = any>(key: string): Promise<T | null> {
  const { data, error } = await supabase
    .from(KV_TABLE)
    .select('value')
    .eq('key', key)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return (data?.value as T | undefined) ?? null
}

export async function setKVValue(key: string, value: any): Promise<void> {
  const { error } = await supabase
    .from(KV_TABLE)
    .upsert({ key, value }, { onConflict: 'key' })

  if (error) {
    throw new Error(error.message)
  }
}

