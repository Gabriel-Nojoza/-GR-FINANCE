import { createClient, SupabaseClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export const supabaseConfigurado = Boolean(url && key)

export const supabase: SupabaseClient | null = supabaseConfigurado
  ? createClient(url!, key!)
  : null

export async function enviarComprovante(arquivo: File, pasta: string) {
  if (!supabase) return null

  const extensao = arquivo.name.split(".").pop() ?? "bin"
  const caminho = `${pasta}/${crypto.randomUUID()}.${extensao}`
  const { error } = await supabase.storage.from("comprovantes").upload(caminho, arquivo)
  if (error) throw error

  const { data } = supabase.storage.from("comprovantes").getPublicUrl(caminho)
  return data.publicUrl
}
