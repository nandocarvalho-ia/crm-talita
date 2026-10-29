import { useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid, KanbanSquare, MessageCircle, Bot, Users, Contact, LogOut, ArrowRight, Sparkles, type LucideIcon } from 'lucide-react';
import { useAuth } from './auth';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import DefinirSenha from './pages/DefinirSenha';
import VisaoGeral from './pages/VisaoGeral';
import Funil from './pages/Funil';
import Conversas from './pages/Conversas';
import Agente from './pages/Agente';
import Usuarios from './pages/Usuarios';
import Clientes from './pages/Clientes';
import Assistente from './pages/Assistente';
import { Marca, iniciais } from './components/ui';

type Item = { to: string; rotulo: string; curto: string; icone: LucideIcon; badge?: number; soComputador?: boolean };

// Propostas do assistente esperando aprovação (selo no menu)
function usePropostasAbertas() {
  const { admin } = useAuth();
  const { data } = useQuery({ queryKey: ['propostas', 'abertas'], enabled: admin, refetchInterval: 120_000, queryFn: async () =>
    (await supabase.from('assistente_propostas').select('id', { count: 'exact', head: true }).eq('status', 'aberta')
      .gt('criado_em', new Date(Date.now() - 7 * 86400_000).toISOString())).count || 0 });
  return data || 0;
}

// No celular a barra aceita até 6 itens: Áudios e WhatsApp ficam dentro de Agente; o Assistente fica no topo.
function useItens(): Item[] {
  const { admin } = useAuth();
  const abertas = usePropostasAbertas();
  const { data: resumo } = useQuery({ queryKey: ['resumo'], queryFn: async () => (await supabase.rpc('crm_resumo')).data as any, refetchInterval: 60_000 });
  return [
    ...(admin ? [{ to: '/', rotulo: 'Visão geral', curto: 'Início', icone: LayoutGrid }] : []),
    { to: '/funil', rotulo: 'Funil', curto: 'Funil', icone: KanbanSquare },
    { to: '/conversas', rotulo: 'Conversas', curto: 'Conversas', icone: MessageCircle, badge: Number(resumo?.nao_lidas || 0) },
    // MÓDULOS: itens de menu de módulos entram aqui (ver references/modulos.md)
    ...(admin ? [{ to: '/clientes', rotulo: 'Clientes atuais', curto: 'Clientes', icone: Contact }] : []),
    { to: '/agente', rotulo: 'Agente', curto: 'Agente', icone: Bot },
    ...(admin ? [{ to: '/assistente', rotulo: 'Assistente', curto: 'Clara', icone: Sparkles, badge: abertas, soComputador: true }] : []),
    ...(admin ? [{ to: '/usuarios', rotulo: 'Usuários', curto: 'Usuários', icone: Users }] : []),
  ];
}

function Badge({ n }: { n?: number }) {
  if (!n) return null;
  return <span className="grid h-[22px] min-w-[22px] place-items-center rounded-full bg-petroleo px-1.5 text-xs font-bold text-white">{n > 99 ? '99+' : n}</span>;
}

// Estado do agente para o cartão e o aviso do celular: WhatsApp fora > falha da IA > tudo certo
function useStatusAgente() {
  const { data } = useQuery({ queryKey: ['status-agente'], queryFn: async () => (await supabase.rpc('crm_status_agente')).data as any, refetchInterval: 60_000 });
  const falha = !!data?.ultima_falha_ia && Date.now() - new Date(data.ultima_falha_ia).getTime() < 2 * 3600_000;
  // sem linha em whatsapp_conexao (instância ainda não criada) ou qualquer estado diferente de "conectado": o agente não recebe nada
  const temWhats = !!data && 'whatsapp' in data;
  const whatsOff = temWhats && data.whatsapp?.status !== 'connected';
  const whatsTexto = !temWhats ? '' : data.whatsapp == null ? 'WhatsApp ainda não conectado'
    : data.whatsapp.status === 'connecting' ? 'WhatsApp aguardando leitura' : 'WhatsApp desconectado';
  return { data, falha, whatsOff, whatsTexto, sem: Number(data?.sem_resposta || 0) };
}

