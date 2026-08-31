"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CircleDollarSign,
  Menu,
  ReceiptText,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppSidebar } from "@/components/app-sidebar";
import { Lancamento } from "@/lib/financeiro-types";
import { supabase, supabaseConfigurado } from "@/lib/supabase";

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const cores = [
  "#2563eb",
  "#8b5cf6",
  "#f59e0b",
  "#14b8a6",
  "#ef4444",
  "#64748b",
];

export default function DashboardPage() {
  const [sidebar, setSidebar] = useState(false);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(Boolean(supabase));
  const [erro, setErro] = useState("");

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const timeout = window.setTimeout(async () => {
      const { data, error } = await client
        .from("lancamentos")
        .select("*")
        .order("data", { ascending: false });
      if (error) setErro(error.message);
      else setLancamentos((data ?? []) as Lancamento[]);
      setCarregando(false);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const dados = useMemo(() => {
    const agora = new Date();
    const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
    const atuais = lancamentos.filter((item) => item.data.startsWith(mesAtual));
    const despesas = atuais
      .filter((item) => item.tipo === "Despesa")
      .reduce((s, item) => s + Number(item.valor), 0);
    const receitas = atuais
      .filter((item) => item.tipo === "Receita")
      .reduce((s, item) => s + Number(item.valor), 0);
    const pendentes = atuais
      .filter((item) => item.status === "Pendente")
      .reduce((s, item) => s + Number(item.valor), 0);

    const meses = Array.from({ length: 6 }, (_, indice) => {
      const data = new Date(
        agora.getFullYear(),
        agora.getMonth() - 5 + indice,
        1,
      );
      const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
      return {
        chave,
        mes: data
          .toLocaleDateString("pt-BR", { month: "short" })
          .replace(".", ""),
        valor: 0,
      };
    });
    lancamentos
      .filter((item) => item.tipo === "Despesa")
      .forEach((item) => {
        const mes = meses.find((m) => item.data.startsWith(m.chave));
        if (mes) mes.valor += Number(item.valor);
      });

    const totaisCategorias: Record<string, number> = {};
    atuais
      .filter((item) => item.tipo === "Despesa")
      .forEach((item) => {
        totaisCategorias[item.categoria] =
          (totaisCategorias[item.categoria] ?? 0) + Number(item.valor);
      });
    const categorias = Object.entries(totaisCategorias).map(
      ([nome, valor], indice) => ({
        nome,
        valor,
        cor: cores[indice % cores.length],
      }),
    );
    return {
      despesas,
      receitas,
      pendentes,
      saldo: receitas - despesas,
      meses,
      categorias,
    };
  }, [lancamentos]);

  return (
    <div className="min-h-screen bg-[#f7f5ef] text-[#07142e]">
      <AppSidebar aberto={sidebar} fechar={() => setSidebar(false)} />
      <main className="min-h-screen lg:ml-72">
        <header className="flex h-20 items-center justify-between border-b bg-white px-5 md:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebar(true)}
              className="grid size-10 place-items-center rounded-xl border lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-lg font-bold">Dashboard</h1>
              <p className="text-xs text-slate-500">
                Resumo dos dados cadastrados
              </p>
            </div>
          </div>
          <button className="relative grid size-10 place-items-center rounded-full border text-slate-500">
            <Bell size={18} />
          </button>
        </header>
        <div className="mx-auto max-w-[1500px] p-5 md:p-8">
          {!supabaseConfigurado && (
            <p className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              Configure o Supabase para carregar os dados reais.
            </p>
          )}
          {erro && (
            <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
              {erro}
            </p>
          )}
          {carregando ? (
            <p className="py-16 text-center text-sm text-slate-500">
              Carregando dados...
            </p>
          ) : (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card
                  titulo="Despesas do mês"
                  valor={dados.despesas}
                  icone={<TrendingDown />}
                  cor="bg-red-50 text-red-600"
                />
                <Card
                  titulo="Receitas do mês"
                  valor={dados.receitas}
                  icone={<TrendingUp />}
                  cor="bg-emerald-50 text-emerald-600"
                />
                <Card
                  titulo="Saldo do mês"
                  valor={dados.saldo}
                  icone={<CircleDollarSign />}
                  cor="bg-amber-50 text-[#a97d25]"
                />
                <Card
                  titulo="Valores pendentes"
                  valor={dados.pendentes}
                  icone={<ReceiptText />}
                  cor="bg-amber-50 text-amber-600"
                />
              </section>
              <section className="mt-6 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
                <article className="rounded-2xl border bg-white p-6 shadow-sm">
                  <h2 className="font-bold">Despesas dos últimos 6 meses</h2>
                  <div className="mt-6 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dados.meses}>
                        <CartesianGrid strokeDasharray="4 4" vertical={false} />
                        <XAxis dataKey="mes" />
                        <YAxis tickFormatter={(v) => `${v / 1000}k`} />
                        <Tooltip formatter={(v) => moeda.format(Number(v))} />
                        <Area
                          dataKey="valor"
                          stroke="#2563eb"
                          fill="#dbeafe"
                          strokeWidth={3}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </article>
                <article className="rounded-2xl border bg-white p-6 shadow-sm">
                  <h2 className="font-bold">Despesas por categoria</h2>
                  {dados.categorias.length ? (
                    <>
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={dados.categorias}
                              dataKey="valor"
                              nameKey="nome"
                              innerRadius={55}
                              outerRadius={80}
                            >
                              {dados.categorias.map((item) => (
                                <Cell key={item.nome} fill={item.cor} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(v) => moeda.format(Number(v))}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2">
                        {dados.categorias.map((item) => (
                          <p
                            key={item.nome}
                            className="flex justify-between text-sm"
                          >
                            <span className="text-slate-500">{item.nome}</span>
                            <b>{moeda.format(item.valor)}</b>
                          </p>
                        ))}
                      </div>
                    </>
                  ) : (
                    <Vazio texto="Nenhuma despesa cadastrada neste mês." />
                  )}
                </article>
              </section>
              <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
                <div className="flex items-center justify-between p-6">
                  <div>
                    <h2 className="font-bold">Lançamentos recentes</h2>
                    <p className="text-xs text-slate-500">
                      Dados registrados no Supabase
                    </p>
                  </div>
                  <Link
                    href="/lancamentos"
                    className="text-sm font-semibold text-[#9a6f19]"
                  >
                    Ver todos
                  </Link>
                </div>
                {lancamentos.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[650px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-400">
                        <tr>
                          <th className="px-6 py-3">Descrição</th>
                          <th>Voluntário</th>
                          <th>Data</th>
                          <th>Status</th>
                          <th className="px-6 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {lancamentos.slice(0, 5).map((item) => (
                          <tr key={item.id}>
                            <td className="px-6 py-4">
                              <b>{item.descricao}</b>
                              <p className="text-xs text-slate-400">
                                {item.categoria}
                              </p>
                            </td>
                            <td>{item.voluntario}</td>
                            <td>{item.data}</td>
                            <td>{item.status}</td>
                            <td
                              className={`px-6 text-right font-bold ${item.tipo === "Receita" ? "text-emerald-600" : "text-red-600"}`}
                            >
                              {item.tipo === "Receita" ? "+" : "-"}{" "}
                              {moeda.format(item.valor)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Vazio texto="Nenhum lançamento cadastrado." />
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Card({
  titulo,
  valor,
  icone,
  cor,
}: {
  titulo: string;
  valor: number;
  icone: React.ReactNode;
  cor: string;
}) {
  return (
    <article className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{titulo}</p>
          <p className="mt-2 text-2xl font-bold">{moeda.format(valor)}</p>
        </div>
        <span className={`grid size-11 place-items-center rounded-xl ${cor}`}>
          {icone}
        </span>
      </div>
    </article>
  );
}
function Vazio({ texto }: { texto: string }) {
  return (
    <div className="grid min-h-40 place-items-center p-8 text-center text-sm text-slate-400">
      {texto}
    </div>
  );
}
