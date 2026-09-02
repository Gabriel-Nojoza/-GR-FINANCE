import { createClient, SupabaseClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export const supabaseConfigurado = Boolean(url && key)

export const supabase: SupabaseClient | null = supabaseConfigurado
  ? createClient(url!, key!)
  : null

const BUCKET = "comprovantes"

// Sobe o arquivo e devolve apenas o caminho interno no bucket (privado).
// O caminho é salvo em `comprovante_url`; a URL de acesso é gerada sob demanda.
export async function enviarComprovante(arquivo: File, pasta: string) {
  if (!supabase) return null

  const extensao = arquivo.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin"
  const caminho = `${pasta}/${crypto.randomUUID()}.${extensao}`
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, arquivo)
  if (error) throw error

  return caminho
}

// Extrai o caminho no bucket a partir de um valor salvo, que pode ser:
// - um caminho novo ("lancamentos/uuid.pdf")
// - uma URL pública antiga (".../object/public/comprovantes/lancamentos/uuid.pdf")
function caminhoDoComprovante(valor: string) {
  const marcador = `/object/public/${BUCKET}/`
  const i = valor.indexOf(marcador)
  if (i !== -1) return valor.slice(i + marcador.length)
  return valor.replace(/^\/+/, "")
}

// Gera uma URL assinada temporária para abrir o comprovante.
export async function urlComprovante(valor?: string | null) {
  if (!supabase || !valor) return null
  const caminho = caminhoDoComprovante(valor)
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(caminho, 60 * 10)
  if (error) return null
  return data.signedUrl
}