// Cartão "agente no ar": WhatsApp desconectado, falha recente da IA e leads que ficaram sem resposta
function CartaoAgente() {
  const { admin } = useAuth();
  const { data, falha, whatsOff, whatsTexto, sem } = useStatusAgente();
  const ruim = falha || whatsOff;
  return (
    <div className={`flex shrink-0 flex-col gap-1.5 rounded-2xl px-3.5 py-3 text-white ${ruim ? 'bg-gradient-to-br from-[#8A3B1E] to-[#5E2413]' : 'bg-gradient-to-br from-petroleo to-noite'}`}>
      <div className="flex items-center gap-2 text-[13px] font-bold">
        <span className={`h-2 w-2 shrink-0 rounded-full ${ruim ? 'bg-sol-300 shadow-[0_0_0_3px_rgba(214,188,108,.3)]' : 'bg-[#6FE3B8] shadow-[0_0_0_3px_rgba(111,227,184,.25)]'}`} />
        <span className="flex-1 truncate">{whatsOff ? whatsTexto : falha ? 'A IA falhou há pouco' : 'Agente no ar'}</span>
        {!(whatsOff && admin) && (
          <NavLink to="/conversas" aria-label="Ver conversas" title="Ver conversas"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/15 ring-1 ring-white/25 hover:bg-white/25">
            <ArrowRight className="h-3.5 w-3.5" />
          </NavLink>
        )}
      </div>
      {ruim && (
        <div className="text-[13px] font-semibold leading-snug">
          {whatsOff ? 'O agente não recebe nem envia mensagens' : 'Confira os créditos da OpenAI'}
        </div>
      )}
      <div className="text-[12px] leading-snug text-[#D3E2DA]">
        {whatsOff ? (admin ? 'Conecte o celular pelo QR code.' : 'Avise o administrador do CRM.')
          : data == null ? '…' : sem ? `${sem} ${sem === 1 ? 'lead está' : 'leads estão'} sem resposta.` : 'Nenhum lead sem resposta nas últimas 24 h.'}
      </div>
      {whatsOff && admin && (
        <NavLink to="/agente?aba=whatsapp" className="mt-1 flex h-8 items-center justify-center gap-2 rounded-lg bg-white text-[13px] font-bold text-[#5E2413] hover:bg-white/90">
          Conectar <ArrowRight className="h-4 w-4" />
        </NavLink>
      )}
    </div>
  );
}

// No celular o cartão lateral não aparece: faixa de aviso no topo quando o WhatsApp está fora
function AvisoWhatsCelular() {
  const { admin } = useAuth();
  const { whatsOff, whatsTexto } = useStatusAgente();
  if (!whatsOff) return null;
  return (
    <div className="mx-4 mb-2 flex items-center gap-2 rounded-2xl bg-[#8A3B1E] px-3 py-2.5 text-[13px] font-semibold text-white md:hidden">
      <span className="h-2 w-2 shrink-0 rounded-full bg-sol" />
      <span className="flex-1">{whatsTexto}: o agente está parado.</span>
      {admin ? <NavLink to="/agente?aba=whatsapp" className="rounded-lg bg-white px-2.5 py-1 text-[12px] font-bold text-[#5E2413]">Conectar</NavLink>
        : <span className="text-[12px] text-white/80">Avise o admin</span>}
    </div>
  );
}

function MenuLateral() {
  const { usuario, sair } = useAuth();
  const itens = useItens();
  return (
    <nav aria-label="Menu principal" className="hidden min-h-0 w-[232px] shrink-0 flex-col gap-2 overflow-y-auto rounded-[22px] bg-white/55 p-4 pt-6 ring-1 ring-white/90 md:flex">
      <div className="flex justify-center px-2 pb-3"><Marca /></div>
      {itens.map(({ to, rotulo, icone: I, badge }) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) =>
          `flex h-11 min-h-9 items-center gap-3 rounded-xl px-3.5 text-[15px] transition ${isActive ? 'bg-white font-bold text-tinta shadow-[0_2px_10px_rgba(20,45,38,.08)] [&>svg]:text-petroleo' : 'font-semibold text-noite-600 hover:bg-white/60'}`}>
          <I className="h-5 w-5" /><span className="flex-1">{rotulo}</span><Badge n={badge} />
        </NavLink>
      ))}
      <div className="flex-1" />
      <CartaoAgente />
      <div className="mt-1 flex h-[56px] shrink-0 items-center gap-2.5 rounded-2xl bg-white px-2.5">
        <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-sol-100 text-sm font-bold text-sol-700">{iniciais(usuario?.nome || usuario?.email)}</span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-bold">{usuario?.nome || usuario?.email}</div>
          <div className="text-xs text-apagado">{usuario?.papel === 'admin' ? 'Administrador' : 'Operador'}</div>
        </div>
        <button onClick={sair} aria-label="Sair" title="Sair" className="grid h-9 w-9 place-items-center rounded-lg text-apagado hover:bg-papel hover:text-tinta"><LogOut className="h-[18px] w-[18px]" /></button>
      </div>
    </nav>
  );
}

