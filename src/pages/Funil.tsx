import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { Search, BotOff, MapPin, FileCheck2, BadgeDollarSign, ArrowDownCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Lead } from '../lib/tipos';
import { COLUNAS, ETAPAS, EQUIPE } from '../lib/tipos';
import { brl, relativo, tel } from '../lib/format';
import LeadPainel from '../components/LeadPainel';
import { Cabecalho, Erro, Gaveta } from '../components/ui';

// O PostgREST devolve no máximo 1000 linhas: pagina até acabar.
export async function buscarLeads(): Promise<Lead[]> {
  const todos: Lead[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from('crm_leads').select('*').order('movimentado_em', { ascending: false, nullsFirst: false }).range(de, de + 999);
    if (error) throw error;
    todos.push(...((data || []) as Lead[]));
    if (!data || data.length < 1000) break;
  }
  return todos;
}

export function useLeadsAoVivo() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['leads'], queryFn: buscarLeads });
  useEffect(() => {
    const ch = supabase.channel('crm:leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => { qc.invalidateQueries({ queryKey: ['leads'] }); qc.invalidateQueries({ queryKey: ['resumo'] }); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_conversas' }, () => qc.invalidateQueries({ queryKey: ['leads'] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
  return q;
}

function Card({ l, onAbrir }: { l: Lead; onAbrir: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: l.telefone });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} onClick={onAbrir}
      className={`cursor-pointer rounded-[14px] bg-white p-3 text-left shadow-[0_2px_8px_rgba(20,45,38,.07)] transition hover:shadow-[0_0_0_2px_#1F3630,0_8px_20px_rgba(20,45,38,.14)] ${isDragging ? 'z-50 opacity-80 shadow-xl' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{l.nome || tel(l.telefone)}</div>
          {l.nome && <div className="text-[11px] text-apagado">{tel(l.telefone)}</div>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[11px] text-apagado">{relativo(l.ultima_mensagem_em || l.atualizado_em)}</span>
          {!!l.nao_lidas && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-petroleo px-1.5 text-[11px] font-bold text-white">{l.nao_lidas}</span>}
        </div>
      </div>
      {l.ultima_previa && <div className="mt-1.5 line-clamp-2 text-xs text-apagado">{l.ultima_direcao === 'saida' ? '↪ ' : ''}{l.ultima_previa}</div>}
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="chip bg-papel text-noite-600">{ETAPAS[l.etapa_atual] || l.etapa_atual}</span>
        {l.valor_pago != null && <span className="chip bg-sol-100 text-sol-700"><BadgeDollarSign className="h-3 w-3" />{brl(l.valor_pago)}</span>}
        {l.contrato_recebido && <span className="chip bg-menta-100 text-menta-700"><FileCheck2 className="h-3 w-3" />Contrato</span>}
        {l.prioridade === 'baixa' && <span className="chip bg-papel text-apagado"><ArrowDownCircle className="h-3 w-3" />Prioridade baixa</span>}
        {l.cidade && <span className="chip bg-papel text-noite-600"><MapPin className="h-3 w-3" />{l.cidade.split(' - ')[0]}</span>}
        {l.pausar_ia && <span className="chip bg-[#FFF1D6] text-[#7A4F00]"><BotOff className="h-3 w-3" />IA pausada</span>}
      </div>
    </div>
  );
}

function Coluna({ id, titulo, dica, cor, leads, onAbrir }: { id: string; titulo: string; dica: string; cor: string; leads: Lead[]; onAbrir: (t: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div className="vidro flex w-[272px] shrink-0 flex-col p-3">
      <div className="mb-1 flex items-center gap-2 px-1">
        <span className={`h-2 w-2 rounded-full ${cor}`} />
        <h2 className="flex-1 text-sm font-bold">{titulo}</h2>
        <span className="numero text-xs font-bold text-noite-600">{leads.length.toLocaleString('pt-BR')}</span>
      </div>
      <div className="mb-2 px-1 text-[11px] text-apagado">{dica}</div>
      <div ref={setNodeRef} className={`-mx-1 flex-1 space-y-2.5 overflow-y-auto rounded-2xl px-1 pb-1 transition ${isOver ? 'bg-petroleo-100/70' : ''}`}>
        {leads.map((l) => <Card key={l.telefone} l={l} onAbrir={() => onAbrir(l.telefone)} />)}
        {!leads.length && <div className="py-6 text-center text-xs text-apagado">Vazio</div>}
      </div>
    </div>
  );
}

export default function Funil() {
  const { data: leads = [], isLoading, error } = useLeadsAoVivo();
  const { data: resumo } = useQuery({ queryKey: ['resumo'], queryFn: async () => (await supabase.rpc('crm_resumo')).data as any });
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  // link do aviso no WhatsApp: /funil?lead=55... abre a ficha direto
  const [aberto, setAberto] = useState<string | null>(() => new URLSearchParams(window.location.search).get('lead'));
  const fechar = () => { setAberto(null); if (window.location.search) window.history.replaceState(null, '', '/funil'); };
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase(); const d = b.replace(/\D/g, '');
    return b ? leads.filter((l) => (l.nome || '').toLowerCase().includes(b) || (d && l.telefone.includes(d))
      || (l.cidade || '').toLowerCase().includes(b) || (l.empreendimento || '').toLowerCase().includes(b)) : leads;
  }, [leads, busca]);

  async function aoSoltar(e: DragEndEvent) {
    const col = e.over?.id as string | undefined; const t = e.active.id as string;
    const l = leads.find((x) => x.telefone === t);
    if (!col || !l || l.status_crm === col) return;
    qc.setQueryData<Lead[]>(['leads'], (old) => (old || []).map((x) => (x.telefone === t ? { ...x, status_crm: col } : x)));
    await supabase.rpc('crm_lead_mover', { p_telefone: t, p_status_crm: col });
    qc.invalidateQueries({ queryKey: ['leads'] }); qc.invalidateQueries({ queryKey: ['resumo'] });
  }

  const num = (v: unknown) => (v == null ? '–' : Number(v).toLocaleString('pt-BR'));
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Cabecalho titulo="Funil" apoio={`Arraste o card para mudar de coluna. Ao passar para a ${EQUIPE} ou depois, a IA para de atender aquele lead.`}>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-apagado" />
          <input className="campo h-11 !rounded-2xl !border-white/90 !bg-white/80 pl-10" aria-label="Buscar" placeholder="Buscar nome, telefone, cidade ou loteamento" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </Cabecalho>
      <div className="flex flex-wrap gap-2 px-4 pb-3 md:px-0">
        <span className="aba-off !cursor-default">Chegaram hoje · <b className="numero">{num(resumo?.hoje)}</b></span>
        <span className="aba-off !cursor-default">Contratos recebidos · <b className="numero">{num(resumo?.contratos_recebidos)}</b></span>
        <span className="aba-off !cursor-default">Aguardando a {EQUIPE} · <b className="numero">{num(resumo?.aguardando_consultor)}</b></span>
      </div>
      {error && <div className="mx-4 mb-3 md:mx-0"><Erro>Não consegui carregar os leads. Atualize a página; se continuar, confira a internet.</Erro></div>}
      {isLoading ? <div className="px-4 py-6 text-sm text-apagado md:px-0">Carregando leads…</div> : (
        <DndContext sensors={sensores} onDragEnd={aoSoltar}>
          <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-4 pb-4 md:px-0 md:pb-0">
            {COLUNAS.map((c) => <Coluna key={c.id} {...c} leads={filtrados.filter((l) => l.status_crm === c.id)} onAbrir={setAberto} />)}
          </div>
        </DndContext>
      )}
      {aberto && <Gaveta onFechar={fechar}><LeadPainel telefone={aberto} onFechar={fechar} /></Gaveta>}
    </div>
  );
}
