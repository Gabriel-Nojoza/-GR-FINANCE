"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { supabase } from "@/lib/supabase"

export function LogoutButton() {
  const router = useRouter()

  async function sair() {
    await supabase?.auth.signOut({ scope: "local" })
    router.replace("/login")
  }

  return <button onClick={sair} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white"><LogOut size={19} />Sair</button>
}
