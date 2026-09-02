"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Map,
  ContactRound,
  ReceiptText,
  MessageCircleMore,
  Settings,
  Users,
  X,
} from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import Image from "next/image";

const links = [
  { href: "/", nome: "Dashboard", icon: LayoutDashboard },
  { href: "/lancamentos", nome: "Lançamentos", icon: ReceiptText },
  { href: "/viagens", nome: "Viagens e rotas", icon: Map },
  { href: "/clientes", nome: "Clientes", icon: ContactRound },
  { href: "/whatsapp", nome: "WhatsApp", icon: MessageCircleMore },
  { href: "/funcionarios", nome: "Funcionários", icon: Users },
];

export function AppSidebar({
  aberto,
  fechar,
}: {
  aberto: boolean;
  fechar: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      <button
        onClick={fechar}
        aria-label="Fechar menu"
        className={`fixed inset-0 z-30 bg-black/40 lg:hidden ${aberto ? "block" : "hidden"}`}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-[#07142e] p-5 text-white transition-transform duration-300 lg:translate-x-0 ${aberto ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between">
          <Link href="/">
            <Image
              src="/logo-transparent-v3.png"
              alt="GR Finance"
              width={176}
              height={149}
              priority
              unoptimized
              className="h-auto w-20 object-contain"
            />
          </Link>
          <button
            onClick={fechar}
            aria-label="Fechar menu"
            className="text-slate-400 lg:hidden"
          >
            <X size={22} />
          </button>
        </div>
        <nav className="mt-10 space-y-2">
          {links.map((item) => {
            const ativo = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${ativo ? "bg-[#c9a44d] font-semibold text-[#07142e]" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
              >
                <item.icon size={19} />
                {item.nome}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-2 border-t border-white/10 pt-5">
          <Link
            href="#"
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white"
          >
            <Settings size={19} />
            Configurações
          </Link>
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
