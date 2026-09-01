export type StatusPagamento = "Pago" | "Pendente"
export type TipoLancamento = "Receita" | "Despesa"
export type FormaPagamento = "PIX" | "Dinheiro" | "Cartão" | "Transferência"

export type Lancamento = {
  id: string
  descricao: string
  voluntario: string
  voluntario_id?: string | null
  categoria: string
  data: string
  vencimento: string
  tipo: TipoLancamento
  status: StatusPagamento
  forma_pagamento: FormaPagamento
  valor: number
  recorrente: boolean
  comprovante_url?: string | null
  created_at?: string
}

export type Viagem = {
  id: string
  motivo: string
  voluntarios: string[]
  voluntario_ids?: string[]
  origem: string
  destino: string
  data: string
  transporte: string
  km_inicial: number
  km_final: number
  custo_km: number
  quantidade_diarias: number
  valor_diaria: number
  pedagios: number
  combustivel: number
  alimentacao: number
  hospedagem: number
  adiantamento: number
  status: "Planejada" | "Em andamento" | "Concluída"
  prestacao_contas: "Pendente" | "Entregue" | "Aprovada"
  observacoes: string
  comprovante_url?: string | null
  created_at?: string
}

export type FuncionarioResumo = {
  id: string
  nome: string
  status: "Ativo" | "Inativo"
}

export type Categoria = {
  id: string
  nome: string
  cor: string
}
