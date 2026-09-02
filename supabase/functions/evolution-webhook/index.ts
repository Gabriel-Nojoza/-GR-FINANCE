// @ts-nocheck -- Executado no Deno do Supabase.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const somenteNumeros = (valor = "") => valor.replace(/\D/g, "").replace(/@.*/, "");
const telefoneLocal = (valor = "") => {
  const numero = somenteNumeros(valor);
  return numero.startsWith("55") ? numero.slice(2) : numero;
};
const textoMensagem = (data: any) => {
  const mensagem = data?.message ?? data?.data?.message ?? {};
  return mensagem.conversation ?? mensagem.extendedTextMessage?.text ??
    mensagem.imageMessage?.caption ?? mensagem.videoMessage?.caption ??
    data?.body ?? data?.text ?? "";
};

// Comparação de tempo constante para não vazar o segredo por timing.
function segredoIgual(a: string, b: string) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

Deno.serve(async (request) => {
  const segredo = Deno.env.get("EVOLUTION_WEBHOOK_SECRET");
  const recebido = request.headers.get("x-webhook-secret") ?? "";
  if (!segredo || !segredoIgual(recebido, segredo)) {
    return new Response("Não autorizado", { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const evento = String(payload.event ?? "").toUpperCase().replace(/[.-]/g, "_");
  const instancia = payload.instance ?? payload.instanceName;
  const instanciaEsperada = Deno.env.get("EVOLUTION_INSTANCE") ?? "gr-finance";
  if (instancia && instancia !== instanciaEsperada) {
    return Response.json({ ignorado: true });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const data = payload.data ?? {};
  const key = data.key ?? data.message?.key ?? {};
  const messageId = key.id ?? data.id ?? data.messageId ?? data.keyId;
  const jidBruto = data.senderPn ?? key.remoteJidAlt ?? key.remoteJid ?? data.remoteJid ?? data.sender ?? "";
  const telefone = somenteNumeros(jidBruto);
  const numeroCliente = telefoneLocal(telefone);

  if (evento.includes("MESSAGES_UPSERT") || evento.includes("SEND_MESSAGE")) {
    if (!messageId || !telefone || String(jidBruto).endsWith("@g.us")) {
      return Response.json({ recebido: true, ignorado: true });
    }
    const fromMe = Boolean(key.fromMe ?? data.fromMe);
    const { data: clientes } = await supabase
      .from("clientes")
      .select("id,telefone")
      .neq("telefone", "");
    const cliente = (clientes ?? []).find((item: any) =>
      telefoneLocal(item.telefone).endsWith(numeroCliente) ||
      numeroCliente.endsWith(telefoneLocal(item.telefone))
    );
    const timestampBruto = Number(data.messageTimestamp ?? Date.now());
    const timestamp = Number.isFinite(timestampBruto)
      ? timestampBruto * (timestampBruto < 100000000000 ? 1000 : 1)
      : Date.now();
    const dataEvento = new Date(timestamp).toISOString();

    let agendamentoId = null;
    if (fromMe) {
      const { data: agendamento } = await supabase
        .from("mensagens_agendadas")
        .select("id")
        .eq("whatsapp_message_id", messageId)
        .maybeSingle();
      agendamentoId = agendamento?.id ?? null;
    }

    await supabase.from("whatsapp_mensagens").upsert({
      whatsapp_message_id: messageId,
      cliente_id: cliente?.id ?? null,
      agendamento_id: agendamentoId,
      telefone,
      direcao: fromMe ? "Enviada" : "Recebida",
      mensagem: textoMensagem(data),
      status: fromMe ? "Enviada" : "Recebida",
      enviada_em: dataEvento,
      payload,
    }, { onConflict: "whatsapp_message_id" });

    if (!fromMe && cliente?.id) {
      const { data: ultimo } = await supabase
        .from("mensagens_agendadas")
        .select("id")
        .eq("cliente_id", cliente.id)
        .eq("status", "Enviada")
        .is("respondida_em", null)
        .order("enviada_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ultimo) {
        await supabase.from("mensagens_agendadas").update({
          respondida_em: dataEvento,
          resposta_texto: textoMensagem(data),
          status_entrega: "Respondida",
          updated_at: new Date().toISOString(),
        }).eq("id", ultimo.id);
      }
    }
  }

  if (evento.includes("MESSAGES_UPDATE") && messageId) {
    const bruto = data.status ?? data.update?.status ?? data.ack ?? "";
    const status = String(bruto).toUpperCase();
    const numeroStatus = Number(bruto);
    const visualizada = status.includes("READ") || status.includes("PLAYED") || numeroStatus >= 3;
    const entregue = visualizada || status.includes("DELIVER") || numeroStatus >= 2;
    const agora = new Date().toISOString();
    const atualizacao: Record<string, any> = {
      status: visualizada ? "Visualizada" : entregue ? "Entregue" : status || "Enviada",
    };
    if (entregue) atualizacao.entregue_em = agora;
    if (visualizada) atualizacao.visualizada_em = agora;
    await supabase.from("whatsapp_mensagens").update(atualizacao)
      .eq("whatsapp_message_id", messageId);

    const agendamento: Record<string, any> = {
      status_entrega: visualizada ? "Visualizada" : entregue ? "Entregue" : "Enviada",
      updated_at: agora,
    };
    if (entregue) agendamento.entregue_em = agora;
    if (visualizada) agendamento.visualizada_em = agora;
    await supabase.from("mensagens_agendadas").update(agendamento)
      .eq("whatsapp_message_id", messageId)
      .is("respondida_em", null);
  }

  return Response.json({ recebido: true });
});