function TopoCelular() {
  const { usuario, sair, admin } = useAuth();
  const abertas = usePropostasAbertas();
  const [aberto, setAberto] = useState(false);
  return (
    <header className="relative flex h-16 shrink-0 items-center justify-between px-4 md:hidden">
      <Marca compacta />
      <div className="flex-1" />
      {admin && (
        <NavLink to="/assistente" aria-label="Assistente" className={({ isActive }) => `relative mr-2 grid h-11 w-11 place-items-center rounded-full ${isActive ? 'bg-petroleo text-white' : 'bg-white/90 text-petroleo ring-1 ring-linha'}`}>
          <Sparkles className="h-5 w-5" />
          {!!abertas && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-sol px-1 text-[10px] font-bold text-noite">{abertas > 9 ? '9+' : abertas}</span>}
        </NavLink>)}
      <button onClick={() => setAberto(!aberto)} aria-expanded={aberto} aria-label="Conta"
        className="grid h-11 w-11 place-items-center rounded-full bg-sol-100 text-sm font-bold text-sol-700">{iniciais(usuario?.nome || usuario?.email)}</button>
      {aberto && (
        <div className="absolute right-4 top-14 z-50 w-56 rounded-2xl bg-white p-2 shadow-painel ring-1 ring-linha">
          <div className="truncate px-2 py-1.5 text-sm font-bold">{usuario?.nome || usuario?.email}</div>
          <button onClick={sair} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold hover:bg-papel"><LogOut className="h-4 w-4" />Sair</button>
        </div>
      )}
    </header>
  );
}

function BarraCelular() {
  const itens = useItens().filter((i) => !i.soComputador);
  return (
    <nav aria-label="Menu" className="fixed inset-x-3 bottom-3 z-30 grid h-16 items-center rounded-[22px] bg-white/90 px-1 shadow-painel ring-1 ring-white backdrop-blur-lg md:hidden"
      style={{ gridTemplateColumns: `repeat(${itens.length}, minmax(0, 1fr))` }}>
      {itens.map(({ to, curto, icone: I, badge }) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) =>
          `relative flex h-[52px] flex-col items-center justify-center gap-0.5 text-[11px] ${isActive ? 'font-bold text-petroleo' : 'font-semibold text-apagado'}`}>
          <I className="h-[22px] w-[22px]" />{curto}
          {!!badge && <span className="absolute right-[22%] top-1 grid h-4 min-w-4 place-items-center rounded-full bg-petroleo px-1 text-[10px] font-bold text-white">{badge > 9 ? '9+' : badge}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

export default function App() {
  const { sessao, usuario, carregando, admin, sair } = useAuth();
  if (window.location.pathname.startsWith('/definir-senha')) return <DefinirSenha />;
  // MÓDULOS: páginas públicas (sem login) entram aqui, antes da checagem de sessão
  if (carregando) return <div className="ceu grid h-full place-items-center text-sm text-noite-600">Carregando…</div>;
  if (!sessao) return <Login />;
  if (!usuario || !usuario.ativo) return (
    <div className="ceu grid h-full place-items-center p-4"><div className="cartao max-w-sm p-6 text-sm">
      Seu acesso ao CRM não está liberado. Fale com o administrador.<button className="btn-sec mt-4 w-full" onClick={sair}>Sair</button></div></div>
  );
  return (
    <div className="ceu flex h-full flex-col md:p-5">
      <div className="flex min-h-0 flex-1 flex-col md:flex-row md:gap-5 md:rounded-4xl md:bg-white/40 md:p-5 md:shadow-painel md:ring-1 md:ring-white/80 md:backdrop-blur-xl">
        <MenuLateral />
        <TopoCelular />
        <AvisoWhatsCelular />
        <main className="min-h-0 min-w-0 flex-1 pb-[84px] md:pb-0">
          <Routes>
            <Route path="/" element={admin ? <VisaoGeral /> : <Navigate to="/funil" replace />} />
            <Route path="/funil" element={<Funil />} />
            <Route path="/conversas" element={<Conversas />} />
            <Route path="/agente" element={<Agente />} />
            {admin && <Route path="/usuarios" element={<Usuarios />} />}
            {/* MÓDULOS: rotas de módulos entram aqui, com o papel que pode ver */}
            {admin && <Route path="/clientes" element={<Clientes />} />}
            {admin && <Route path="/assistente" element={<Assistente />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <BarraCelular />
    </div>
  );
}
