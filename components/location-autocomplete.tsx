"use client";

import { useEffect, useId, useState } from "react";
import { MapPin } from "lucide-react";

type PropriedadesPhoton = {
  name?: string;
  city?: string;
  state?: string;
  country?: string;
  countrycode?: string;
};

type Sugestao = { id: string; texto: string };

export function LocationAutocomplete({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (valor: string) => void;
  placeholder: string;
}) {
  const listId = useId();
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    const termo = value.trim();
    if (termo.length < 3 || !aberto) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setCarregando(true);
        setFalhou(false);
        const parametros = new URLSearchParams({
          q: termo,
          limit: "6",
        });
        parametros.append("layer", "city");
        parametros.append("layer", "locality");
        parametros.append("layer", "state");
        parametros.append("layer", "country");
        const resposta = await fetch(
          `https://photon.komoot.io/api/?${parametros}`,
          { signal: controller.signal },
        );
        if (!resposta.ok) throw new Error("Falha na pesquisa");
        const dados = (await resposta.json()) as {
          features?: Array<{
            properties: PropriedadesPhoton;
            geometry?: { coordinates?: number[] };
          }>;
        };
        const unicos = new Map<string, Sugestao>();
        dados.features?.forEach((item, indice) => {
          const p = item.properties;
          const partes = [
            p.name,
            p.city !== p.name ? p.city : null,
            p.state,
            p.country,
          ].filter(Boolean);
          const texto = [...new Set(partes)].join(", ");
          if (texto) unicos.set(texto, { id: `${texto}-${indice}`, texto });
        });
        setSugestoes([...unicos.values()]);
      } catch (erro) {
        if (!(erro instanceof DOMException && erro.name === "AbortError")) {
          setSugestoes([]);
          setFalhou(true);
        }
      } finally {
        setCarregando(false);
      }
    }, 450);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [value, aberto]);

  return (
    <div className="relative">
      <input
        required
        role="combobox"
        aria-expanded={aberto}
        aria-controls={listId}
        autoComplete="off"
        className="campo"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => window.setTimeout(() => setAberto(false), 150)}
        placeholder={placeholder}
      />
      {aberto && value.trim().length >= 3 && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
        >
          {carregando && (
            <p className="px-3 py-3 text-xs text-slate-400">
              Procurando lugares...
            </p>
          )}
          {!carregando &&
            sugestoes.map((item) => (
              <button
                role="option"
                aria-selected={value === item.texto}
                type="button"
                key={item.id}
                onMouseDown={() => {
                  onChange(item.texto);
                  setAberto(false);
                }}
                className="flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-amber-50"
              >
                <MapPin size={16} className="mt-0.5 shrink-0 text-[#a97d25]" />
                <span>{item.texto}</span>
              </button>
            ))}
          {!carregando && !sugestoes.length && (
            <p className="px-3 py-3 text-xs text-slate-400">
              {falhou
                ? "Não foi possível consultar os lugares agora. Você pode continuar digitando manualmente."
                : "Nenhum lugar encontrado. Você pode continuar digitando manualmente."}
            </p>
          )}
        </div>
      )}
      <p className="mt-1 text-[11px] text-slate-400">
        Dados de localização © OpenStreetMap
      </p>
    </div>
  );
}
