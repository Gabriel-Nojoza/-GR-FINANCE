// @ts-nocheck -- Executado no Deno do Supabase.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Origens permitidas: defina APP_ORIGINS (lista separada por vírgula) nos
// secrets da função. Sem essa variável, cai no comportamento aberto ("*").
const origensPermitidas = (Deno.env.get("APP_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function corsHeaders(request: Request) {
  const origem = request.headers.get("Origin") ?? "";
  const permitida = origensPermitidas.length === 0
    ? "*"
    : origensPermitidas.includes(origem)
    ? origem
    : origensPermitidas[0];
  return {
    "Access-Control-Allow-Origin": permitida,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });

  const authorization = request.headers.get("Authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");
  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data: usuario } = await authClient.auth.getUser(token);
  if (!usuario.user) {
    return Response.json({ error: "Não autorizado" }, { status: 401, headers: cors });
  }

  const url = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
  const apiKey = Deno.env.get("EVOLUTION_API_KEY");
  const instancia = Deno.env.get("EVOLUTION_INSTANCE") ?? "gr-finance";
  if (!url || !apiKey) {
    return Response.json({ error: "Evolution API não configurada" }, { status: 500, headers: cors });
  }

  const headers = { apikey: apiKey, "Content-Type": "application/json" };
  const corpo = await request.json().catch(() => ({}));

  if (corpo.acao === "desconectar") {
    const logout = await fetch(
      `${url}/instance/logout/${encodeURIComponent(instancia)}`,
      { method: "DELETE", headers },
    );
    await new Promise((resolve) => setTimeout(resolve, 800));
    const verificacao = await fetch(
      `${url}/instance/connectionState/${encodeURIComponent(instancia)}`,
      { headers },
    );
    const estadoDepois = await verificacao.json().catch(() => ({}));
    const estadoAtual = estadoDepois.instance?.state ?? estadoDepois.state ?? "close";
    if (!logout.ok && estadoAtual === "open") {
      return Response.json({ error: "Não foi possível desconectar o WhatsApp" }, { status: logout.status, headers: cors });
    }
    return Response.json({ estado: estadoAtual, instancia, conectado: false }, { headers: cors });
  }

  const estadoResposta = await fetch(
    `${url}/instance/connectionState/${encodeURIComponent(instancia)}`,
    { headers },
  );
  const estadoJson = await estadoResposta.json().catch(() => ({}));
  const estado = estadoJson.instance?.state ?? estadoJson.state ?? "close";

  if (estado === "open") {
    return Response.json({ estado, instancia, conectado: true }, { headers: cors });
  }

  const qrResposta = await fetch(
    `${url}/instance/connect/${encodeURIComponent(instancia)}`,
    { headers },
  );
  const qrJson = await qrResposta.json().catch(() => ({}));
  return Response.json(
    {
      estado,
      instancia,
      conectado: false,
      qrcode: qrJson.base64 ?? qrJson.qrcode?.base64 ?? null,
      pairingCode: qrJson.pairingCode ?? qrJson.code ?? null,
    },
    { status: qrResposta.ok ? 200 : qrResposta.status, headers: cors },
  );
});
