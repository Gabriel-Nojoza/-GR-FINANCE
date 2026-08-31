"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  async function entrar(evento: FormEvent) {
    evento.preventDefault();
    if (!supabase)
      return setErro(
        "Configure corretamente o Supabase no arquivo .env.local.",
      );
    setCarregando(true);
    setErro("");
    setMensagem("");
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    setCarregando(false);
    if (error) return setErro("E-mail ou senha inválidos.");
    router.replace("/");
    router.refresh();
  }

  async function recuperarSenha() {
    if (!supabase || !email.trim())
      return setErro("Informe seu e-mail primeiro.");
    setErro("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) return setErro(error.message);
    setMensagem(
      "Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.",
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07142e]">
      <Image
        src="/capa-2-4k.webp"
        alt="GR Legal Finance"
        fill
        priority
        unoptimized
        sizes="100vw"
        className="login-cover-motion object-cover object-center"
      />
      <div className="absolute inset-0 bg-[#061126]/25 lg:bg-gradient-to-r lg:from-transparent lg:via-[#061126]/10 lg:to-[#061126]/45" />
      <div className="login-gold-glow" aria-hidden="true" />

      <section className="relative z-10 flex min-h-screen items-center justify-center p-6 lg:justify-end lg:px-[10vw]">
        <form
          onSubmit={entrar}
          className="login-form-enter w-full max-w-sm text-white"
        >
          <div className="mb-10">
            <h2 className="text-3xl font-semibold">Entrar no sistema</h2>
            <p className="mt-2 text-sm text-white/60">
              Use o usuário cadastrado.
            </p>
          </div>
          {!supabaseConfigurado && (
            <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              As variáveis do Supabase ainda estão incompletas.
            </p>
          )}
          {erro && (
            <p
              role="alert"
              className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
            >
              {erro}
            </p>
          )}
          {mensagem && (
            <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
              {mensagem}
            </p>
          )}
          <label>
            <span className="mb-2 block text-sm text-white/75">E-mail</span>
            <div className="relative">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                className="h-11 w-full border-0 border-b border-white/60 bg-transparent px-0 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-amber-300 focus:ring-0"
              />
            </div>
          </label>
          <label className="mt-5 block">
            <span className="mb-2 block text-sm text-white/75">Senha</span>
            <div className="relative">
              <input
                type={mostrarSenha ? "text" : "password"}
                required
                minLength={6}
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Sua senha"
                className="h-11 w-full border-0 border-b border-white/60 bg-transparent px-0 pr-10 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-amber-300 focus:ring-0"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-white/55 hover:text-white"
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          
          <button
            disabled={carregando || !supabaseConfigurado}
            className="login-button mt-8 h-12 w-full overflow-hidden border border-white/70 bg-white/5 text-sm font-semibold uppercase tracking-wider text-white transition hover:border-amber-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
