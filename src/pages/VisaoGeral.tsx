import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bot, FileCheck2, UserCheck, CircleCheck, UserPlus, MessageCircle, Instagram, Facebook, Megaphone, Globe, HelpCircle,
  MoreHorizontal, ArrowRight, ArrowDown, type LucideIcon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import { brl, primeiroNome, tel } from '../lib/format';
import { EQUIPE, coluna, rotOpcao } from '../lib/tipos';
import LeadPainel from '../components/LeadPainel';
import { Gaveta } from '../components/ui';

type Funil = { leads: number; conversaram: number; contratos: number; consultor: number; vendas: number; em_atendimento: number; com_consultor: number };
type Atencao = { telefone: string; nome: string | null; cidade: string | null; valor_pago: number | null; tipo: string; desde: string | null };
type Dash = {
  dias: number; atual: Partial<Funil>; anterior: Partial<Funil>;
  por_dia: { dia: string; n: number }[]; origem: { origem: string; n: number }[];
  resposta: { respostas: number; mediana_seg: number | null; ate_1min: number };
  followup: { leads: number; voltaram: number }; retornos: { cumpridos: number; furos: number };
  atividade: { mensagens_hoje: number; assumidos: number; ultima_falha_ia: string | null };
  atencao: Atencao[];
};

// O documento do funil da Talita é o contrato de compra do lote (leads.contrato_recebido → chave `contratos`
// do crm_dashboard). `ficha` é o rótulo do valor mostrado em "Pedem sua atenção" (valor_pago).
const DOC = { kpi: 'Contratos recebidos', jornada: 'Mandaram o contrato', anel: ['mandaram', 'o contrato'], ficha: 'pago' };

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const diaCurto = (d: string) => { const [, m, dd] = d.split('-'); return `${Number(dd)} ${MESES[Number(m) - 1]}`; };
const n = (v?: number | null) => Number(v || 0);
const fmt = (v: number) => v.toLocaleString('pt-BR');

