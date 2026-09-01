// @ts-nocheck -- Este arquivo roda no Deno do Supabase, não no Next.js.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (request) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || request.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("Não autorizado", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const graphVersion = Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v23.0";
  const languageCode = Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE") ?? "pt_BR";

  if (!token || !phoneNumberId) {
    return Response.json({ error: "Credenciais do WhatsApp ausentes" }, { status: 500 });
  }

  const { data: fila, error } = await supabase
    .from("mensagens_agendadas")
    .select("*")
    .eq("status", "Pendente")
    .lte("agendada_para", new Date().toISOString())
    .order("agendada_para")
    .limit(20);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const resultados = [];
  for (const item of fila ?? []) {
    const { data: reservado } = await supabase
      .from("mensagens_agendadas")
      .update({ status: "Processando", updated_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("status", "Pendente")
      .select("id")
      .maybeSingle();
    if (!reservado) continue;

    try {
      const body = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: item.telefone.replace(/\D/g, ""),
        type: "template",
        template: {
          name: item.template_nome,
          language: { code: languageCode },
          components: item.mensagem
            ? [{ type: "body", parameters: [{ type: "text", text: item.mensagem }] }]
            : [],
        },
      };
      const resposta = await fetch(
        `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );
      const retorno = await resposta.json();
      if (!resposta.ok) throw new Error(JSON.stringify(retorno));
      await supabase
        .from("mensagens_agendadas")
        .update({
          status: "Enviada",
          enviada_em: new Date().toISOString(),
          whatsapp_message_id: retorno.messages?.[0]?.id ?? null,
          erro: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      resultados.push({ id: item.id, status: "Enviada" });
    } catch (erro) {
      const tentativas = Number(item.tentativas) + 1;
      await supabase
        .from("mensagens_agendadas")
        .update({
          status: tentativas >= 3 ? "Erro" : "Pendente",
          tentativas,
          erro: erro instanceof Error ? erro.message : String(erro),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      resultados.push({ id: item.id, status: "Erro" });
    }
  }

  return Response.json({ processadas: resultados.length, resultados });
});
