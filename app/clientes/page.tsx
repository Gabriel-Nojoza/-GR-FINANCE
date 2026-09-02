"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarClock, Eye, Menu, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { Cliente, Lancamento, Viagem } from "@/lib/financeiro-types";
import { supabase, supabaseConfigurado } from "@/lib/supabase";

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const vazio = {
  nome: "",
  documento: "",
  email: "",
  telefone: "",
  aceita_whatsapp: false,
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  observacoes: "",
  status: "Ativo" as Cliente["status"],
};

type MensagemAgendada = {
  id: string;
  cliente_id: string;
  mensagem: string;
  template_nome: string;
  agendada_para: string;
  status: "Pendente" | "Processando" | "Enviada" | "Erro" | "Cancelada";
  erro?: string | null;
};

function custoViagem(v: Viagem) {
  return (
    (Number(v.km_final) - Number(v.km_inicial)) * Number(v.custo_km) +
    (v.transporte === "Carro alugado"
      ? Number(v.quantidade_diarias ?? 0) * Number(v.valor_diaria ?? 0)
      : 0) +
    Number(v.pedagios) +
    Number(v.combustivel) +
    Number(v.alimentacao) +
    Number(v.hospedagem)
  );
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [form, setForm] = useState(vazio);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [detalhe, setDetalhe] = useState<Cliente | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [mensagensAgendadas, setMensagensAgendadas] = useState<MensagemAgendada[]>([]);
  const [agendamento, setAgendamento] = useState({
    template_nome: "lembrete_atendimento",
    mensagem: "",
    agendada_para: "",
  });

  async function carregar() {
    if (!supabase) return;
    const [
      { data: pessoas },
      { data: financeiros },
      { data: deslocamentos },
      { data: mensagensProgramadas },
    ] =
      await Promise.all([
        supabase.from("clientes").select("*").order("nome"),
        supabase
          .from("lancamentos")
          .select("*")
          .order("data", { ascending: false }),
        supabase.from("viagens").select("*").order("data", { ascending: false }),
        supabase
          .from("mensagens_agendadas")
          .select("*")
          .order("agendada_para", { ascending: false }),
      ]);
    setClientes((pessoas ?? []) as Cliente[]);
    setLancamentos((financeiros ?? []) as Lancamento[]);
    setViagens((deslocamentos ?? []) as Viagem[]);
    setMensagensAgendadas((mensagensProgramadas ?? []) as MensagemAgendada[]);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void carregar(), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const filtrados = useMemo(() => {
    const termo = busca.toLowerCase();
    return clientes.filter((cliente) =>
      `${cliente.nome} ${cliente.documento} ${cliente.cidade} ${cliente.estado}`
        .toLowerCase()
        .includes(termo),
    );
  }, [clientes, busca]);

  const gastosCliente = (clienteId: string) => {
    const despesas = lancamentos.filter(
      (item) => item.cliente_id === clienteId && item.tipo === "Despesa",
    );
    const deslocamentos = viagens.filter((item) => item.cliente_id === clienteId);
    const totalLancamentos = despesas.reduce(
      (soma, item) => soma + Number(item.valor),
      0,
    );
    const totalViagens = deslocamentos.reduce(
      (soma, item) => soma + custoViagem(item),
      0,
    );
    return {
      despesas,
      deslocamentos,
      totalLancamentos,
      totalViagens,
      total: totalLancamentos + totalViagens,
    };
  };

  function abrirNovo() {
    setEditandoId(null);
    setForm(vazio);
    setModal(true);
  }

  function abrirEdicao(cliente: Cliente) {
    setEditandoId(cliente.id);
    setForm({
      nome: cliente.nome,
      documento: cliente.documento,
      email: cliente.email ?? "",
      telefone: cliente.telefone ?? "",
      aceita_whatsapp: cliente.aceita_whatsapp ?? false,
      cep: cliente.cep ?? "",
      endereco: cliente.endereco ?? "",
      numero: cliente.numero ?? "",
      complemento: cliente.complemento ?? "",
      bairro: cliente.bairro ?? "",
      cidade: cliente.cidade ?? "",
      estado: cliente.estado ?? "",
      observacoes: cliente.observacoes ?? "",
      status: cliente.status,
    });
    setDetalhe(null);
    setModal(true);
  }

  function fecharModal() {
    setModal(false);
    setEditandoId(null);
    setForm(vazio);
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!supabase || !form.nome.trim() || !form.documento.trim()) return;
    setMensagem("Salvando...");
    const dados = {
      ...form,
      nome: form.nome.trim(),
      documento: form.documento.trim(),
      cidade: form.cidade.trim(),
      estado: form.estado.trim().toUpperCase(),
    };
    const { error } = editandoId
      ? await supabase
          .from("clientes")
          .update({ ...dados, updated_at: new Date().toISOString() })
          .eq("id", editandoId)
      : await supabase.from("clientes").insert(dados);
    if (error) return setMensagem(error.message);
    fecharModal();
    setMensagem(
      editandoId ? "Cliente atualizado com sucesso." : "Cliente salvo com sucesso.",
    );
    await carregar();
  }

  async function excluir(cliente: Cliente) {
    if (!supabase || !confirm(`Excluir o cliente ${cliente.nome}?`)) return;
    const { error } = await supabase.from("clientes").delete().eq("id", cliente.id);
    if (error) return setMensagem(error.message);
    setDetalhe(null);
    await carregar();
  }

  async function agendarMensagem(evento: FormEvent) {
    evento.preventDefault();
    if (
      !supabase ||
      !detalhe ||
      !detalhe.aceita_whatsapp ||
      !numeroWhatsApp ||
      !agendamento.mensagem.trim() ||
      !agendamento.agendada_para
    )
      return;
    const { error } = await supabase.from("mensagens_agendadas").insert({
      cliente_id: detalhe.id,
      telefone: numeroWhatsApp,
      template_nome: agendamento.template_nome.trim(),
      mensagem: agendamento.mensagem.trim(),
      agendada_para: new Date(agendamento.agendada_para).toISOString(),
    });
    if (error) return setMensagem(error.message);
    setAgendamento({
      template_nome: "lembrete_atendimento",
      mensagem: "",
      agendada_para: "",
    });
    setMensagem("Mensagem agendada com sucesso.");
    await carregar();
  }

  const resumoDetalhe = detalhe ? gastosCliente(detalhe.id) : null;
  const telefoneNumerico = detalhe?.telefone.replace(/\D/g, "") ?? "";
  const numeroWhatsApp =
    telefoneNumerico.length === 10 || telefoneNumerico.length === 11
      ? `55${telefoneNumerico}`
      : telefoneNumerico;
  const mensagensDoCliente = detalhe
    ? mensagensAgendadas.filter((item) => item.cliente_id === detalhe.id)
    : [];

  return (
    <div className="min-h-screen bg-[#f7f5ef] text-[#07142e]">
      <AppSidebar aberto={sidebar} fechar={() => setSidebar(false)} />
      <main className="min-h-screen lg:ml-72">
        <header className="border-b bg-white">
          <div className="mx-auto flex h-20 max-w-[1500px] items-center justify-between px-5 md:px-8">
            <div className="flex items-center gap-4">
              <button className="lg:hidden" onClick={() => setSidebar(true)}>
                <Menu />
              </button>
              <div>
                <h1 className="text-xl font-bold">Clientes</h1>
                <p className="text-sm text-slate-500">
                  Cadastro e custos de atendimento por cliente
                </p>
              </div>
            </div>
            <button
              onClick={abrirNovo}
              className="flex items-center gap-2 rounded-xl bg-[#b88b32] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#9f7529]"
            >
              <Plus size={18} /> Novo cliente
            </button>
          </div>
        </header>

        <section className="mx-auto max-w-[1500px] p-5 md:p-8">
          {!supabaseConfigurado && (
            <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              Configure o Supabase para cadastrar clientes.
            </p>
          )}
          {mensagem && (
            <p className="mb-4 rounded-xl bg-white p-3 text-sm shadow-sm">{mensagem}</p>
          )}
          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-4 border-b p-5 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-bold">Clientes cadastrados</h2>
                <p className="text-sm text-slate-500">{filtrados.length} registros</p>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  className="h-10 w-full rounded-xl border bg-slate-50 pl-10 pr-4 text-sm outline-none focus:border-amber-500 sm:w-72"
                  placeholder="Buscar cliente..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Cliente</th>
                    <th>CPF/CNPJ</th>
                    <th>Localização</th>
                    <th>Telefone</th>
                    <th>Gastos acumulados</th>
                    <th className="px-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((cliente) => (
                    <tr key={cliente.id} className="border-t hover:bg-amber-50/30">
                      <td className="px-6 py-4 font-semibold">{cliente.nome}</td>
                      <td>{cliente.documento}</td>
                      <td>{[cliente.cidade, cliente.estado].filter(Boolean).join(" / ")}</td>
                      <td>{cliente.telefone || "—"}</td>
                      <td className="font-semibold text-[#9a6f19]">
                        {moeda.format(gastosCliente(cliente.id).total)}
                      </td>
                      <td className="px-6 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => abrirEdicao(cliente)}
                            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-slate-50"
                          >
                            <Pencil size={16} /> Editar
                          </button>
                          <button
                            onClick={() => setDetalhe(cliente)}
                            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-slate-50"
                          >
                            <Eye size={16} /> Ver gastos
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!filtrados.length && (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">Nenhum cliente cadastrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {modal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4">
          <form onSubmit={salvar} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6">
            <div className="mb-6 flex items-start justify-between">
              <div><h2 className="text-xl font-bold">{editandoId ? "Editar cliente" : "Novo cliente"}</h2><p className="text-sm text-slate-500">Dados pessoais, contato e endereço</p></div>
              <button type="button" onClick={fecharModal}><X /></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo titulo="Nome/Razão social" duplo><input required className="campo" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Campo>
              <Campo titulo="CPF/CNPJ"><input required className="campo" value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} /></Campo>
              <Campo titulo="Telefone/WhatsApp"><input type="tel" className="campo" placeholder="(85) 99999-9999" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></Campo>
              <Campo titulo="E-mail"><input type="email" className="campo" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Campo>
              <Campo titulo="CEP"><input className="campo" value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} /></Campo>
              <Campo titulo="Endereço" duplo><input className="campo" value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} /></Campo>
              <Campo titulo="Número"><input className="campo" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></Campo>
              <Campo titulo="Complemento"><input className="campo" value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} /></Campo>
              <Campo titulo="Bairro"><input className="campo" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} /></Campo>
              <Campo titulo="Cidade"><input required className="campo" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></Campo>
              <Campo titulo="Estado (UF)"><input required maxLength={2} className="campo uppercase" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} /></Campo>
              <Campo titulo="Status"><select className="campo bg-white" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Cliente["status"] })}><option>Ativo</option><option>Inativo</option></select></Campo>
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.aceita_whatsapp} onChange={(e) => setForm({ ...form, aceita_whatsapp: e.target.checked })} /> Cliente autoriza o recebimento de mensagens pelo WhatsApp</label>
              <Campo titulo="Observações" duplo><textarea rows={3} className="w-full rounded-xl border p-3 text-sm outline-none focus:border-amber-500" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></Campo>
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t pt-5"><button type="button" onClick={fecharModal} className="rounded-xl border px-4 py-2">Cancelar</button><button className="rounded-xl bg-[#b88b32] px-5 py-2 font-semibold text-white hover:bg-[#9f7529]">{editandoId ? "Salvar alterações" : "Salvar cliente"}</button></div>
          </form>
        </div>
      )}

      {detalhe && resumoDetalhe && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4">
          <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6">
            <div className="flex items-start justify-between">
              <div><h2 className="text-2xl font-bold">{detalhe.nome}</h2><p className="text-sm text-slate-500">{detalhe.documento} • {[detalhe.cidade, detalhe.estado].filter(Boolean).join(" / ")}</p></div>
              <button onClick={() => setDetalhe(null)}><X /></button>
            </div>
            <div className="my-6 grid gap-3 sm:grid-cols-3">
              <Resumo titulo="Despesas lançadas" valor={moeda.format(resumoDetalhe.totalLancamentos)} />
              <Resumo titulo="Custos de viagens" valor={moeda.format(resumoDetalhe.totalViagens)} />
              <Resumo titulo="Custo total do cliente" valor={moeda.format(resumoDetalhe.total)} destaque />
            </div>
            <h3 className="mb-2 font-bold">Lançamentos relacionados</h3>
            <div className="mb-6 overflow-hidden rounded-xl border">
              {resumoDetalhe.despesas.map((item) => <div key={item.id} className="flex justify-between gap-4 border-b p-3 text-sm last:border-0"><span>{item.data} • {item.descricao} <small className="text-slate-500">({item.categoria})</small></span><b>{moeda.format(Number(item.valor))}</b></div>)}
              {!resumoDetalhe.despesas.length && <p className="p-4 text-sm text-slate-500">Nenhuma despesa vinculada.</p>}
            </div>
            <h3 className="mb-2 font-bold">Viagens ao cliente</h3>
            <div className="overflow-hidden rounded-xl border">
              {resumoDetalhe.deslocamentos.map((item) => <div key={item.id} className="flex justify-between gap-4 border-b p-3 text-sm last:border-0"><span>{item.data} • {item.motivo}<small className="block text-slate-500">{item.origem} → {item.destino} • {item.transporte}</small></span><b>{moeda.format(custoViagem(item))}</b></div>)}
              {!resumoDetalhe.deslocamentos.length && <p className="p-4 text-sm text-slate-500">Nenhuma viagem vinculada.</p>}
            </div>
            <div className="mt-6 rounded-2xl border bg-slate-50 p-4">
              <h3 className="flex items-center gap-2 font-bold"><CalendarClock size={18} /> Agendar mensagem automática</h3>
              {!detalhe.aceita_whatsapp || !numeroWhatsApp ? (
                <p className="mt-2 text-sm text-amber-800">Cadastre um telefone e marque a autorização de WhatsApp para habilitar o agendamento.</p>
              ) : (
                <form onSubmit={agendarMensagem} className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="sm:col-span-2"><span className="mb-1 block text-xs font-medium">Data e horário</span><input required type="datetime-local" className="campo" value={agendamento.agendada_para} onChange={(e) => setAgendamento({ ...agendamento, agendada_para: e.target.value })} /></label>
                  <label className="sm:col-span-2"><span className="mb-1 block text-xs font-medium">Mensagem</span><textarea required rows={3} className="w-full rounded-xl border bg-white p-3 text-sm outline-none focus:border-amber-500" placeholder="Ex.: Olá! Lembramos que sua visita está marcada para amanhã às 09:00." value={agendamento.mensagem} onChange={(e) => setAgendamento({ ...agendamento, mensagem: e.target.value })} /></label>
                  <button className="rounded-xl bg-[#b88b32] px-4 py-2 text-sm font-semibold text-white sm:col-span-2">Programar mensagem</button>
                </form>
              )}
              <div className="mt-4 space-y-2">
                {mensagensDoCliente.map((item) => <div key={item.id} className="flex flex-wrap justify-between gap-2 rounded-xl border bg-white p-3 text-sm"><span>{new Date(item.agendada_para).toLocaleString("pt-BR")} • {item.mensagem}</span><b className={item.status === "Enviada" ? "text-emerald-600" : item.status === "Erro" ? "text-red-600" : "text-amber-700"}>{item.status}</b></div>)}
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-between gap-3 border-t pt-5"><button onClick={() => excluir(detalhe)} className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-red-600 hover:bg-red-50"><Trash2 size={17} /> Excluir cliente</button><div className="flex gap-2"><button onClick={() => abrirEdicao(detalhe)} className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"><Pencil size={16} /> Editar</button>{numeroWhatsApp && detalhe.aceita_whatsapp && <a href={`https://wa.me/${numeroWhatsApp}`} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-600 px-5 py-2 text-white hover:bg-emerald-700">Enviar WhatsApp</a>}<button onClick={() => setDetalhe(null)} className="rounded-xl bg-[#07142e] px-5 py-2 text-white">Fechar</button></div></div>
          </div>
        </div>
      )}
    </div>
  );
}

function Campo({ titulo, duplo, children }: { titulo: string; duplo?: boolean; children: React.ReactNode }) {
  return <label className={duplo ? "sm:col-span-2" : ""}><span className="mb-2 block text-sm font-medium">{titulo}</span>{children}</label>;
}

function Resumo({ titulo, valor, destaque }: { titulo: string; valor: string; destaque?: boolean }) {
  return <div className={`rounded-xl border p-4 ${destaque ? "border-amber-300 bg-amber-50" : "bg-slate-50"}`}><p className="text-xs uppercase text-slate-500">{titulo}</p><p className="mt-1 text-xl font-bold">{valor}</p></div>;
}
