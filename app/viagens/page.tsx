"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { LocationAutocomplete } from "@/components/location-autocomplete";
import {
  CalendarPlus,
  CheckCircle2,
  FileText,
  Folder,
  Menu,
  Paperclip,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { exportarExcel, exportarPdf } from "@/lib/exportar";
import { Cliente, FuncionarioResumo, Viagem } from "@/lib/financeiro-types";
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
  cliente_id: "",
  voluntario_ids: [] as string[],
  origem: "",
  destino: "",
  data: hoje,
  transporte: "Carro",
  km_inicial: "0",
  km_final: "0",
  custo_km: "0",
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

type Captacao = {
  id: string;
  cliente_id: string;
  mes_referencia: string;
  status: "Pendente" | "Concluída";
  observacoes: string;
  clientes: Pick<Cliente, "id" | "nome" | "telefone" | "cidade" | "estado"> | null;
};

const mesAtual = new Date().toISOString().slice(0, 7);

export default function ViagensPage() {
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [funcionarios, setFuncionarios] = useState<FuncionarioResumo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [captacoes, setCaptacoes] = useState<Captacao[]>([]);
  const [form, setForm] = useState(vazio);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [modal, setModal] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [busca, setBusca] = useState("");
  const [mesSelecionado, setMesSelecionado] = useState("");
  const [modalCaptacao, setModalCaptacao] = useState(false);
  const [captacaoForm, setCaptacaoForm] = useState({ cliente_id: "", mes: mesAtual, observacoes: "" });
  const [mensagem, setMensagem] = useState("");

  async function carregar() {
    if (!supabase) return;
    const [{ data: registros }, { data: pessoas }, { data: clientesAtivos }, { data: captacoesDoBanco }] = await Promise.all([
      supabase
        .from("viagens")
        .select("*, viagem_voluntarios(funcionario_id, funcionarios(nome))")
        .order("data", { ascending: false }),
      supabase
        .from("funcionarios")
        .select("id,nome,status")
        .eq("status", "Ativo")
        .order("nome"),
      supabase
        .from("clientes")
        .select("*")
        .eq("status", "Ativo")
        .order("nome"),
      supabase
        .from("captacoes_clientes")
        .select("*, clientes(id,nome,telefone,cidade,estado)")
        .order("mes_referencia"),
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
    setClientes((clientesAtivos ?? []) as Cliente[]);
    setCaptacoes((captacoesDoBanco ?? []) as unknown as Captacao[]);
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
  const pastasMensais = useMemo(() => {
    const meses = new Set<string>();
    for (let indice = 0; indice < 6; indice++) {
      const data = new Date();
      data.setDate(1);
      data.setMonth(data.getMonth() + indice);
      meses.add(data.toISOString().slice(0, 7));
    }
    captacoes.forEach((item) => meses.add(item.mes_referencia.slice(0, 7)));
    return [...meses].sort().map((mes) => [mes, captacoes.filter((item) => item.mes_referencia.startsWith(mes))] as const);
  }, [captacoes]);
  const captacoesDoMes = mesSelecionado
    ? captacoes.filter((item) => item.mes_referencia.startsWith(mesSelecionado))
    : [];
  const nomeMes = (mes: string) => {
    const [ano, numero] = mes.split("-").map(Number);
    return new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
    }).format(new Date(ano, numero - 1, 1));
  };
  const n = (valor: string) => Number(valor.replace(",", ".")) || 0;
  const custoAluguelForm =
    form.transporte === "Carro alugado"
      ? n(form.quantidade_diarias) * n(form.valor_diaria)
      : 0;
  const custoForm =
    custoAluguelForm +
    n(form.combustivel) +
    n(form.alimentacao) +
    n(form.hospedagem);
  const custoTotal = (v: Viagem) =>
    (v.transporte === "Carro alugado"
      ? (v.quantidade_diarias ?? 0) * (v.valor_diaria ?? 0)
      : 0) +
    v.pedagios +
    v.combustivel +
    v.alimentacao +
    v.hospedagem;
  const resumo = useMemo(
    () => ({
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
        cliente_id: form.cliente_id || null,
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
        pedagios: 0,
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
  async function programarCaptacao(evento: FormEvent) {
    evento.preventDefault();
    if (!supabase || !captacaoForm.cliente_id || !captacaoForm.mes) return;
    const { error } = await supabase.from("captacoes_clientes").insert({
      cliente_id: captacaoForm.cliente_id,
      mes_referencia: `${captacaoForm.mes}-01`,
      observacoes: captacaoForm.observacoes.trim(),
    });
    if (error) {
      setMensagem(error.code === "23505" ? "Esse cliente já está programado nesse mês." : error.message);
      return;
    }
    setMesSelecionado(captacaoForm.mes);
    setCaptacaoForm({ cliente_id: "", mes: captacaoForm.mes, observacoes: "" });
    setModalCaptacao(false);
    setMensagem("Cliente adicionado à pasta de captação.");
    await carregar();
  }
  async function alternarCaptacao(item: Captacao) {
    if (!supabase) return;
    const concluida = item.status !== "Concluída";
    await supabase.from("captacoes_clientes").update({
      status: concluida ? "Concluída" : "Pendente",
      concluida_em: concluida ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", item.id);
    await carregar();
  }
  async function excluirCaptacao(id: string) {
    if (!supabase || !confirm("Remover esse cliente da pasta do mês?")) return;
    await supabase.from("captacoes_clientes").delete().eq("id", id);
    await carregar();
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
          <section className="grid gap-4 sm:grid-cols-3">
            {[
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
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-bold">Rotas por mês</h2>
                <p className="text-xs text-slate-500">
                  Abra uma pasta para ver os clientes programados
                </p>
              </div>
              <button onClick={() => setModalCaptacao(true)} className="flex items-center gap-2 rounded-xl bg-[#b88b32] px-4 py-2 text-sm font-semibold text-white"><CalendarPlus size={17} /> Programar captação</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {pastasMensais.map(([mes, registros]) => {
                const clientesDoMes = new Set(
                  registros.map((v) => v.cliente_id).filter(Boolean),
                ).size;
                return (
                  <button
                    key={mes}
                    onClick={() => setMesSelecionado(mes)}
                    className={`rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 ${mesSelecionado === mes ? "border-amber-400 bg-amber-50" : "bg-white"}`}
                  >
                    <Folder className="mb-3 text-[#b88b32]" fill="currentColor" size={28} />
                    <p className="font-bold capitalize">{nomeMes(mes)}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {clientesDoMes} clientes • {registros.filter((item) => item.status === "Pendente").length} pendentes
                    </p>
                  </button>
                );
              })}
            </div>
            {mesSelecionado && <div className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b p-4"><h3 className="font-bold capitalize">Clientes para captação — {nomeMes(mesSelecionado)}</h3><p className="text-sm text-slate-500">{captacoesDoMes.length} clientes programados</p></div><div className="divide-y">{captacoesDoMes.map((item) => <div key={item.id} className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"><div><p className="font-semibold">{item.clientes?.nome}</p><p className="text-sm text-slate-500">{item.clientes?.cidade} - {item.clientes?.estado} • {item.clientes?.telefone}</p>{item.observacoes && <p className="mt-1 text-xs text-slate-500">{item.observacoes}</p>}</div><div className="flex items-center gap-2"><button onClick={() => alternarCaptacao(item)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${item.status === "Concluída" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}><CheckCircle2 size={16} /> {item.status}</button><button onClick={() => excluirCaptacao(item.id)} className="rounded-xl p-2 text-red-500 hover:bg-red-50" aria-label="Remover"><Trash2 size={17} /></button></div></div>)}{!captacoesDoMes.length && <p className="p-6 text-sm text-slate-500">Nenhum cliente programado nesta pasta.</p>}</div></div>}
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
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-6 py-3">Viagem</th>
                    <th>Voluntários</th>
                    <th>Rota</th>
                    <th>Transporte</th>
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
                        <p className="mt-1 text-xs font-medium text-[#9a6f19]">
                          Cliente: {clientes.find((cliente) => cliente.id === v.cliente_id)?.nome ?? "Não vinculado"}
                        </p>
                      </td>
                      <td>{v.voluntarios.join(", ")}</td>
                      <td>
                        {v.origem}
                        <br />
                        {v.destino}
                      </td>
                      <td>{v.transporte}</td>
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
      {modalCaptacao && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <form onSubmit={programarCaptacao} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between"><div><h2 className="text-xl font-bold">Programar captação</h2><p className="text-sm text-slate-500">Escolha o cliente e a pasta do mês</p></div><button type="button" onClick={() => setModalCaptacao(false)}><X /></button></div>
            <div className="mt-6 grid gap-4">
              <Campo titulo="Cliente"><select required className="campo bg-white" value={captacaoForm.cliente_id} onChange={(e) => setCaptacaoForm({ ...captacaoForm, cliente_id: e.target.value })}><option value="">Selecione...</option>{clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome} — {cliente.cidade}/{cliente.estado}</option>)}</select></Campo>
              <Campo titulo="Mês da captação"><input required type="month" className="campo" value={captacaoForm.mes} onChange={(e) => setCaptacaoForm({ ...captacaoForm, mes: e.target.value })} /></Campo>
              <Campo titulo="Observações"><textarea rows={3} className="w-full rounded-xl border p-3 text-sm outline-none focus:border-amber-500" placeholder="Ex.: Levar documentos do processo." value={captacaoForm.observacoes} onChange={(e) => setCaptacaoForm({ ...captacaoForm, observacoes: e.target.value })} /></Campo>
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t pt-5"><button type="button" onClick={() => setModalCaptacao(false)} className="rounded-xl border px-4 py-2">Cancelar</button><button className="rounded-xl bg-[#b88b32] px-5 py-2 font-semibold text-white">Adicionar à pasta</button></div>
          </form>
        </div>
      )}
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
              <Campo titulo="Cliente">
                <select
                  className="campo bg-white"
                  value={form.cliente_id}
                  onChange={(e) =>
                    setForm({ ...form, cliente_id: e.target.value })
                  }
                >
                  <option value="">Sem cliente vinculado</option>
                  {clientes.map((cliente) => (
                    <option value={cliente.id} key={cliente.id}>
                      {cliente.nome} — {cliente.documento}
                    </option>
                  ))}
                </select>
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
              {(
                [
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
