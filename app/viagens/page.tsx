"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { LocationAutocomplete } from "@/components/location-autocomplete";
import {
  FileText,
  Menu,
  Paperclip,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { exportarExcel, exportarPdf } from "@/lib/exportar";
import { FuncionarioResumo, Viagem } from "@/lib/financeiro-types";
import {
  enviarComprovante,
  supabase,
  supabaseConfigurado,
} from "@/lib/supabase";

const hoje = new Date().toISOString().slice(0, 10);
const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const vazio = {
  motivo: "",
  voluntario_ids: [] as string[],
  origem: "",
  destino: "",
  data: hoje,
  transporte: "Carro",
  km_inicial: "0",
  km_final: "0",
  custo_km: "0,80",
  quantidade_diarias: "1",
  valor_diaria: "0",
  pedagios: "0",
  combustivel: "0",
  alimentacao: "0",
  hospedagem: "0",
  adiantamento: "0",
  status: "Planejada" as Viagem["status"],
  prestacao_contas: "Pendente" as Viagem["prestacao_contas"],
  observacoes: "",
};

export default function ViagensPage() {
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [funcionarios, setFuncionarios] = useState<FuncionarioResumo[]>([]);
  const [form, setForm] = useState(vazio);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [modal, setModal] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [busca, setBusca] = useState("");
  const [mensagem, setMensagem] = useState("");

  async function carregar() {
    if (!supabase) return;
    const [{ data: registros }, { data: pessoas }] = await Promise.all([
      supabase
        .from("viagens")
        .select("*, viagem_voluntarios(funcionario_id, funcionarios(nome))")
        .order("data", { ascending: false }),
      supabase
        .from("funcionarios")
        .select("id,nome,status")
        .eq("status", "Ativo")
        .order("nome"),
    ]);
    const normalizadas = (registros ?? []).map((item) => {
      const relacoes = (item.viagem_voluntarios ?? []) as Array<{
        funcionario_id: string;
        funcionarios: { nome: string } | null;
      }>;
      return {
        ...item,
        voluntario_ids: relacoes.map((r) => r.funcionario_id),
        voluntarios: relacoes.map((r) => r.funcionarios?.nome).filter(Boolean),
      } as Viagem;
    });
    setViagens(normalizadas);
    setFuncionarios((pessoas ?? []) as FuncionarioResumo[]);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void carregar(), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const filtradas = useMemo(
    () =>
      viagens.filter((v) =>
        `${v.motivo} ${v.origem} ${v.destino} ${v.voluntarios.join(" ")}`
          .toLowerCase()
          .includes(busca.toLowerCase()),
      ),
    [viagens, busca],
  );
  const n = (valor: string) => Number(valor.replace(",", ".")) || 0;
  const distanciaForm = Math.max(0, n(form.km_final) - n(form.km_inicial));
  const custoAluguelForm =
    form.transporte === "Carro alugado"
      ? n(form.quantidade_diarias) * n(form.valor_diaria)
      : 0;
  const custoForm =
    distanciaForm * n(form.custo_km) +
    custoAluguelForm +
    n(form.pedagios) +
    n(form.combustivel) +
    n(form.alimentacao) +
    n(form.hospedagem);
  const custoTotal = (v: Viagem) =>
    (v.km_final - v.km_inicial) * v.custo_km +
    (v.transporte === "Carro alugado"
      ? (v.quantidade_diarias ?? 0) * (v.valor_diaria ?? 0)
      : 0) +
    v.pedagios +
    v.combustivel +
    v.alimentacao +
    v.hospedagem;
  const resumo = useMemo(
    () => ({
      distancia: filtradas.reduce((s, v) => s + v.km_final - v.km_inicial, 0),
      custo: filtradas.reduce((s, v) => s + custoTotal(v), 0),
      adiantamento: filtradas.reduce((s, v) => s + v.adiantamento, 0),
      pendentes: filtradas.filter((v) => v.prestacao_contas === "Pendente")
        .length,
    }),
    [filtradas],
  );

  function alternarVoluntario(id: string) {
    setForm((atual) => ({
      ...atual,
      voluntario_ids: atual.voluntario_ids.includes(id)
        ? atual.voluntario_ids.filter((x) => x !== id)
        : [...atual.voluntario_ids, id],
    }));
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (
      !form.motivo.trim() ||
      !form.voluntario_ids.length ||
      n(form.km_final) < n(form.km_inicial) ||
      (form.transporte === "Carro alugado" &&
        (n(form.quantidade_diarias) < 1 || n(form.valor_diaria) <= 0))
    )
      return;
    try {
      setMensagem("Salvando...");
      const comprovante_url = arquivo
        ? await enviarComprovante(arquivo, "viagens")
        : null;
      const registro = {
        motivo: form.motivo.trim(),
        origem: form.origem.trim(),
        destino: form.destino.trim(),
        data: form.data,
        transporte: form.transporte,
        km_inicial: n(form.km_inicial),
        km_final: n(form.km_final),
        custo_km: n(form.custo_km),
        quantidade_diarias:
          form.transporte === "Carro alugado"
            ? Math.max(1, Math.trunc(n(form.quantidade_diarias)))
            : 0,
        valor_diaria:
          form.transporte === "Carro alugado" ? n(form.valor_diaria) : 0,
        pedagios: n(form.pedagios),
        combustivel: n(form.combustivel),
        alimentacao: n(form.alimentacao),
        hospedagem: n(form.hospedagem),
        adiantamento: n(form.adiantamento),
        status: form.status,
        prestacao_contas: form.prestacao_contas,
        observacoes: form.observacoes.trim(),
        comprovante_url,
      };
      if (supabase) {
        const { data, error } = await supabase
          .from("viagens")
          .insert(registro)
          .select("id")
          .single();
        if (error) throw error;
        const { error: relError } = await supabase
          .from("viagem_voluntarios")
          .insert(
            form.voluntario_ids.map((funcionario_id) => ({
              viagem_id: data.id,
              funcionario_id,
            })),
          );
        if (relError) throw relError;
        await carregar();
      } else {
        setViagens((atuais) => [
          {
            id: crypto.randomUUID(),
            ...registro,
            voluntario_ids: form.voluntario_ids,
            voluntarios: funcionarios
              .filter((p) => form.voluntario_ids.includes(p.id))
              .map((p) => p.nome),
          },
          ...atuais,
        ]);
      }
      setForm(vazio);
      setArquivo(null);
      setModal(false);
      setMensagem("Viagem salva com sucesso.");
    } catch (erro) {
      setMensagem(
        erro instanceof Error ? erro.message : "Não foi possível salvar.",
      );
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta viagem?")) return;
    if (supabase) await supabase.from("viagens").delete().eq("id", id);
    setViagens((atuais) => atuais.filter((v) => v.id !== id));
  }
  const excel = () =>
    exportarExcel(
      "viagens",
      filtradas.map((v) => ({
        Data: v.data,
        Motivo: v.motivo,
        Voluntários: v.voluntarios.join(", "),
        Origem: v.origem,
        Destino: v.destino,
        Transporte: v.transporte,
        Diárias: v.quantidade_diarias ?? 0,
        "Valor da diária": v.valor_diaria ?? 0,
        "Total do aluguel":
          v.transporte === "Carro alugado"
            ? (v.quantidade_diarias ?? 0) * (v.valor_diaria ?? 0)
            : 0,
        Distância: v.km_final - v.km_inicial,
        Custo: custoTotal(v),
        Adiantamento: v.adiantamento,
        Prestação: v.prestacao_contas,
      })),
    );
  const pdf = () =>
    exportarPdf(
      "viagens",
      "Relatório de viagens",
      filtradas.map(
        (v) =>
          `${v.data} | ${v.motivo} | ${v.voluntarios.join(", ")} | ${v.origem} → ${v.destino} | ${moeda.format(custoTotal(v))}`,
      ),
    );

  return (
    <div className="min-h-screen bg-[#f7f5ef] text-[#07142e]">
      <AppSidebar aberto={sidebar} fechar={() => setSidebar(false)} />
      <main className="min-h-screen lg:ml-72">
        <header className="border-b bg-white">
          <div className="mx-auto flex h-20 max-w-[1500px] items-center justify-between px-5 md:px-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebar(true)}
                className="grid size-10 place-items-center rounded-xl border lg:hidden"
              >
                <Menu />
              </button>
              <div>
                <h1 className="text-lg font-bold">Viagens e rotas</h1>
                <p className="text-xs text-slate-500">
                  Custos, quilometragem e prestação de contas
                </p>
              </div>
            </div>
            <button
              onClick={() => setModal(true)}
              className="flex gap-2 rounded-xl bg-[#b88b32] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#9f7529]"
            >
              <Plus size={18} />
              Nova viagem
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-[1500px] p-5 md:p-8">
          {!supabaseConfigurado && <Aviso />}
          {mensagem && (
            <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              {mensagem}
            </p>
          )}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Distância", `${resumo.distancia} km`],
              ["Custo total", moeda.format(resumo.custo)],
              ["Adiantamentos", moeda.format(resumo.adiantamento)],
              ["Prestações pendentes", String(resumo.pendentes)],
            ].map(([t, v]) => (
              <article
                key={t}
                className="rounded-2xl border bg-white p-5 shadow-sm"
              >
                <p className="text-sm text-slate-500">{t}</p>
                <p className="mt-2 text-2xl font-bold">{v}</p>
              </article>
            ))}
          </section>
          <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
              <div>
                <h2 className="font-bold">Viagens cadastradas</h2>
                <p className="text-xs text-slate-500">
                  {filtradas.length} registros
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="flex h-10 items-center gap-2 rounded-xl border px-3">
                  <Search size={16} />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Pesquisar..."
                    className="outline-none"
                  />
                </label>
                <button onClick={excel} className="botao-secundario">
                  Excel
                </button>
                <button onClick={pdf} className="botao-secundario">
                  <FileText size={16} />
                  PDF
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-6 py-3">Viagem</th>
                    <th>Voluntários</th>
                    <th>Rota</th>
                    <th>Transporte</th>
                    <th>Km</th>
                    <th>Prestação</th>
                    <th className="text-right">Custo</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtradas.map((v) => (
                    <tr key={v.id}>
                      <td className="px-6 py-4">
                        <b>{v.motivo}</b>
                        <p className="text-xs text-slate-400">
                          {v.data} • {v.status}
                        </p>
                      </td>
                      <td>{v.voluntarios.join(", ")}</td>
                      <td>
                        {v.origem}
                        <br />
                        {v.destino}
                      </td>
                      <td>{v.transporte}</td>
                      <td>{v.km_final - v.km_inicial} km</td>
                      <td>{v.prestacao_contas}</td>
                      <td className="text-right font-bold">
                        {moeda.format(custoTotal(v))}
                      </td>
                      <td className="px-4">
                        {v.comprovante_url && (
                          <a
                            href={v.comprovante_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Paperclip size={16} />
                          </a>
                        )}
                        <button
                          onClick={() => excluir(v.id)}
                          className="ml-3 text-red-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
      {modal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <form
            onSubmit={salvar}
            className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6"
          >
            <div className="mb-6 flex justify-between">
              <div>
                <h2 className="text-xl font-bold">Nova viagem</h2>
                <p className="text-sm text-slate-500">
                  Planejamento e prestação de contas
                </p>
              </div>
              <button type="button" onClick={() => setModal(false)}>
                <X />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Campo titulo="Motivo" duplo>
                <input
                  required
                  className="campo"
                  value={form.motivo}
                  onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                />
              </Campo>
              <Campo titulo="Origem">
                <LocationAutocomplete
                  value={form.origem}
                  onChange={(origem) => setForm({ ...form, origem })}
                  placeholder="Digite uma cidade ou país"
                />
              </Campo>
              <Campo titulo="Destino">
                <LocationAutocomplete
                  value={form.destino}
                  onChange={(destino) => setForm({ ...form, destino })}
                  placeholder="Digite uma cidade ou país"
                />
              </Campo>
              <Campo titulo="Data">
                <input
                  type="date"
                  className="campo"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                />
              </Campo>
              <Campo titulo="Transporte">
                <select
                  className="campo bg-white"
                  value={form.transporte}
                  onChange={(e) =>
                    setForm({ ...form, transporte: e.target.value })
                  }
                >
                  {[
                    "Carro",
                    "Carro alugado",
                    "Moto",
                    "Ônibus",
                    "Avião",
                    "Aplicativo",
                    "Outro",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Campo>
              {form.transporte === "Carro alugado" && (
                <>
                  <Campo titulo="Quantidade de diárias">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      className="campo"
                      value={form.quantidade_diarias}
                      onChange={(e) =>
                        setForm({ ...form, quantidade_diarias: e.target.value })
                      }
                    />
                  </Campo>
                  <Campo titulo="Valor da diária">
                    <input
                      inputMode="decimal"
                      required
                      className="campo"
                      placeholder="0,00"
                      value={form.valor_diaria}
                      onChange={(e) =>
                        setForm({ ...form, valor_diaria: e.target.value })
                      }
                    />
                  </Campo>
                  <Campo titulo="Total do aluguel">
                    <div className="campo flex items-center bg-amber-50 font-semibold text-[#9a6f19]">
                      {moeda.format(custoAluguelForm)}
                    </div>
                  </Campo>
                </>
              )}
              <Campo titulo="Km inicial">
                <input
                  type="number"
                  min="0"
                  className="campo"
                  value={form.km_inicial}
                  onChange={(e) =>
                    setForm({ ...form, km_inicial: e.target.value })
                  }
                />
              </Campo>
              <Campo titulo="Km final">
                <input
                  type="number"
                  min="0"
                  className="campo"
                  value={form.km_final}
                  onChange={(e) =>
                    setForm({ ...form, km_final: e.target.value })
                  }
                />
              </Campo>
              <Campo titulo="Custo por km">
                <input
                  inputMode="decimal"
                  className="campo"
                  value={form.custo_km}
                  onChange={(e) =>
                    setForm({ ...form, custo_km: e.target.value })
                  }
                />
              </Campo>
              {(
                [
                  "pedagios",
                  "combustivel",
                  "alimentacao",
                  "hospedagem",
                  "adiantamento",
                ] as const
              ).map((nome) => (
                <Campo
                  key={nome}
                  titulo={nome[0].toUpperCase() + nome.slice(1)}
                >
                  <input
                    inputMode="decimal"
                    className="campo"
                    value={form[nome]}
                    onChange={(e) =>
                      setForm({ ...form, [nome]: e.target.value })
                    }
                  />
                </Campo>
              ))}
              <Campo titulo="Status">
                <select
                  className="campo bg-white"
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as Viagem["status"],
                    })
                  }
                >
                  <option>Planejada</option>
                  <option>Em andamento</option>
                  <option>Concluída</option>
                </select>
              </Campo>
              <Campo titulo="Prestação de contas">
                <select
                  className="campo bg-white"
                  value={form.prestacao_contas}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      prestacao_contas: e.target
                        .value as Viagem["prestacao_contas"],
                    })
                  }
                >
                  <option>Pendente</option>
                  <option>Entregue</option>
                  <option>Aprovada</option>
                </select>
              </Campo>
              <Campo titulo="Comprovante">
                <input
                  type="file"
                  accept="image/png,image/jpeg,application/pdf"
                  className="campo pt-2"
                  onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                />
              </Campo>
              <Campo titulo="Voluntários" duplo>
                <div className="grid max-h-32 gap-2 overflow-y-auto rounded-xl border p-3 sm:grid-cols-2">
                  {funcionarios.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={form.voluntario_ids.includes(p.id)}
                        onChange={() => alternarVoluntario(p.id)}
                      />
                      {p.nome}
                    </label>
                  ))}
                </div>
              </Campo>
              <Campo titulo="Observações" duplo>
                <textarea
                  rows={3}
                  className="w-full rounded-xl border p-3 text-sm outline-none focus:border-amber-500"
                  value={form.observacoes}
                  onChange={(e) =>
                    setForm({ ...form, observacoes: e.target.value })
                  }
                />
              </Campo>
            </div>
            <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm">
              <b>Distância calculada:</b> {distanciaForm} km{" "}
              <span className="mx-3">•</span>
              {form.transporte === "Carro alugado" && (
                <>
                  <b>Aluguel:</b> {moeda.format(custoAluguelForm)}{" "}
                  <span className="mx-3">•</span>
                </>
              )}
              <b>Custo total:</b> {moeda.format(custoForm)}{" "}
              <span className="mx-3">•</span>
              <b>Saldo a prestar:</b>{" "}
              {moeda.format(custoForm - n(form.adiantamento))}
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t pt-5">
              <button
                type="button"
                onClick={() => setModal(false)}
                className="rounded-xl border px-4 py-2"
              >
                Cancelar
              </button>
              <button className="rounded-xl bg-[#b88b32] px-5 py-2 text-white hover:bg-[#9f7529]">
                Salvar viagem
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Campo({
  titulo,
  children,
  duplo,
}: {
  titulo: string;
  children: React.ReactNode;
  duplo?: boolean;
}) {
  return (
    <label className={duplo ? "sm:col-span-2 lg:col-span-3" : ""}>
      <span className="mb-2 block text-sm font-medium">{titulo}</span>
      {children}
    </label>
  );
}
function Aviso() {
  return (
    <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
      Supabase ainda não configurado. Cadastre funcionários e preencha o
      .env.local para ativar a persistência.
    </p>
  );
}
