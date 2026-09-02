"use client";

import { useState } from "react";
import { Paperclip } from "lucide-react";
import { urlComprovante } from "@/lib/supabase";

// Abre o comprovante gerando uma URL assinada temporária no clique.
// O bucket é privado, então não existe link permanente.
export function LinkComprovante({ valor }: { valor?: string | null }) {
  const [carregando, setCarregando] = useState(false);

  if (!valor) return null;

  async function abrir() {
    setCarregando(true);
    try {
      const url = await urlComprovante(valor);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else alert("Não foi possível abrir o comprovante.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={abrir}
      disabled={carregando}
      aria-label="Abrir comprovante"
      className="text-slate-500 hover:text-[#9a6f19] disabled:opacity-50"
    >
      <Paperclip size={16} className={carregando ? "animate-pulse" : ""} />
    </button>
  );
}
