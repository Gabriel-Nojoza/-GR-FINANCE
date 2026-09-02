import { jsPDF } from "jspdf"

type Linha = Record<string, string | number | boolean | null | undefined>

export function exportarExcel(nome: string, linhas: Linha[]) {
  if (!linhas.length) return
  const colunas = Object.keys(linhas[0])
  const escapar = (valor: Linha[string]) => {
    let texto = String(valor ?? "")
    // Neutraliza injeção de fórmula (CSV injection) ao abrir na planilha.
    if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`
    return `"${texto.replaceAll('"', '""')}"`
  }
  const csv = [colunas.map(escapar).join(";"), ...linhas.map((linha) => colunas.map((coluna) => escapar(linha[coluna])).join(";"))].join("\r\n")
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${nome}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function exportarPdf(nome: string, titulo: string, linhas: string[]) {
  const pdf = new jsPDF()
  pdf.setFontSize(16)
  pdf.text(titulo, 14, 18)
  pdf.setFontSize(9)
  let y = 29

  linhas.forEach((linha) => {
    const partes = pdf.splitTextToSize(linha, 180)
    if (y + partes.length * 5 > 285) {
      pdf.addPage()
      y = 18
    }
    pdf.text(partes, 14, y)
    y += partes.length * 5 + 3
  })

  pdf.save(`${nome}.pdf`)
}
