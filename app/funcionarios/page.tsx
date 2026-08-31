"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  Mail,
  Menu,
  Phone,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserRound,
  Users,
  UserX,
  X,
} from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"

type StatusFuncionario = "Ativo" | "Inativo"

type Funcionario = {
  id: string
  nome: string
  cargo: string
  email: string
  telefone: string
  dataEntrada: string
  status: StatusFuncionario
}

function formatarData(data: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
  }).format(new Date(`${data}T00:00:00Z`))
}

export default function FuncionariosPage() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])

  const [sidebarAberto, setSidebarAberto] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [busca, setBusca] = useState("")
  const [filtroStatus, setFiltroStatus] = useState("Todos")

  const [formulario, setFormulario] = useState({
    nome: "",
    cargo: "",
    email: "",
    telefone: "",
    dataEntrada: "",
    status: "Ativo" as StatusFuncionario,
  })

  useEffect(() => {
    async function carregarFuncionarios() {
      if (!supabase) return
      const { data } = await supabase
        .from("funcionarios")
        .select("*")
        .order("nome")

      setFuncionarios((data ?? []).map((item) => ({
        id: item.id,
        nome: item.nome,
        cargo: item.cargo,
        email: item.email,
        telefone: item.telefone,
        dataEntrada: item.data_entrada,
        status: item.status as StatusFuncionario,
      })))
    }

    void carregarFuncionarios()
  }, [])

  const resumo = useMemo(() => {
    const ativos = funcionarios.filter(
      (funcionario) => funcionario.status === "Ativo",
    ).length

    const inativos = funcionarios.filter(
      (funcionario) => funcionario.status === "Inativo",
    ).length

    return {
      total: funcionarios.length,
      ativos,
      inativos,
    }
  }, [funcionarios])

  const funcionariosFiltrados = funcionarios.filter(
    (funcionario) => {
      const texto = `
        ${funcionario.nome}
        ${funcionario.cargo}
        ${funcionario.email}
        ${funcionario.telefone}
      `.toLowerCase()

      const correspondeBusca = texto.includes(
        busca.toLowerCase(),
      )

      const correspondeStatus =
        filtroStatus === "Todos" ||
        funcionario.status === filtroStatus

      return correspondeBusca && correspondeStatus
    },
  )

  async function cadastrarFuncionario(
    evento: FormEvent<HTMLFormElement>,
  ) {
    evento.preventDefault()

    if (
      !formulario.nome.trim() ||
      !formulario.cargo.trim() ||
      !formulario.email.trim() ||
      !formulario.telefone.trim() ||
      !formulario.dataEntrada
    ) {
      return
    }

    const dados = {
      nome: formulario.nome.trim(),
      cargo: formulario.cargo.trim(),
      email: formulario.email.trim(),
      telefone: formulario.telefone.trim(),
      data_entrada: formulario.dataEntrada,
      status: formulario.status,
    }

    if (supabase) {
      const { data, error } = await supabase
        .from("funcionarios")
        .insert(dados)
        .select()
        .single()

      if (error) return
      setFuncionarios((listaAtual) => [{
        id: data.id,
        nome: data.nome,
        cargo: data.cargo,
        email: data.email,
        telefone: data.telefone,
        dataEntrada: data.data_entrada,
        status: data.status as StatusFuncionario,
      }, ...listaAtual])
    } else {
      setFuncionarios((listaAtual) => [{
        id: crypto.randomUUID(),
        ...dados,
        dataEntrada: dados.data_entrada,
      }, ...listaAtual])
    }

    setFormulario({
      nome: "",
      cargo: "",
      email: "",
      telefone: "",
      dataEntrada: "",
      status: "Ativo",
    })

    setModalAberto(false)
  }

  async function excluirFuncionario(id: string) {
    if (!confirm("Excluir este funcionário?")) return
    if (supabase) await supabase.from("funcionarios").delete().eq("id", id)
    setFuncionarios((listaAtual) =>
      listaAtual.filter(
        (funcionario) => funcionario.id !== id,
      ),
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f5ef] text-[#07142e]">
      <AppSidebar aberto={sidebarAberto} fechar={() => setSidebarAberto(false)} />

      <main className="min-h-screen lg:ml-72">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex h-20 max-w-[1500px] items-center justify-between px-5 md:px-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarAberto(true)}
                aria-label="Abrir menu"
                className="grid size-10 place-items-center rounded-xl border border-slate-200 lg:hidden"
              >
                <Menu size={20} />
              </button>

              <div>
                <h1 className="text-lg font-bold">
                  Funcionários
                </h1>

                <p className="text-xs text-slate-500">
                  Gerencie funcionários e voluntários
                </p>
              </div>
            </div>

            <button
              onClick={() => setModalAberto(true)}
              className="flex items-center gap-2 rounded-xl bg-[#b88b32] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#9f7529]"
            >
              <Plus size={18} />

              <span className="hidden sm:inline">
                Novo funcionário
              </span>

              <span className="sm:hidden">Novo</span>
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] p-5 md:p-8">
          <section className="grid gap-4 md:grid-cols-3">
            <CardResumo
              titulo="Total cadastrado"
              valor={resumo.total}
              icone={<Users size={21} />}
              cor="bg-amber-50 text-[#a97d25]"
            />

            <CardResumo
              titulo="Ativos"
              valor={resumo.ativos}
              icone={<UserCheck size={21} />}
              cor="bg-emerald-50 text-emerald-600"
            />

            <CardResumo
              titulo="Inativos"
              valor={resumo.inativos}
              icone={<UserX size={21} />}
              cor="bg-red-50 text-red-600"
            />
          </section>

          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between md:p-6">
              <div>
                <h2 className="font-bold">
                  Pessoas cadastradas
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {funcionariosFiltrados.length} registros encontrados
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="relative">
                  <Search
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={busca}
                    onChange={(evento) =>
                      setBusca(evento.target.value)
                    }
                    placeholder="Buscar funcionário..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none focus:border-amber-500 sm:w-64"
                  />
                </label>

                <select
                  value={filtroStatus}
                  onChange={(evento) =>
                    setFiltroStatus(evento.target.value)
                  }
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                >
                  <option>Todos</option>
                  <option>Ativo</option>
                  <option>Inativo</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-6 py-3">Nome</th>
                    <th className="px-4 py-3">Contato</th>
                    <th className="px-4 py-3">Entrada</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="w-16 px-4 py-3" />
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {funcionariosFiltrados.map((funcionario) => (
                    <tr
                      key={funcionario.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="grid size-10 place-items-center rounded-full bg-amber-50 font-bold text-[#a97d25]">
                            {funcionario.nome
                              .split(" ")
                              .slice(0, 2)
                              .map((nome) => nome[0])
                              .join("")
                              .toUpperCase()}
                          </span>

                          <div>
                            <p className="text-sm font-medium">
                              {funcionario.nome}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {funcionario.cargo}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <p className="flex items-center gap-2 text-sm text-slate-600">
                          <Mail size={14} />
                          {funcionario.email}
                        </p>

                        <p className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                          <Phone size={14} />
                          {funcionario.telefone}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-500">
                        {formatarData(funcionario.dataEntrada)}
                      </td>

                      <td className="px-4 py-4">
                        <Status status={funcionario.status} />
                      </td>

                      <td className="px-4 py-4">
                        <button
                          onClick={() =>
                            excluirFuncionario(funcionario.id)
                          }
                          aria-label={`Excluir ${funcionario.nome}`}
                          className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {funcionariosFiltrados.length === 0 && (
                <div className="py-16 text-center">
                  <UserRound
                    size={36}
                    className="mx-auto text-slate-300"
                  />

                  <p className="mt-3 font-semibold">
                    Nenhum funcionário encontrado
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Altere os filtros ou adicione um cadastro.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {modalAberto && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) {
              setModalAberto(false)
            }
          }}
        >
          <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white p-5 sm:px-6">
              <div>
                <h2 className="text-lg font-bold">
                  Novo funcionário
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Preencha os dados da pessoa
                </p>
              </div>

              <button
                onClick={() => setModalAberto(false)}
                aria-label="Fechar"
                className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={cadastrarFuncionario}
              className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6"
            >
              <Campo texto="Nome completo" ocuparDuasColunas>
                <input
                  required
                  value={formulario.nome}
                  onChange={(evento) =>
                    setFormulario({
                      ...formulario,
                      nome: evento.target.value,
                    })
                  }
                  placeholder="Ex.: Ana Beatriz Souza"
                  className="campo"
                />
              </Campo>

              <Campo texto="Função ou cargo" ocuparDuasColunas>
                <input
                  required
                  value={formulario.cargo}
                  onChange={(evento) =>
                    setFormulario({
                      ...formulario,
                      cargo: evento.target.value,
                    })
                  }
                  placeholder="Ex.: Voluntário jurídico"
                  className="campo"
                />
              </Campo>

              <Campo texto="E-mail">
                <input
                  required
                  type="email"
                  value={formulario.email}
                  onChange={(evento) =>
                    setFormulario({
                      ...formulario,
                      email: evento.target.value,
                    })
                  }
                  placeholder="nome@email.com"
                  className="campo"
                />
              </Campo>

              <Campo texto="Telefone">
                <input
                  required
                  type="tel"
                  value={formulario.telefone}
                  onChange={(evento) =>
                    setFormulario({
                      ...formulario,
                      telefone: evento.target.value,
                    })
                  }
                  placeholder="(85) 99999-9999"
                  className="campo"
                />
              </Campo>

              <Campo texto="Data de entrada">
                <input
                  required
                  type="date"
                  value={formulario.dataEntrada}
                  onChange={(evento) =>
                    setFormulario({
                      ...formulario,
                      dataEntrada: evento.target.value,
                    })
                  }
                  className="campo"
                />
              </Campo>

              <Campo texto="Status">
                <select
                  value={formulario.status}
                  onChange={(evento) =>
                    setFormulario({
                      ...formulario,
                      status: evento.target
                        .value as StatusFuncionario,
                    })
                  }
                  className="campo bg-white"
                >
                  <option>Ativo</option>
                  <option>Inativo</option>
                </select>
              </Campo>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="rounded-xl bg-[#b88b32] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#9f7529]"
                >
                  Salvar funcionário
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

function CardResumo({
  titulo,
  valor,
  icone,
  cor,
}: {
  titulo: string
  valor: number
  icone: React.ReactNode
  cor: string
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {titulo}
          </p>

          <p className="mt-2 text-2xl font-bold">
            {valor}
          </p>
        </div>

        <div
          className={`grid size-11 place-items-center rounded-xl ${cor}`}
        >
          {icone}
        </div>
      </div>
    </article>
  )
}

function Status({
  status,
}: {
  status: StatusFuncionario
}) {
  const cor =
    status === "Ativo"
      ? "bg-emerald-50 text-emerald-700"
      : "bg-red-50 text-red-700"

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${cor}`}
    >
      {status}
    </span>
  )
}

function Campo({
  texto,
  ocuparDuasColunas = false,
  children,
}: {
  texto: string
  ocuparDuasColunas?: boolean
  children: React.ReactNode
}) {
  return (
    <label
      className={
        ocuparDuasColunas ? "sm:col-span-2" : ""
      }
    >
      <span className="mb-2 block text-sm font-medium">
        {texto}
      </span>

      {children}
    </label>
  )
}
