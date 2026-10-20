import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Bot, BotOff, MessageCircle, FileCheck2, ExternalLink, ArrowDownCircle, BadgeDollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Lead } from '../lib/tipos';
import { COLUNAS, ETAPAS, EQUIPE, OPCOES, rotOpcao, simNao } from '../lib/tipos';
import { brl, dataHora, dinheiroParaBanco, dinheiroParaTela, tel } from '../lib/format';
import { textoStatus } from './ui';
import ChatPanel from './ChatPanel';

function Info({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return <div className="min-w-0"><div className="rotulo">{rotulo}</div><div className="break-words text-sm">{valor || '—'}</div></div>;
}

/** Campos que a equipe pode corrigir: exatamente os que o crm_lead_editar aceita. */
type Campo = { id: keyof Lead & string; rotulo: string; tipo: 'texto' | 'longo' | 'opcao' | 'simnao' | 'simnao_obrig' | 'inteiro' | 'dinheiro'; largo?: boolean; dica?: string };
const GRUPOS: { titulo: string; campos: Campo[] }[] = [
  { titulo: 'Caso', campos: [
    { id: 'nome', rotulo: 'Nome', tipo: 'texto', largo: true },
    { id: 'cidade', rotulo: 'Cidade - UF', tipo: 'texto', largo: true },
    { id: 'tipo_caso', rotulo: 'Tipo de caso', tipo: 'opcao' },
    { id: 'vendedor', rotulo: 'Comprou de', tipo: 'opcao' },
    { id: 'empreendimento', rotulo: 'Empreendimento / loteadora', tipo: 'texto', largo: true },
    { id: 'ano_compra', rotulo: 'Ano da compra', tipo: 'inteiro' },
    { id: 'origem_lead', rotulo: 'Como conheceu', tipo: 'opcao' },
    { id: 'motivo_cancelamento', rotulo: 'Motivo para cancelar', tipo: 'longo', largo: true },
  ] },
  { titulo: 'Pagamentos', campos: [
    { id: 'valor_pago', rotulo: 'Valor já pago (R$)', tipo: 'dinheiro', dica: 'Ex.: 25.000,00' },
    { id: 'parcelas', rotulo: 'Parcelas', tipo: 'opcao' },
    { id: 'qtd_atraso', rotulo: 'Parcelas em atraso', tipo: 'inteiro' },
    { id: 'pagou_entrada', rotulo: 'Pagou entrada', tipo: 'simnao' },
    { id: 'pagou_corretagem', rotulo: 'Pagou corretagem', tipo: 'simnao' },
    { id: 'notificacao', rotulo: 'Notificação', tipo: 'opcao' },
  ] },
  { titulo: 'Lote', campos: [
    { id: 'entrega', rotulo: 'Entrega do loteamento', tipo: 'opcao' },
    { id: 'construcao', rotulo: 'Construiu no lote', tipo: 'opcao' },
    { id: 'mora_no_lote', rotulo: 'Mora no lote', tipo: 'simnao' },
    { id: 'alienacao_mencionada', rotulo: 'Falou em alienação / banco', tipo: 'simnao_obrig' },
  ] },
  { titulo: 'Documentos', campos: [
    { id: 'contrato_recebido', rotulo: 'Contrato recebido', tipo: 'simnao_obrig' },
  ] },
];
const EDITAVEIS = [...GRUPOS.flatMap((g) => g.campos.map((c) => c.id)), 'observacoes'] as const;

const paraTexto = (v: unknown) => (v == null ? '' : typeof v === 'boolean' ? String(v) : String(v));

const DOCUMENTOS: Record<string, string> = {
  contrato: 'Contrato', relatorio: 'Relatório de pagamentos', comprovante: 'Comprovante', matricula: 'Matrícula',
  notificacao: 'Notificação', pessoal: 'Documento pessoal', outro: 'Outro documento',
};
const AVISOS: Record<string, string> = {
  valor_alto: 'valor alto', entrega_atrasada: 'entrega atrasada', construcao: 'construção no lote', alienacao: 'alienação / banco', presencial: 'quer presencial',
};

export default function LeadPainel({ telefone, onFechar, embutido = false }: { telefone: string; onFechar?: () => void; embutido?: boolean }) {
  const qc = useQueryClient();
  const [aba, setAba] = useState<'conversa' | 'dados'>('conversa');
  const { data: lead, error } = useQuery({
    queryKey: ['lead', telefone],
    queryFn: async () => {
      const { data, error } = await supabase.from('crm_leads').select('*').eq('telefone', telefone).maybeSingle();
      if (error) throw error; return data as Lead | null;
    },
  });
  const [form, setForm] = useState<Record<string, string>>({});
  const [orig, setOrig] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');
  const sujo = Object.keys(form).some((k) => form[k] !== orig[k]);
  useEffect(() => {
    if (!lead) return;
    const base = Object.fromEntries(EDITAVEIS.map((k) => [k, k === 'valor_pago' ? dinheiroParaTela(lead[k]) : paraTexto(lead[k])]));
    setOrig(base);
    // não atropela o que a pessoa está digitando quando a IA atualiza o lead
    setForm((f) => (Object.keys(f).length === 0 || !Object.keys(f).some((k) => f[k] !== orig[k]) ? base : f));
  }, [lead?.telefone, lead?.atualizado_em]); // eslint-disable-line react-hooks/exhaustive-deps

  // o lead aberto se atualiza sozinho quando a IA ou outra pessoa mexe nele
  useEffect(() => {
    const ch = supabase.channel(`crm:lead:${telefone}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads', filter: `telefone=eq.${telefone}` },
        () => qc.invalidateQueries({ queryKey: ['lead', telefone] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [telefone, qc]);

  const atualizar = () => { qc.invalidateQueries({ queryKey: ['lead', telefone] }); qc.invalidateQueries({ queryKey: ['leads'] }); qc.invalidateQueries({ queryKey: ['resumo'] }); };
  async function ia(ligar: boolean) { await supabase.rpc('crm_ia', { p_telefone: telefone, p_ligar: ligar }); atualizar(); }
  async function mover(col: string) { await supabase.rpc('crm_lead_mover', { p_telefone: telefone, p_status_crm: col }); atualizar(); }
  async function salvar() {
    setSalvando(true); setMsg('');
    // só os campos alterados (não sobrescreve o que a IA gravou nos outros)
    const mudou: Record<string, string> = {};
    Object.keys(form).forEach((k) => { if (form[k] !== orig[k]) mudou[k] = k === 'valor_pago' ? dinheiroParaBanco(form[k]) : form[k].trim(); });
    if (Object.keys(mudou).length === 0) { setSalvando(false); setMsg('Nada para salvar.'); return; }
    const { data, error } = await supabase.rpc('crm_lead_editar', { p_telefone: telefone, p: mudou });
    const st = (data as any)?.status;
    if (!error && st === 'ok') setOrig(form);
    setSalvando(false);
    setMsg(error ? 'Não salvou. Confira a conexão e tente de novo.' : textoStatus(st));
    atualizar();
  }

  if (error) return <div className="bg-white p-6 text-sm text-alerta">Não consegui abrir este lead. Feche e tente de novo.</div>;
  if (!lead) return <div className="bg-white p-6 text-sm text-apagado">Carregando…</div>;
  const docs = Object.entries(lead.documentos_dados || {});
  const avisos = Object.keys(lead.avisos_enviados || {}).map((k) => AVISOS[k] || k);
  const set = (k: string, v: string) => setForm({ ...form, [k]: v });

  function controle(c: Campo) {
    const v = form[c.id] ?? '';
    const id = `lead-${c.id}`;
    const el = c.tipo === 'opcao' ? (
      <select id={id} className="campo" value={v} onChange={(e) => set(c.id, e.target.value)}>
        <option value="">—</option>{(OPCOES[c.id] || []).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
      </select>
    ) : c.tipo === 'simnao' || c.tipo === 'simnao_obrig' ? (
      <select id={id} className="campo" value={v || (c.tipo === 'simnao_obrig' ? 'false' : '')} onChange={(e) => set(c.id, e.target.value)}>
        {c.tipo === 'simnao' && <option value="">—</option>}<option value="true">Sim</option><option value="false">Não</option>
      </select>
    ) : c.tipo === 'longo' ? (
      <textarea id={id} className="campo" rows={2} value={v} onChange={(e) => set(c.id, e.target.value)} />
    ) : (
      <input id={id} className="campo" value={v} placeholder={c.dica}
        inputMode={c.tipo === 'inteiro' ? 'numeric' : c.tipo === 'dinheiro' ? 'decimal' : undefined}
        onChange={(e) => set(c.id, c.tipo === 'inteiro' ? e.target.value.replace(/\D/g, '') : e.target.value)} />
    );
    return <div key={c.id} className={c.largo ? 'col-span-2' : ''}><label className="rotulo" htmlFor={id}>{c.rotulo}</label>{el}</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="border-b border-linha px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-display text-xl font-semibold">{lead.nome || tel(lead.telefone)}</div>
            <a className="inline-flex items-center gap-1 text-sm text-apagado hover:text-tinta" href={`https://wa.me/${lead.telefone}`} target="_blank" rel="noreferrer">
              {tel(lead.telefone)} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          {!embutido && onFechar && <button className="btn-sec !px-2" onClick={onFechar} aria-label="Fechar"><X className="h-4 w-4" /></button>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="chip bg-papel text-noite-600">{ETAPAS[lead.etapa_atual] || lead.etapa_atual}</span>
          <span className="chip bg-papel text-noite-600">{rotOpcao('status_lead', lead.status_lead)}</span>
          {lead.valor_pago != null && <span className="chip bg-sol-100 text-sol-700"><BadgeDollarSign className="h-3 w-3" />Pago {brl(lead.valor_pago)}</span>}
          {lead.prioridade === 'baixa' && <span className="chip bg-papel text-apagado"><ArrowDownCircle className="h-3 w-3" />Prioridade baixa</span>}
          {lead.prioridade === 'alta' && <span className="chip bg-petroleo-100 text-petroleo-700">Valor alto</span>}
          {lead.contrato_recebido && <span className="chip bg-menta-100 text-menta-700"><FileCheck2 className="h-3 w-3" />Contrato recebido</span>}
          {lead.pausar_ia ? <span className="chip bg-[#FFF1D6] text-[#7A4F00]"><BotOff className="h-3 w-3" />IA pausada</span>
            : <span className="chip bg-menta-100 text-menta-700"><Bot className="h-3 w-3" />IA ativa</span>}
        </div>
        {lead.motivo_handoff && lead.pausar_ia && <div className="mt-2 rounded-xl bg-sol-100 px-3 py-2 text-sm text-sol-700"><b>Por que veio para a {EQUIPE}:</b> {lead.motivo_handoff}</div>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {lead.pausar_ia
            ? <button className="btn-sec" onClick={() => ia(true)}><Bot className="h-4 w-4" />Devolver para a IA</button>
            : <button className="btn-sec" onClick={() => ia(false)}><BotOff className="h-4 w-4" />Pausar IA</button>}
          <select className="campo !w-auto" aria-label="Coluna do funil" value={lead.status_crm} onChange={(e) => mover(e.target.value)}>
            {COLUNAS.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
          </select>
        </div>
        <div className="mt-3 flex gap-1.5">
          <button aria-pressed={aba === 'conversa'} className={aba === 'conversa' ? 'aba-on' : 'aba-off !bg-papel'} onClick={() => setAba('conversa')}><MessageCircle className="h-3.5 w-3.5" />Conversa</button>
          <button aria-pressed={aba === 'dados'} className={aba === 'dados' ? 'aba-on' : 'aba-off !bg-papel'} onClick={() => setAba('dados')}>Dados do caso</button>
        </div>
      </div>

      {aba === 'conversa' ? <div className="flex-1 min-h-0"><ChatPanel key={telefone} telefone={telefone} /></div> : (
        <div className="flex-1 min-h-0 space-y-4 overflow-y-auto bg-papel/60 p-4">
          {GRUPOS.map((g) => (
            <section key={g.titulo} className="grid grid-cols-2 gap-3 rounded-[18px] bg-white p-4 shadow-card">
              <h3 className="col-span-2 text-sm font-bold">{g.titulo}</h3>
              {g.campos.map(controle)}
              {g.titulo === 'Lote' && <>
                <Info rotulo="Construção regularizada" valor={rotOpcao('construcao_regular', lead.construcao_regular)} />
                <Info rotulo="Quer atendimento presencial" valor={simNao(lead.quer_presencial)} />
              </>}
              {g.titulo === 'Documentos' && <>
                <Info rotulo="Contrato chegou em" valor={lead.contrato_recebido_em ? dataHora(lead.contrato_recebido_em) : null} />
                <Info rotulo="Relatório ou comprovante" valor={lead.relatorio_recebido ? 'Recebido' : 'Ainda não'} />
                <Info rotulo="Prioridade" valor={rotOpcao('prioridade', lead.prioridade)} />
                {!docs.length && <div className="col-span-2 text-xs text-apagado">Nenhum documento lido ainda.</div>}
                {docs.map(([tipo, d]) => (
                  <div key={tipo} className="col-span-2 rounded-xl bg-papel/70 p-3">
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-[13px] font-bold">
                      {DOCUMENTOS[tipo] || tipo}
                      {!!d?.lido_em && <span className="text-[11px] font-semibold text-apagado">lido em {dataHora(String(d.lido_em))}</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {d?.loteadora != null && <Info rotulo="Loteadora" valor={String(d.loteadora)} />}
                      {d?.empreendimento != null && <Info rotulo="Empreendimento" valor={String(d.empreendimento)} />}
                      {(d?.quadra != null || d?.lote != null) && <Info rotulo="Quadra / lote" valor={[d.quadra, d.lote].filter((x) => x != null).join(' / ')} />}
                      {d?.data_contrato != null && <Info rotulo="Data do contrato" valor={String(d.data_contrato)} />}
                      {d?.valor_contrato != null && <Info rotulo="Valor do contrato" valor={brl(Number(d.valor_contrato))} />}
                      {d?.valor_total_pago != null && <Info rotulo="Total pago (lido)" valor={brl(Number(d.valor_total_pago))} />}
                      {d?.alienacao != null && <Info rotulo="Alienação fiduciária" valor={d.alienacao === 'consta' ? 'Consta' : d.alienacao === 'nao_consta' ? 'Não consta' : String(d.alienacao)} />}
                    </div>
                  </div>
                ))}
              </>}
            </section>
          ))}

          <section className="rounded-[18px] bg-white p-4 shadow-card">
            <label className="rotulo" htmlFor="lead-observacoes">Observações da equipe</label>
            <textarea id="lead-observacoes" className="campo" rows={3} value={form.observacoes || ''} onChange={(e) => set('observacoes', e.target.value)} />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button className="btn-primario" onClick={salvar} disabled={salvando || !sujo}>{salvando ? 'Salvando…' : 'Salvar'}</button>
              {sujo && !salvando && <button className="btn-sec" onClick={() => { setForm(orig); setMsg(''); }}>Descartar</button>}
              <span className="text-sm text-apagado" role="status">{msg}</span>
            </div>
          </section>

          <section className="rounded-[18px] bg-white p-4 shadow-card">
            <div className="mb-2 text-sm font-bold">O que o agente anotou</div>
            <div className="whitespace-pre-wrap text-sm text-tinta/90">{lead.perfil_lead || '—'}</div>
            {avisos.length > 0 && <div className="mt-2 text-xs text-apagado">Avisos já mandados à {EQUIPE}: {avisos.join(', ')}.</div>}
          </section>

          <section className="grid grid-cols-2 gap-3 rounded-[18px] bg-white p-4 shadow-card">
            <div className="col-span-2 text-sm font-bold">Acompanhamento</div>
            <Info rotulo="Campanha" valor={lead.origem_campanha} />
            <Info rotulo="Indicado por" valor={lead.indicado_por} />
            <Info rotulo="Próximo follow-up" valor={lead.proximo_followup ? dataHora(lead.proximo_followup) : 'nenhum'} />
            <Info rotulo="Retorno combinado" valor={lead.retorno_prometido_em ? `${dataHora(lead.retorno_prometido_em)}${lead.retorno_motivo ? ' · ' + lead.retorno_motivo : ''}` : null} />
            <Info rotulo="Recontato" valor={lead.retomar_em ? dataHora(lead.retomar_em) : null} />
            <Info rotulo="Entrou em" valor={dataHora(lead.criado_em)} />
            {lead.motivo_status && <div className="col-span-2"><Info rotulo="Observação de status" valor={lead.motivo_status} /></div>}
          </section>
        </div>
      )}
    </div>
  );
}
