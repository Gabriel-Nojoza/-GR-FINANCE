"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CheckCheck, CircleAlert, Clock3, Menu, MessageCircleMore, RefreshCw, Search, Send, Smartphone } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { supabase, supabaseConfigurado } from "@/lib/supabase";

type Cliente = { id: string; nome: string; telefone: string };
type Agendamento = {
  id: string; cliente_id: string; mensagem: string; agendada_para: string;
  enviada_em: string | null; status: string; status_entrega: string;
  entregue_em: string | null; visualizada_em: string | null;
  respondida_em: string | null; resposta_texto: string | null;
  clientes: Cliente | null;
};
type Conexao = { estado: string; conectado: boolean; qrcode?: string | null; pairingCode?: string | null };
type Filtro = "Todos" | "Responderam" | "Visualizaram" | "Não responderam";
const filtros: Filtro[] = ["Todos", "Responderam", "Visualizaram", "Não responderam"];

export default function WhatsAppPage() {
  const [sidebar, setSidebar] = useState(false);
  const [conexao, setConexao] = useState<Conexao | null>(null);
  const [carregandoConexao, setCarregandoConexao] = useState(false);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("Todos");
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");

  const carregarMensagens = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("mensagens_agendadas")
      .select("id,cliente_id,mensagem,agendada_para,enviada_em,status,status_entrega,entregue_em,visualizada_em,respondida_em,resposta_texto,clientes(id,nome,telefone)")
      .order("agendada_para", { ascending: false });
    if (error) return setErro(error.message);
    setAgendamentos((data ?? []) as unknown as Agendamento[]);
  }, []);

  const carregarConexao = useCallback(async () => {
    if (!supabase) return;
    setCarregandoConexao(true);
    setErro("");
    const { data, error } = await supabase.functions.invoke("evolution-conexao");
    if (error) setErro(error.message); else setConexao(data as Conexao);
    setCarregandoConexao(false);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const inicio = window.setTimeout(() => {
      void carregarMensagens();
      void carregarConexao();
    }, 0);
    const canal = client.channel("whatsapp-acompanhamento")
      .on("postgres_changes", { event: "*", schema: "public", table: "mensagens_agendadas" }, carregarMensagens)
      .subscribe();
    const intervalo = window.setInterval(carregarMensagens, 15000);
    return () => { window.clearTimeout(inicio); window.clearInterval(intervalo); client.removeChannel(canal); };
  }, [carregarConexao, carregarMensagens]);

  const contagens = useMemo(() => ({
    Todos: agendamentos.length,
    Responderam: agendamentos.filter((i) => i.respondida_em).length,
    Visualizaram: agendamentos.filter((i) => i.visualizada_em && !i.respondida_em).length,
    "Não responderam": agendamentos.filter((i) => i.status === "Enviada" && !i.respondida_em && !i.visualizada_em).length,
  }), [agendamentos]);

  const exibidos = useMemo(() => agendamentos.filter((item) => {
    const corresponde = `${item.clientes?.nome ?? ""} ${item.clientes?.telefone ?? ""} ${item.mensagem}`.toLowerCase().includes(busca.toLowerCase());
    if (!corresponde) return false;
    if (filtro === "Responderam") return Boolean(item.respondida_em);
    if (filtro === "Visualizaram") return Boolean(item.visualizada_em && !item.respondida_em);
    if (filtro === "Não responderam") return item.status === "Enviada" && !item.respondida_em && !item.visualizada_em;
    return true;
  }), [agendamentos, busca, filtro]);

  return <div className="min-h-screen bg-[#f7f5ef] text-[#07142e]">
    <AppSidebar aberto={sidebar} fechar={() => setSidebar(false)} />
    <main className="min-h-screen lg:ml-72">
      <header className="border-b bg-white"><div className="mx-auto flex min-h-20 max-w-[1500px] items-center justify-between gap-4 px-5 py-4 md:px-8">
        <div className="flex items-center gap-4"><button className="lg:hidden" onClick={() => setSidebar(true)} aria-label="Abrir menu"><Menu /></button><div><h1 className="text-xl font-bold">WhatsApp</h1><p className="text-sm text-slate-500">Conexão, entregas, leituras e respostas dos clientes</p></div></div>
        <button onClick={carregarConexao} disabled={carregandoConexao} className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={17} className={carregandoConexao ? "animate-spin" : ""} /> Atualizar</button>
      </div></header>

      <section className="mx-auto max-w-[1500px] space-y-6 p-5 md:p-8">
        {!supabaseConfigurado && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Configure o Supabase para usar o WhatsApp.</p>}
        {erro && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

        <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Smartphone size={22} /></span><div><h2 className="font-bold">WhatsApp do escritório</h2><p className="text-sm text-slate-500">Instância gr-finance</p></div></div><span className={`h-3 w-3 rounded-full ${conexao?.conectado ? "bg-emerald-500" : "bg-red-500"}`} /></div>
            <div className={`mt-5 rounded-xl p-3 text-sm font-medium ${conexao?.conectado ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{carregandoConexao ? "Consultando conexão..." : conexao?.conectado ? "Conectado e pronto para enviar" : "Desconectado — leia o QR Code"}</div>
            {!conexao?.conectado && conexao?.qrcode && <div className="mt-4 text-center">
              <Image src={conexao.qrcode} alt="QR Code do WhatsApp" width={256} height={256} unoptimized className="mx-auto w-64 rounded-xl border bg-white p-2" />
              <p className="mt-3 text-xs text-slate-500">WhatsApp → Aparelhos conectados → Conectar aparelho</p>
            </div>}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Resumo titulo="Enviadas" valor={agendamentos.filter((i) => i.status === "Enviada").length} icon={Send} cor="text-blue-600 bg-blue-50" />
            <Resumo titulo="Visualizadas" valor={contagens.Visualizaram} icon={CheckCheck} cor="text-violet-600 bg-violet-50" />
            <Resumo titulo="Responderam" valor={contagens.Responderam} icon={MessageCircleMore} cor="text-emerald-600 bg-emerald-50" />
            <Resumo titulo="Sem resposta" valor={contagens["Não responderam"]} icon={Clock3} cor="text-amber-700 bg-amber-50" />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="space-y-4 border-b p-5"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-center"><div><h2 className="font-bold">Acompanhamento dos clientes</h2><p className="text-sm text-slate-500">{exibidos.length} mensagens encontradas</p></div><label className="relative"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={busca} onChange={(e) => setBusca(e.target.value)} className="h-10 w-full rounded-xl border bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-amber-500 md:w-72" placeholder="Buscar cliente..." /></label></div>
            <div className="flex gap-2 overflow-x-auto pb-1">{filtros.map((item) => <button key={item} onClick={() => setFiltro(item)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${filtro === item ? "bg-[#07142e] text-white" : "bg-slate-100 text-slate-600"}`}>{item} ({contagens[item]})</button>)}</div>
          </div>
          <div className="divide-y">{exibidos.map((item) => <article key={item.id} className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{item.clientes?.nome ?? "Cliente removido"}</h3><Status item={item} /></div><p className="mt-1 text-sm text-slate-600">{item.mensagem}</p>{item.resposta_texto && <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-900"><b>Resposta:</b> {item.resposta_texto}</p>}<p className="mt-2 text-xs text-slate-400">{item.clientes?.telefone} • Programada para {new Date(item.agendada_para).toLocaleString("pt-BR")}</p></div><div className="text-left text-xs text-slate-500 md:text-right">{item.respondida_em ? `Respondida em ${new Date(item.respondida_em).toLocaleString("pt-BR")}` : item.visualizada_em ? `Visualizada em ${new Date(item.visualizada_em).toLocaleString("pt-BR")}` : item.entregue_em ? `Entregue em ${new Date(item.entregue_em).toLocaleString("pt-BR")}` : item.enviada_em ? `Enviada em ${new Date(item.enviada_em).toLocaleString("pt-BR")}` : "Aguardando envio"}</div></article>)}
            {!exibidos.length && <div className="grid place-items-center p-12 text-center text-slate-500"><CircleAlert className="mb-3" /><p>Nenhuma mensagem neste filtro.</p></div>}
          </div>
        </div>
      </section>
    </main>
  </div>;
}

function Resumo({ titulo, valor, icon: Icone, cor }: { titulo: string; valor: number; icon: typeof Send; cor: string }) {
  return <div className="rounded-2xl border bg-white p-4 shadow-sm"><span className={`grid h-10 w-10 place-items-center rounded-xl ${cor}`}><Icone size={20} /></span><p className="mt-4 text-2xl font-bold">{valor}</p><p className="text-sm text-slate-500">{titulo}</p></div>;
}
function Status({ item }: { item: Agendamento }) {
  const texto = item.respondida_em ? "Respondeu" : item.visualizada_em ? "Visualizou" : item.entregue_em ? "Entregue" : item.status === "Enviada" ? "Enviada" : item.status;
  const classe = item.respondida_em ? "bg-emerald-100 text-emerald-700" : item.visualizada_em ? "bg-violet-100 text-violet-700" : item.status === "Erro" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${classe}`}>{texto}</span>;
}
