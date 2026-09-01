"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Download,
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
import {
  Categoria,
  Cliente,
  FormaPagamento,
  FuncionarioResumo,
  Lancamento,
  StatusPagamento,
  TipoLancamento,
} from "@/lib/financeiro-types";
import {
  enviarComprovante,
  supabase,
  supabaseConfigurado,
} from "@/lib/supabase";

const hoje = new Date().toISOString().slice(0, 10);
const categoriasPadrao: Categoria[] = [
  "Custas",
  "Honorários",
  "Viagens",
  "Pessoal",
  "Operacional",
  "Outros",
].map((nome, i) => ({ id: String(i), nome, cor: "#2563eb" }));
const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const vazio = {
  descricao: "",
  cliente_id: "",
  voluntario_id: "",
  categoria: "Custas",
  data: hoje,
  vencimento: hoje,
  tipo: "Despesa" as TipoLancamento,
  status: "Pendente" as StatusPagamento,
  forma_pagamento: "PIX" as FormaPagamento,
  valor: "",
  recorrente: false,
};

export default function LancamentosPage() {
  const [itens, setItens] = useState<Lancamento[]>([]);
  const [funcionarios, setFuncionarios] = useState<FuncionarioResumo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>(categoriasPadrao);
  const [form, setForm] = useState(vazio);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [modal, setModal] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("Todos");
  const [categoria, setCategoria] = useState("Todas");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [novaCategoria, setNovaCategoria] = useState("");

  async function carregar() {
    if (!supabase) return;
    const [
      { data: lancamentos },
      { data: pessoas },
      { data: cats },
      { data: clientesAtivos },
    ] =
      await Promise.all([
        supabase
          .from("lancamentos")
          .select("*")
          .order("data", { ascending: false }),
        supabase
          .from("funcionarios")
          .select("id,nome,status")
          .eq("status", "Ativo")
          .order("nome"),
        supabase.from("categorias").select("*").order("nome"),
        supabase
          .from("clientes")
          .select("*")
          .eq("status", "Ativo")
          .order("nome"),
      ]);
    setItens((lancamentos ?? []) as Lancamento[]);
    setFuncionarios((pessoas ?? []) as FuncionarioResumo[]);
    setClientes((clientesAtivos ?? []) as Cliente[]);
    if (cats?.length) setCategorias(cats as Categoria[]);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void carregar(), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const filtrados = useMemo(
    () =>
      itens.filter((item) => {
        const texto =
          `${item.descricao} ${item.voluntario} ${item.categoria}`.toLowerCase();
        return (
          texto.includes(busca.toLowerCase()) &&
          (tipo === "Todos" || item.tipo === tipo) &&
          (categoria === "Todas" || item.categoria === categoria) &&
          (!inicio || item.data >= inicio) &&
          (!fim || item.data <= fim)
        );
      }),
    [itens, busca, tipo, categoria, inicio, fim],
  );

  const resumo = useMemo(() => {
    const receitas = filtrados
      .filter((i) => i.tipo === "Receita")
      .reduce((s, i) => s + Number(i.valor), 0);
    const despesas = filtrados
      .filter((i) => i.tipo === "Despesa")
      .reduce((s, i) => s + Number(i.valor), 0);
    const pendentes = filtrados
      .filter((i) => i.status === "Pendente")
      .reduce((s, i) => s + Number(i.valor), 0);
    return { receitas, despesas, pendentes, saldo: receitas - despesas };
  }, [filtrados]);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    const pessoa = funcionarios.find((item) => item.id === form.voluntario_id);
    const valor = Number(form.valor.replace(",", "."));
    if (!pessoa || !form.descricao.trim() || valor <= 0) return;
    try {
      setMensagem("Salvando...");
      const comprovante_url = arquivo
        ? await enviarComprovante(arquivo, "lancamentos")
        : null;
      const registro = {
        ...form,
        cliente_id: form.cliente_id || null,
        descricao: form.descricao.trim(),
        voluntario: pessoa.nome,
        valor,
        comprovante_url,
      };
      if (supabase) {
        const { error } = await supabase.from("lancamentos").insert(registro);
        if (error) throw error;
        await carregar();
      } else {
        setItens((atuais) => [
          { id: crypto.randomUUID(), ...registro },
          ...atuais,
        ]);
      }
      setForm(vazio);
      setArquivo(null);
      setModal(false);
      setMensagem("Lançamento salvo com sucesso.");
    } catch (erro) {
      setMensagem(
        erro instanceof Error ? erro.message : "Não foi possível salvar.",
      );
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este lançamento?")) return;
    if (supabase) await supabase.from("lancamentos").delete().eq("id", id);
    setItens((atuais) => atuais.filter((item) => item.id !== id));
  }

  async function adicionarCategoria() {
    const nome = novaCategoria.trim();
    if (
      !nome ||
      categorias.some((item) => item.nome.toLowerCase() === nome.toLowerCase())
    )
      return;
    if (supabase) {
      const { data, error } = await supabase
        .from("categorias")
        .insert({ nome, cor: "#2563eb" })
        .select()
        .single();
      if (error) return setMensagem(error.message);
      setCategorias((atuais) => [...atuais, data as Categoria]);
    } else
      setCategorias((atuais) => [
        ...atuais,
        { id: crypto.randomUUID(), nome, cor: "#2563eb" },
      ]);
    setForm((atual) => ({ ...atual, categoria: nome }));
    setNovaCategoria("");
  }

  const excel = () =>
    exportarExcel(
      "lancamentos",
      filtrados.map((i) => ({
        Data: i.data,
        Vencimento: i.vencimento,
        Descrição: i.descricao,
        Voluntário: i.voluntario,
        Categoria: i.categoria,
        Tipo: i.tipo,
        Pagamento: i.forma_pagamento,
        Status: i.status,
        Valor: i.valor,
        Recorrente: i.recorrente ? "Sim" : "Não",
      })),
    );
  const pdf = () =>
    exportarPdf(
      "lancamentos",
      "Relatório financeiro",
      filtrados.map(
        (i) =>
          `${i.data} | ${i.descricao} | ${i.voluntario} | ${i.tipo} | ${moeda.format(i.valor)} | ${i.status}`,
      ),
    );

  return (
    <div className="min-h-screen bg-[#f7f5ef] text-[#07142e]">
      <AppSidebar aberto={sidebar} fechar={() => setSidebar(false)} />
      <main className="min-h-screen lg:ml-72">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex h-20 max-w-[1500px] items-center justify-between px-5 md:px-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebar(true)}
                className="grid size-10 place-items-center rounded-xl border lg:hidden"
                aria-label="Abrir menu"
              >
                <Menu size={20} />
              </button>
              <div>
                <h1 className="text-lg font-bold">Lançamentos</h1>
                <p className="text-xs text-slate-500">
                  Financeiro, comprovantes e relatórios
                </p>
              </div>
            </div>
            <button
              onClick={() => setModal(true)}
              className="flex items-center gap-2 rounded-xl bg-[#b88b32] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#9f7529]"
            >
              <Plus size={18} />
              Novo lançamento
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-[1500px] p-5 md:p-8">
          {!supabaseConfigurado && <Aviso />}
          {mensagem && (
            <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {mensagem}
            </p>
          )}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Receitas", resumo.receitas, "text-emerald-600"],
              ["Despesas", resumo.despesas, "text-red-600"],
              ["Saldo", resumo.saldo, "text-[#9a6f19]"],
              ["Pendentes", resumo.pendentes, "text-amber-600"],
            ].map(([nome, valor, cor]) => (
              <article
                key={String(nome)}
                className="rounded-2xl border bg-white p-5 shadow-sm"
              >
                <p className="text-sm text-slate-500">{nome}</p>
                <p className={`mt-2 text-2xl font-bold ${cor}`}>
                  {moeda.format(Number(valor))}
                </p>
              </article>
            ))}
          </section>
          <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="border-b p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold">Movimentações</h2>
                  <p className="text-xs text-slate-500">
                    {filtrados.length} registros
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={excel} className="botao-secundario">
                    <Download size={16} />
                    Excel
                  </button>
                  <button onClick={pdf} className="botao-secundario">
                    <FileText size={16} />
                    PDF
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-5">
                <FiltroIcone>
                  <Search size={16} />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Pesquisar..."
                  />
                </FiltroIcone>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className="filtro"
                >
                  <option>Todos</option>
                  <option>Receita</option>
                  <option>Despesa</option>
                </select>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="filtro"
                >
                  <option>Todas</option>
                  {categorias.map((c) => (
                    <option key={c.id}>{c.nome}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                  className="filtro"
                />
                <input
                  type="date"
                  value={fim}
                  onChange={(e) => setFim(e.target.value)}
                  className="filtro"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-6 py-3">Descrição</th>
                    <th>Voluntário</th>
                    <th>Vencimento</th>
                    <th>Pagamento</th>
                    <th>Status</th>
                    <th className="text-right">Valor</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtrados.map((i) => (
                    <tr key={i.id}>
                      <td className="px-6 py-4">
                        <b>{i.descricao}</b>
                        <p className="text-xs text-slate-400">
                          {i.categoria}
                          {i.recorrente ? " • recorrente" : ""}
                        </p>
                      </td>
                      <td>{i.voluntario}</td>
                      <td>{i.vencimento}</td>
                      <td>{i.forma_pagamento}</td>
                      <td>{i.status}</td>
                      <td className="text-right font-bold">
                        {moeda.format(i.valor)}
                      </td>
                      <td className="px-4">
                        {i.comprovante_url && (
                          <a
                            href={i.comprovante_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Paperclip size={16} />
                          </a>
                        )}
                        <button
                          onClick={() => excluir(i.id)}
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
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6"
          >
            <div className="mb-6 flex justify-between">
              <div>
                <h2 className="text-xl font-bold">Novo lançamento</h2>
                <p className="text-sm text-slate-500">
                  Preencha os dados financeiros
                </p>
              </div>
              <button type="button" onClick={() => setModal(false)}>
                <X />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo titulo="Descrição" duplo>
                <input
                  required
                  className="campo"
                  value={form.descricao}
                  onChange={(e) =>
                    setForm({ ...form, descricao: e.target.value })
                  }
                />
              </Campo>
              <Campo titulo="Voluntário">
                <select
                  required
                  className="campo bg-white"
                  value={form.voluntario_id}
                  onChange={(e) =>
                    setForm({ ...form, voluntario_id: e.target.value })
                  }
                >
                  <option value="">Selecione</option>
                  {funcionarios.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
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
              <Campo titulo="Tipo">
                <select
                  className="campo bg-white"
                  value={form.tipo}
                  onChange={(e) =>
                    setForm({ ...form, tipo: e.target.value as TipoLancamento })
                  }
                >
                  <option>Despesa</option>
                  <option>Receita</option>
                </select>
              </Campo>
              <Campo titulo="Valor">
                <input
                  required
                  inputMode="decimal"
                  className="campo"
                  value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: e.target.value })}
                />
              </Campo>
              <Campo titulo="Forma de pagamento">
                <select
                  className="campo bg-white"
                  value={form.forma_pagamento}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      forma_pagamento: e.target.value as FormaPagamento,
                    })
                  }
                >
                  {["PIX", "Dinheiro", "Cartão", "Transferência"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Campo>
              <Campo titulo="Categoria">
                <select
                  className="campo bg-white"
                  value={form.categoria}
                  onChange={(e) =>
                    setForm({ ...form, categoria: e.target.value })
                  }
                >
                  {categorias.map((c) => (
                    <option key={c.id}>{c.nome}</option>
                  ))}
                </select>
              </Campo>
              <Campo titulo="Nova categoria">
                <div className="flex gap-2">
                  <input
                    className="campo"
                    value={novaCategoria}
                    onChange={(e) => setNovaCategoria(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={adicionarCategoria}
                    className="rounded-xl border px-3"
                  >
                    +
                  </button>
                </div>
              </Campo>
              <Campo titulo="Data">
                <input
                  type="date"
                  required
                  className="campo"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                />
              </Campo>
              <Campo titulo="Vencimento">
                <input
                  type="date"
                  required
                  className="campo"
                  value={form.vencimento}
                  onChange={(e) =>
                    setForm({ ...form, vencimento: e.target.value })
                  }
                />
              </Campo>
              <Campo titulo="Status">
                <select
                  className="campo bg-white"
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as StatusPagamento,
                    })
                  }
                >
                  <option>Pendente</option>
                  <option>Pago</option>
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
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.recorrente}
                  onChange={(e) =>
                    setForm({ ...form, recorrente: e.target.checked })
                  }
                />
                Despesa recorrente
              </label>
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
                Salvar
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
    <label className={duplo ? "sm:col-span-2" : ""}>
      <span className="mb-2 block text-sm font-medium">{titulo}</span>
      {children}
    </label>
  );
}
function FiltroIcone({ children }: { children: React.ReactNode }) {
  return (
    <label className="flex h-10 items-center gap-2 rounded-xl border bg-white px-3 text-slate-400 [&_input]:w-full [&_input]:outline-none">
      {children}
    </label>
  );
}
function Aviso() {
  return (
    <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
      Supabase ainda não configurado. Cadastre funcionários e preencha o arquivo
      .env.local para ativar a persistência.
    </p>
  );
}