function ha(iso?: string | null) {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} d`;
}
function segundos(s?: number | null) {
  if (s == null) return '—';
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60); const r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}
function saudacao() { const h = new Date().getHours(); return h >= 5 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite'; }

function Variacao({ atual, anterior, dias }: { atual: number; anterior: number; dias: number }) {
  const diff = atual - anterior;
  let txt: string;
  if (diff === 0) txt = 'igual';
  else if (anterior >= 10) txt = `${diff > 0 ? '+' : '−'}${Math.round(Math.abs(diff) / anterior * 100)}%`;
  else txt = `${diff > 0 ? '+' : '−'}${Math.abs(diff)}`;
  const cor = diff > 0 ? 'text-menta-700' : diff < 0 ? 'text-alerta' : 'text-apagado';
  return <span className="text-[11px] text-apagado"><b className={cor}>{txt}</b> vs {dias} dias antes</span>;
}

function Anel({ pct, cor, tamanho = 48, espessura = 5, children }: { pct: number | null; cor: string; tamanho?: number; espessura?: number; children?: React.ReactNode }) {
  const r = (tamanho - espessura) / 2 - 1; const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: tamanho, height: tamanho }}>
      <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} aria-hidden="true">
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke="#E1E9E4" strokeWidth={espessura} />
        {pct != null && pct > 0 && <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke={cor} strokeWidth={espessura} strokeLinecap="round"
          strokeDasharray={`${Math.max(0.5, Math.min(100, pct)) / 100 * c} ${c}`} transform={`rotate(-90 ${tamanho / 2} ${tamanho / 2})`} />}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/** Foto do negócio do cliente (public/img/destaque.webp). Sem foto, fica o degradê da marca. */
function FotoDestaque() {
  const [semFoto, setSemFoto] = useState(false);
  return (
    <>
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-petroleo via-petroleo-700 to-noite" />
      {/* detalhe dourado da marca (só aparece sem a foto) */}
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_88%_12%,rgba(214,188,108,.20),transparent_55%)]" />
      {!semFoto && <img src="/img/destaque.webp" alt="" aria-hidden="true" onError={() => setSemFoto(true)} className="absolute inset-0 h-full w-full object-cover object-[center_62%]" />}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-noite/55 via-noite/20 to-transparent" />
    </>
  );
}

function GraficoDia({ pontos }: { pontos: { dia: string; n: number }[] }) {
  const [i, setI] = useState<number | null>(null);
  const W = 620, H = 150;
  const max = Math.max(4, ...pontos.map((p) => p.n)) * 1.15;
  const xy = pontos.map((p, k) => [pontos.length > 1 ? (k * W) / (pontos.length - 1) : W / 2, H - (p.n / max) * H] as const);
  const linha = xy.map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${linha} L${W},${H} L0,${H} Z`;
  const marcas = pontos.length > 1 ? [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (pontos.length - 1))) : [0];
  const sel = i != null ? pontos[i] : null;
  const pos = i != null && pontos.length > 1 ? (i / (pontos.length - 1)) * 100 : 50;
  return (
    <div>
      <div className="relative mt-8 h-[150px]" onMouseLeave={() => setI(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
          <defs><linearGradient id="vg-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1F3630" stopOpacity=".28" /><stop offset="1" stopColor="#1F3630" stopOpacity="0" /></linearGradient></defs>
          <path d={`M0 ${H * 0.2}H${W}M0 ${H * 0.5}H${W}M0 ${H * 0.8}H${W}`} stroke="rgba(15,29,25,.07)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d={area} fill="url(#vg-area)" />
          <path d={linha} fill="none" stroke="#1F3630" strokeWidth="2.2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="absolute inset-0 flex">
          {pontos.map((p, k) => (
            <div key={p.dia} className="h-full flex-1" onMouseEnter={() => setI(k)} onTouchStart={() => setI(k)} />
          ))}
        </div>
        {sel && (
          <>
            <div className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-petroleo bg-white"
              style={{ left: `${pos}%`, top: `${(xy[i!][1] / H) * 100}%` }} />
            <div className="pointer-events-none absolute -top-8 whitespace-nowrap rounded-[10px] bg-noite px-2.5 py-1 text-xs font-bold text-white"
              style={{ left: `${pos}%`, transform: `translateX(${pos < 12 ? '0' : pos > 88 ? '-100%' : '-50%'})` }}>
              {sel.n} {sel.n === 1 ? 'lead' : 'leads'} · {diaCurto(sel.dia)}
            </div>
          </>
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-apagado">
        {marcas.map((k, j) => <span key={j}>{pontos[k] ? diaCurto(pontos[k].dia) : ''}</span>)}
      </div>
    </div>
  );
}

const ORIGEM_ICONE: Record<string, { icone: LucideIcon; fundo: string; cor: string }> = {
  instagram: { icone: Instagram, fundo: 'bg-[#FBE3EC]', cor: 'text-[#9C2A55]' },
  facebook: { icone: Facebook, fundo: 'bg-[#E3ECFB]', cor: 'text-[#2A4C9C]' },
  anuncio: { icone: Megaphone, fundo: 'bg-sol-100', cor: 'text-sol-700' },
  indicacao: { icone: UserPlus, fundo: 'bg-menta-100', cor: 'text-menta-700' },
  google: { icone: Globe, fundo: 'bg-petroleo-100', cor: 'text-petroleo' },
  outro: { icone: MoreHorizontal, fundo: 'bg-papel', cor: 'text-apagado' },
  nao_informado: { icone: HelpCircle, fundo: 'bg-papel', cor: 'text-apagado' },
};

const SITUACAO: Record<string, { cls: string; txt: (a: Atencao) => string }> = {
  equipe: { cls: 'bg-[#FFF1D6] text-[#7A4F00]', txt: (a) => `Esperando resposta há ${ha(a.desde)}` },
  ia_sem_resposta: { cls: 'bg-alerta-100 text-[#93321C]', txt: (a) => `IA sem responder há ${ha(a.desde)}` },
  consultor_sem_retorno: { cls: 'bg-alerta-100 text-[#93321C]', txt: (a) => `Sem retorno da ${EQUIPE} há ${ha(a.desde)}` },
  retorno_hoje: { cls: 'bg-petroleo-100 text-petroleo-700', txt: (a) => `Retorno hoje ${a.desde ? new Date(a.desde).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}` },
};

function Saude({ pct, rotulo, detalhe, cor, nota }: { pct: number | null; rotulo: string; detalhe: string; cor: string; nota: { txt: string; cls: string } }) {
  return (
    <div className="flex items-center gap-3.5">
      <Anel pct={pct} cor={cor}><span className="text-[11px] font-bold">{pct == null ? '—' : `${Math.round(pct)}%`}</span></Anel>
      <div className="min-w-0 leading-tight">
        <div className="text-[13px] font-bold">{rotulo}</div>
        <div className="mt-0.5 text-xs"><span className={`font-semibold ${nota.cls}`}>{nota.txt}</span><span className="text-apagado"> · {detalhe}</span></div>
      </div>
    </div>
  );
}
function nota(pct: number | null, bom: number, ok: number) {
  if (pct == null) return { txt: 'Sem dados ainda', cls: 'text-apagado' };
  if (pct >= bom) return { txt: 'Bom', cls: 'text-menta-700' };
  if (pct >= ok) return { txt: 'Regular', cls: 'text-sol-700' };
  return { txt: 'Dá para melhorar', cls: 'text-alerta' };
}

export default function VisaoGeral() {
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const [dias, setDias] = useState(30);
  const [aberto, setAberto] = useState<string | null>(null);
  // mesmo cache do cartão "Agente no ar" do menu (App.tsx): o chip mostra WhatsApp desconectado também
  const { data: statusAgente } = useQuery({ queryKey: ['status-agente'], queryFn: async () => (await supabase.rpc('crm_status_agente')).data as any, refetchInterval: 60_000 });
  const { data: d, isLoading, error } = useQuery({
    queryKey: ['dashboard', dias],
    queryFn: async () => { const { data, error } = await supabase.rpc('crm_dashboard', { p_dias: dias }); if (error) throw error; return data as Dash; },
    refetchInterval: 60_000,
  });
  // lead novo ou mudança no funil atualiza os números (agrupando rajadas)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const ch = supabase.channel('crm:visao-geral')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        clearTimeout(t); t = setTimeout(() => qc.invalidateQueries({ queryKey: ['dashboard'] }), 3000);
      }).subscribe();
    return () => { clearTimeout(t); supabase.removeChannel(ch); };
  }, [qc]);

  const hoje = useMemo(() => { const s = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1); }, []);
  const nome = primeiroNome(usuario?.nome) || (usuario?.email || '').split('@')[0];

  const seletor = (
    <div role="group" aria-label="Período" className="flex rounded-2xl bg-white/75 p-1 ring-1 ring-white/95">
      {[7, 30, 90].map((p) => (
        <button key={p} onClick={() => setDias(p)} aria-pressed={dias === p}
          className={`h-9 rounded-xl px-3.5 text-[13px] font-semibold transition ${dias === p ? 'bg-noite text-white' : 'text-tinta hover:bg-white'}`}>{p} dias</button>
      ))}
    </div>
  );

  if (error) return <div className="p-4 md:p-0"><div className="cartao p-4 text-sm text-alerta">Não foi possível carregar a visão geral: {(error as Error).message}</div></div>;
  if (isLoading || !d) return <div className="p-4 md:p-0"><div className="cartao p-6 text-sm text-apagado">Carregando a visão geral…</div></div>;

  const a = d.atual, ant = d.anterior;
  const leads = n(a.leads);
  const pctConta = leads ? (n(a.contratos) / leads) * 100 : null;
  const falhaRecente = d.atividade.ultima_falha_ia && Date.now() - new Date(d.atividade.ultima_falha_ia).getTime() < 2 * 3600_000;
  const whatsOff = !!statusAgente?.whatsapp && statusAgente.whatsapp.status !== 'connected';
  const media = d.por_dia.length ? leads / d.por_dia.length : 0;
  const totalOrigem = d.origem.reduce((s, o) => s + o.n, 0) || 1;
  const pResp = d.resposta.respostas ? (d.resposta.ate_1min / d.resposta.respostas) * 100 : null;
  const totRet = n(d.retornos.cumpridos) + n(d.retornos.furos);
  const pRet = totRet ? (n(d.retornos.cumpridos) / totRet) * 100 : null;
  const pFu = d.followup.leads ? (d.followup.voltaram / d.followup.leads) * 100 : null;

  const kpis: { rotulo: string; v: number; ant: number; icone: LucideIcon; fundo: string; cor: string }[] = [
    { rotulo: 'Leads novos', v: leads, ant: n(ant.leads), icone: UserPlus, fundo: 'bg-petroleo-100', cor: 'text-petroleo' },
    { rotulo: DOC.kpi, v: n(a.contratos), ant: n(ant.contratos), icone: FileCheck2, fundo: 'bg-sol-100', cor: 'text-sol-700' },
    { rotulo: `Passados à ${EQUIPE}`, v: n(a.consultor), ant: n(ant.consultor), icone: UserCheck, fundo: 'bg-petroleo-100', cor: 'text-petroleo' },
    { rotulo: 'Contratados', v: n(a.vendas), ant: n(ant.vendas), icone: CircleCheck, fundo: 'bg-menta-100', cor: 'text-menta-700' },
  ];
  const jornada: { rotulo: string; v: number; icone: LucideIcon; cor: string }[] = [
    { rotulo: 'Chamaram no WhatsApp', v: leads, icone: MessageCircle, cor: 'text-menta-700' },
    { rotulo: 'Conversaram com a IA', v: n(a.conversaram), icone: Bot, cor: 'text-petroleo' },
    { rotulo: DOC.jornada, v: n(a.contratos), icone: FileCheck2, cor: 'text-sol-700' },
    { rotulo: `Foram à ${EQUIPE}`, v: n(a.consultor), icone: UserCheck, cor: 'text-petroleo' },
    { rotulo: 'Contrataram', v: n(a.vendas), icone: CircleCheck, cor: 'text-sol' },
  ];

  return (
    <div className="h-full overflow-y-auto px-4 md:px-0 md:pr-1">
      <div className="flex flex-col gap-4 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <h1 className="sr-only">Visão geral</h1>
          <span className="text-[13px] font-semibold text-noite-600">{hoje}</span>
          {seletor}
        </div>

        {/* Destaque: saudação, leads do período e o agente */}
        <section aria-label="Resumo" className="relative overflow-hidden rounded-[22px] ring-1 ring-white/90">
          <FotoDestaque />
          <div className="relative flex flex-col gap-4 p-4 md:min-h-[256px] md:flex-row md:justify-between md:gap-6 md:p-6">
            <div className="flex flex-col justify-between gap-4">
              <div>
                <div className="text-[15px] font-semibold text-white/90 [text-shadow:0_1px_8px_rgba(8,20,16,.5)]">{saudacao()}{nome ? `, ${nome}` : ''}</div>
                <p className="mt-1 font-display text-[24px] font-medium leading-tight text-white [text-shadow:0_2px_14px_rgba(8,20,16,.45)] md:text-[30px]">
                  {leads ? <><span className="text-[#E3CC85]">{fmt(leads)} {leads === 1 ? 'lead chegou' : 'leads chegaram'}</span><br />nos últimos {dias} dias</>
                    : <>Ainda não chegaram leads<br />nos últimos {dias} dias</>}
                </p>
              </div>
              <div className="flex w-full items-center gap-4 rounded-[18px] bg-white/80 p-4 ring-1 ring-white/95 backdrop-blur-md md:w-[356px]">
                <div className="flex flex-1 flex-col gap-2">
                  <div>
                    <div className="text-[13px] font-semibold text-apagado">Leads no período</div>
                    <div className="numero font-display text-[28px] font-semibold leading-tight">{fmt(leads)}</div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex gap-1.5"><span className="w-[3px] rounded bg-petroleo" /><div><div className="text-[11px] text-apagado">{coluna('em_atendimento')}</div><div className="numero text-sm font-bold">{fmt(n(a.em_atendimento))}</div></div></div>
                    <div className="flex gap-1.5"><span className="w-[3px] rounded bg-sol" /><div><div className="text-[11px] text-apagado">{coluna('com_consultor')}</div><div className="numero text-sm font-bold">{fmt(n(a.com_consultor))}</div></div></div>
                  </div>
                </div>
                <Anel pct={pctConta} cor="#1F3630" tamanho={84} espessura={8}>
                  <span className="font-display text-[17px] font-semibold">{pctConta == null ? '—' : `${Math.round(pctConta)}%`}</span>
                  <span className="text-center text-[10px] leading-[1.15] text-apagado">{DOC.anel[0]}<br />{DOC.anel[1]}</span>
                </Anel>
              </div>
            </div>
            <div className="flex w-full flex-col gap-3 rounded-[18px] bg-white/80 p-4 ring-1 ring-white/95 backdrop-blur-md md:w-[256px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-noite-600">Agente de IA</span>
                {whatsOff
                  ? <span className="chip bg-alerta-100 text-[#93321C]"><span className="h-1.5 w-1.5 rounded-full bg-alerta" />WhatsApp desconectado</span>
                  : falhaRecente
                  ? <span className="chip bg-alerta-100 text-[#93321C]"><span className="h-1.5 w-1.5 rounded-full bg-alerta" />Falhou há {ha(d.atividade.ultima_falha_ia)}</span>
                  : <span className="chip bg-menta-100 text-menta-700"><span className="h-1.5 w-1.5 rounded-full bg-menta-600" />Funcionando</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-sol-100"><Bot className="h-[22px] w-[22px] text-sol-700" /></span>
                <div>
                  <div className="numero font-display text-2xl font-semibold leading-tight">{segundos(d.resposta.mediana_seg)}</div>
                  <div className="text-xs text-apagado">tempo típico de resposta</div>
                </div>
              </div>
              <div className="h-px bg-linha" />
              <div className="flex justify-between text-[13px]"><span className="text-apagado">Mensagens hoje</span><b className="numero">{fmt(d.atividade.mensagens_hoje)}</b></div>
              <div className="flex justify-between text-[13px]"><span className="text-apagado">Assumidos pela {EQUIPE}</span><b className="numero">{fmt(d.atividade.assumidos)}</b></div>
            </div>
          </div>
        </section>

        {/* Indicadores */}
        <section aria-label="Indicadores" className="grid grid-cols-2 gap-2.5 md:gap-0 md:rounded-[20px] md:bg-white/70 md:py-5 md:ring-1 md:ring-white/95 xl:grid-cols-4">
          {kpis.map((k, j) => (
            <div key={k.rotulo} className={`flex items-center gap-3 rounded-[18px] bg-white/80 p-3.5 ring-1 ring-white/95 md:rounded-none md:bg-transparent md:px-5 md:py-1 md:ring-0 ${j ? 'xl:border-l xl:border-linha' : ''}`}>
              <span className={`hidden h-10 w-10 shrink-0 place-items-center rounded-xl sm:grid ${k.fundo}`}><k.icone className={`h-5 w-5 ${k.cor}`} /></span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-apagado">{k.rotulo}</div>
                <div className="numero font-display text-[22px] font-semibold leading-tight">{fmt(k.v)}</div>
                <Variacao atual={k.v} anterior={k.ant} dias={dias} />
              </div>
            </div>
          ))}
        </section>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_260px_270px]">
          <section aria-label="Leads por dia" className="cartao flex flex-col p-5 lg:col-span-2 xl:col-span-1">
            <h2 className="text-[15px] font-bold">Leads por dia</h2>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="numero font-display text-[26px] font-semibold">{media.toLocaleString('pt-BR', { maximumFractionDigits: media > 0 && media < 1 ? 2 : 1 })}</span>
              <span className="text-xs text-apagado">leads por dia em média</span>
            </div>
            <div className="mt-auto"><GraficoDia pontos={d.por_dia} /></div>
          </section>

          <section aria-label="Origem dos leads" className="cartao flex flex-col gap-3.5 p-5">
            <h2 className="text-[15px] font-bold">De onde vêm os leads</h2>
            {!d.origem.length && <div className="text-sm text-apagado">Sem leads no período.</div>}
            {d.origem.slice(0, 5).map((o) => {
              const ic = ORIGEM_ICONE[o.origem] || ORIGEM_ICONE.outro;
              return (
                <div key={o.origem} className="flex items-center gap-3">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ${ic.fundo}`}><ic.icone className={`h-[18px] w-[18px] ${ic.cor}`} /></span>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <div className="flex justify-between text-[13px]"><span className="font-semibold">{o.origem === 'nao_informado' ? 'Não informado' : rotOpcao('origem_lead', o.origem)}</span><b className="numero">{fmt(o.n)}</b></div>
                    <div className="h-1.5 rounded-full bg-[#E6ECE8]"><div className="h-1.5 rounded-full bg-petroleo" style={{ width: `${Math.max(3, (o.n / totalOrigem) * 100)}%` }} /></div>
                  </div>
                </div>
              );
            })}
          </section>

          <section aria-label="Saúde do atendimento" className="cartao flex flex-col gap-3.5 p-5">
            <h2 className="text-[15px] font-bold">Saúde do atendimento</h2>
            <Saude pct={pResp} cor="#1A7F62" rotulo="Respondidos em até 1 min" nota={nota(pResp, 90, 70)}
              detalhe={d.resposta.respostas ? `${fmt(d.resposta.ate_1min)} de ${fmt(d.resposta.respostas)}` : 'sem conversas'} />
            <Saude pct={pRet} cor="#1A7F62" rotulo="Retornos combinados cumpridos" nota={nota(pRet, 80, 60)}
              detalhe={totRet ? `${fmt(n(d.retornos.cumpridos))} de ${fmt(totRet)}` : 'nenhum combinado'} />
            <Saude pct={pFu} cor="#C68A00" rotulo="Voltaram após follow-up" nota={nota(pFu, 30, 15)}
              detalhe={d.followup.leads ? `${fmt(d.followup.voltaram)} de ${fmt(d.followup.leads)} ${d.followup.leads === 1 ? 'lead' : 'leads'}` : 'nenhum follow-up'} />
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <section aria-label="Pedem sua atenção" className="cartao flex flex-col p-5">
            <h2 className="mb-2 text-[15px] font-bold">Pedem sua atenção</h2>
            {!d.atencao.length && <div className="py-6 text-center text-sm text-apagado">Nada pendente agora.</div>}
            {d.atencao.map((l) => {
              const s = SITUACAO[l.tipo];
              return (
                <button key={l.telefone} onClick={() => setAberto(l.telefone)}
                  className="-mx-2 flex min-h-[52px] items-center gap-3 rounded-xl border-t border-linha px-2 py-2 text-left first-of-type:border-t-0 hover:bg-white/70">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{l.nome || tel(l.telefone)}</div>
                    <div className="truncate text-xs text-apagado">{[l.cidade?.split(' - ')[0], l.valor_pago != null ? `${DOC.ficha} ${brl(l.valor_pago)}` : null].filter(Boolean).join(' · ') || tel(l.telefone)}</div>
                  </div>
                  {s && <span className={`chip shrink-0 !px-2.5 !py-1 !text-xs !font-bold ${s.cls}`}>{s.txt(l)}</span>}
                </button>
              );
            })}
          </section>

          <section aria-label="Jornada do lead" className="cartao flex flex-col gap-3.5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-bold">Jornada do lead</h2>
              <span className="text-xs text-apagado">leads do período e até onde chegaram</span>
            </div>
            <div className="flex flex-1 flex-col items-stretch gap-1.5 sm:flex-row sm:items-center">
              {jornada.map((j, k) => {
                const ultimo = k === jornada.length - 1;
                const anterior = k ? jornada[k - 1].v : 0;
                return (
                  <div key={j.rotulo} className="contents">
                    {k > 0 && (
                      <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-petroleo sm:flex-col sm:gap-0.5">
                        <span className="numero">{anterior ? `${Math.round((j.v / anterior) * 100)}%` : '—'}</span>
                        <ArrowRight className="hidden h-3.5 w-5 text-petroleo-300 sm:block" /><ArrowDown className="h-3.5 w-3.5 text-petroleo-300 sm:hidden" />
                      </div>
                    )}
                    <div className={`flex flex-1 items-center gap-3 rounded-2xl p-3 sm:min-w-0 sm:flex-col sm:items-start sm:gap-2 ${ultimo ? 'bg-petroleo text-white' : 'bg-white shadow-[0_2px_10px_rgba(20,45,38,.07)]'}`}>
                      <j.icone className={`h-[22px] w-[22px] shrink-0 ${j.cor}`} />
                      <span className={`flex-1 text-xs font-semibold leading-tight sm:text-[11px] ${ultimo ? 'text-[#D3E2DA]' : 'text-apagado'}`}>{j.rotulo}</span>
                      <span className="numero font-display text-[22px] font-semibold leading-none">{fmt(j.v)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {aberto && <Gaveta onFechar={() => setAberto(null)}><LeadPainel telefone={aberto} onFechar={() => setAberto(null)} /></Gaveta>}
    </div>
  );
}
