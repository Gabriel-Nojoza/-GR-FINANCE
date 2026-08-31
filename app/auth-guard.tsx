"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const rotasPublicas = ["/login"]

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [verificando, setVerificando] = useState(Boolean(supabase))
  const publica = rotasPublicas.some((rota) => pathname.startsWith(rota))

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data }) => {
      if (!data.session && !publica) router.replace("/login")
      if (data.session && publica) router.replace("/")
      setVerificando(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (!session && !publica) router.replace("/login")
      setVerificando(false)
    })

    return () => listener.subscription.unsubscribe()
  }, [publica, router])

  if (verificando) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">Verificando acesso...</div>
  }

  return children
}
