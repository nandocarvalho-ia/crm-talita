import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Lock, RotateCcw, Save, History } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import { dataHora } from '../lib/format';
import { GRUPOS_CONFIG, validarConfig, type ItemCfg } from '../lib/config';
import { Cabecalho, Erro, textoStatus } from '../components/ui';
import ModelosIA from '../components/ModelosIA';
import WhatsAppConexao from '../components/WhatsAppConexao';
import Audios from '../components/Audios';

const CAMPOS: { id: string; titulo: string; ajuda: string; livre: boolean }[] = [
  { id: 'base_conhecimento', titulo: 'Base de conhecimento', ajuda: 'O que a IA pode afirmar sobre o escritório e o direito do comprador: honorários, onde fica, como funciona o processo. O que não estiver aqui, ela não afirma.', livre: true },
  { id: 'objecoes', titulo: 'Objeções e respostas', ajuda: 'Como responder às dúvidas mais comuns, do jeito da Dra. Talita.', livre: true },
  { id: 'identidade', titulo: 'Identidade e tom de voz', ajuda: 'Quem atende e como fala.', livre: false },
  { id: 'script', titulo: 'Roteiro do funil', ajuda: 'Etapas, o que perguntar e quando avançar.', livre: false },
  { id: 'transferencia', titulo: 'Quando passar para a Dra. Talita', ajuda: '', livre: false },
  { id: 'tools', titulo: 'Ferramentas', ajuda: '', livre: false },
  { id: 'regras_finais', titulo: 'Regras que nunca quebra', ajuda: '', livre: false },
  { id: 'regra_fundamental', titulo: 'Regra fundamental', ajuda: '', livre: false },
];
const TIPOS: { id: 'agente' | 'classificador' | 'followup'; titulo: string; ajuda: string }[] = [
  { id: 'agente', titulo: 'Agente (conversa)', ajuda: 'O que a IA fala com o lead.' },
  { id: 'classificador', titulo: 'Classificador', ajuda: 'Lê cada turno e grava os dados do caso. Mudanças aqui mexem no funil: teste antes.' },
  { id: 'followup', titulo: 'Follow-up', ajuda: 'Como a IA escreve a mensagem de retomada a partir da conversa.' },
];

function CampoPrompt({ tipo, campo, valor, padrao, podeEditar }: { tipo: string; campo: typeof CAMPOS[number]; valor: string; padrao: string; podeEditar: boolean }) {
  const qc = useQueryClient();
  const [txt, setTxt] = useState(valor);
  const [msg, setMsg] = useState('');
  useEffect(() => setTxt(valor), [valor]);
  const mudou = txt !== valor;
  async function salvar() {
    const { data, error } = await supabase.rpc('crm_prompt_salvar', { p_tipo: tipo, p_campo: campo.id, p_texto: txt });
    setMsg(error ? 'Não salvou. Confira a conexão e tente de novo.' : (data as any)?.status === 'ok' ? 'Salvo. Vale a partir da próxima mensagem.' : textoStatus((data as any)?.status));
    qc.invalidateQueries({ queryKey: ['prompts'] }); qc.invalidateQueries({ queryKey: ['historico'] });
  }
  async function restaurar() {
    if (!confirm('Voltar este campo para o texto padrão entregue na implantação?')) return;
    const { data } = await supabase.rpc('crm_prompt_restaurar', { p_tipo: tipo, p_campo: campo.id });
    setMsg((data as any)?.status === 'ok' ? 'Padrão restaurado.' : textoStatus((data as any)?.status));
    qc.invalidateQueries({ queryKey: ['prompts'] });
  }
  return (
    <div className="cartao p-5">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="font-bold">{campo.titulo}</h3>
        {!podeEditar && <span className="chip bg-papel text-apagado"><Lock className="h-3 w-3" />só administrador</span>}
        {valor !== padrao && <span className="chip bg-sol-100 text-sol-700">alterado</span>}
      </div>
      {campo.ajuda && <p className="mb-2 text-xs text-apagado">{campo.ajuda}</p>}
      <textarea className="campo font-mono text-[12.5px] leading-relaxed" aria-label={campo.titulo} rows={Math.min(24, Math.max(6, txt.split('\n').length + 1))}
        value={txt} readOnly={!podeEditar} onChange={(e) => setTxt(e.target.value)} />
      {podeEditar && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button className="btn-primario" disabled={!mudou} onClick={salvar}><Save className="h-4 w-4" />Salvar</button>
          {mudou && <button className="btn-sec" onClick={() => setTxt(valor)}>Descartar</button>}
          {valor !== padrao && <button className="btn-sec" onClick={restaurar}><RotateCcw className="h-4 w-4" />Restaurar padrão</button>}
          <span className="text-sm text-apagado" role="status">{msg}</span>
        </div>
      )}
    </div>
  );
}

function Prompts() {
  const { admin } = useAuth();
  const [tipo, setTipo] = useState<'agente' | 'classificador' | 'followup'>('agente');
  const { data, isLoading, error } = useQuery({ queryKey: ['prompts'], queryFn: async () => {
    const [a, b] = await Promise.all([supabase.from('prompts').select('*'), supabase.from('prompts_padrao').select('*')]);
    if (a.error || b.error) throw a.error || b.error;
    return { atual: a.data || [], padrao: b.data || [] };
  } });
  const { data: hist = [] } = useQuery({ queryKey: ['historico'], queryFn: async () =>
    (await supabase.from('prompts_historico').select('id,tipo,campo,alterado_por,alterado_em').order('id', { ascending: false }).limit(15)).data || [] });
  const atual = data?.atual.find((p: any) => p.tipo === tipo) || {};
  const padrao = data?.padrao.find((p: any) => p.tipo === tipo) || {};
  // agente: as 8 seções; classificador e follow-up: só as seções que têm texto
  const campos = tipo === 'agente' ? CAMPOS : CAMPOS.filter((c) => (atual as any)[c.id] || (padrao as any)[c.id]);
  const tipos = admin ? TIPOS : TIPOS.filter((t) => t.id === 'agente');
  if (error) return <Erro>Não consegui carregar os prompts. Atualize a página.</Erro>;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {tipos.map((t) => <button key={t.id} aria-pressed={tipo === t.id} className={tipo === t.id ? 'aba-on' : 'aba-off'} onClick={() => setTipo(t.id)}>{t.titulo}</button>)}
          <span className="ml-auto text-xs text-noite-600">Versão {(atual as any).versao || '—'} · última edição {dataHora((atual as any).atualizado_em)} por {(atual as any).atualizado_por || '—'}</span>
        </div>
        <p className="text-xs text-apagado">{TIPOS.find((t) => t.id === tipo)?.ajuda}</p>
        {isLoading && <div className="cartao p-5 text-sm text-apagado">Carregando…</div>}
        {!isLoading && !campos.length && <div className="cartao p-5 text-sm text-apagado">Este prompt ainda não foi carregado no banco.</div>}
        {campos.map((c) => <CampoPrompt key={tipo + c.id} tipo={tipo} campo={c} valor={(atual as any)[c.id] || ''} padrao={(padrao as any)[c.id] || ''} podeEditar={admin || c.livre} />)}
      </div>
      <aside className="cartao h-max p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold"><History className="h-4 w-4" />Últimas alterações</div>
        {!hist.length && <div className="text-xs text-apagado">Nenhuma alteração ainda.</div>}
        <ul className="space-y-2">{hist.map((h: any) => (
          <li key={h.id} className="text-xs"><b>{CAMPOS.find((c) => c.id === h.campo)?.titulo || h.campo}</b> ({TIPOS.find((t) => t.id === h.tipo)?.titulo || h.tipo})<br /><span className="text-apagado">{dataHora(h.alterado_em)} · {h.alterado_por}</span></li>
        ))}</ul>
      </aside>
    </div>
  );
}

const ETAPA_FUP: Record<string, string> = {
  etapa_1: 'Etapa 1 · Identificar (não respondeu a abertura)', etapa_2: 'Etapa 2 · Qualificar e explicar', etapa_3: 'Etapa 3 · Contrato para análise',
  retorno: 'Retorno combinado', recontato: 'Recontato (lead que esfriou)',
};
function tempo(min: number) { if (min === 0) return 'na hora combinada'; if (min < 60) return `${min} min`; if (min < 1440) return `${Math.round(min / 60)} h`; const d = Math.round(min / 1440); return `${d} ${d === 1 ? 'dia' : 'dias'}`; }

function Followups() {
  const { admin } = useAuth();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['followups'], queryFn: async () => (await supabase.from('followups').select('*').order('etapa').order('tentativa')).data || [] });
  const [edit, setEdit] = useState<Record<string, { texto: string; delay: number; ativo: boolean }>>({});
  const [msg, setMsg] = useState('');
  async function salvar(f: any) {
    const k = f.etapa + f.tentativa; const e = edit[k];
    const { data: r } = await supabase.rpc('crm_followup_salvar', { p_etapa: f.etapa, p_tentativa: f.tentativa, p_texto: e.texto, p_ativo: e.ativo, p_delay: admin ? e.delay : null });
    setMsg(textoStatus((r as any)?.status));
    setEdit((x) => { const n = { ...x }; delete n[k]; return n; }); qc.invalidateQueries({ queryKey: ['followups'] });
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-noite-600">
        A IA escreve cada mensagem de retomada na hora, a partir da conversa (prompt Follow-up). Os textos abaixo são a <b>reserva</b>: saem quando a IA falha ou escreve fora das regras, e os tempos valem sempre.
        {' '}<code>{'{{saudacao}}'}</code> vira Bom dia/Boa tarde/Boa noite e <code>{'{{nome}}'}</code> o primeiro nome; no retorno combinado, <code>{'{{quando}}'}</code> e <code>{'{{motivo}}'}</code> vêm do que o lead falou. Envio só na janela das Configurações. {msg && <b className="text-tinta">{msg}</b>}
      </p>
      {isLoading && <div className="cartao p-5 text-sm text-apagado">Carregando…</div>}
      {Object.keys(ETAPA_FUP).map((et) => {
        const itens = data.filter((f: any) => f.etapa === et);
        if (!isLoading && !itens.length) return null;
        return (
          <section key={et} className="cartao p-5">
            <h3 className="mb-3 font-bold">{ETAPA_FUP[et]}</h3>
            <div className="space-y-3">
              {itens.map((f: any) => {
                const k = f.etapa + f.tentativa; const e = edit[k];
                return (
                  <div key={k} className="grid gap-2 sm:grid-cols-[110px_1fr]">
                    <div className="text-xs text-apagado"><b className="text-tinta">Toque {f.tentativa}</b><br />{et === 'retorno' || et === 'recontato' ? '' : `depois de ${tempo(f.delay_minutos)}`}</div>
                    <div>
                      <textarea className="campo" aria-label={`Texto do toque ${f.tentativa}`} rows={2} value={e ? e.texto : f.texto} onChange={(ev) => setEdit({ ...edit, [k]: { texto: ev.target.value, delay: e?.delay ?? f.delay_minutos, ativo: e?.ativo ?? f.ativo } })} />
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                        <label className="flex items-center gap-1"><input type="checkbox" checked={e ? e.ativo : f.ativo} onChange={(ev) => setEdit({ ...edit, [k]: { texto: e?.texto ?? f.texto, delay: e?.delay ?? f.delay_minutos, ativo: ev.target.checked } })} />ativo</label>
                        {admin && et.startsWith('etapa') && <label className="flex items-center gap-1">minutos depois:<input type="number" min={10} className="campo !w-24 !py-1" value={e ? e.delay : f.delay_minutos} onChange={(ev) => setEdit({ ...edit, [k]: { texto: e?.texto ?? f.texto, delay: Number(ev.target.value), ativo: e?.ativo ?? f.ativo } })} /></label>}
                        {e && <button className="btn-primario !py-1" onClick={() => salvar(f)}>Salvar</button>}
                        {f.observacao && <span className="text-apagado">{f.observacao}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CampoConfig({ item, valor }: { item: ItemCfg; valor: string | undefined }) {
  const qc = useQueryClient();
  const [v, setV] = useState<string | undefined>(undefined);
  const [msg, setMsg] = useState<{ erro: boolean; txt: string } | null>(null);
  const atual = v ?? valor ?? '';
  const mudou = v !== undefined && v !== valor;
  const problema = mudou ? validarConfig(item.chave, atual) : null;
  const id = `cfg-${item.chave}`;
  async function salvar() {
    if (problema) return;
    const { data: r, error } = await supabase.rpc('crm_config_salvar', { p_chave: item.chave, p_valor: atual.trim() });
    const ok = !error && (r as any)?.status === 'ok';
    setMsg({ erro: !ok, txt: error ? 'Não salvou. Confira a conexão.' : textoStatus((r as any)?.status) });
    if (ok) setV(undefined);
    qc.invalidateQueries({ queryKey: ['config'] }); qc.invalidateQueries({ queryKey: ['config-historico'] });
  }
  if (valor === undefined) return null;   // chave ainda não existe no banco
  let campo;
  if (item.tipo === 'leitura') campo = <input id={id} className="campo !bg-papel" readOnly value={atual} />;
  else if (item.tipo === 'simnao') campo = (
    <select id={id} className="campo !w-40" value={atual} onChange={(e) => { setV(e.target.value); setMsg(null); }}>
      <option value="true">Sim</option><option value="false">Não</option>
    </select>
  );
  else campo = (
    <input id={id} className={`campo ${item.tipo === 'hora' ? '!w-32' : item.tipo.startsWith('reais') || item.tipo === 'dias' ? '!w-40' : ''}`}
      value={atual} placeholder={item.tipo === 'hora' ? 'HH:MM' : undefined}
      inputMode={item.tipo.startsWith('reais') || item.tipo === 'dias' ? 'numeric' : item.tipo === 'telefones' ? 'tel' : undefined}
      onChange={(e) => { setV(e.target.value); setMsg(null); }} />
  );
  return (
    <div>
      <label className="rotulo" htmlFor={id}>{item.rotulo}</label>
      <div className="flex flex-wrap items-center gap-2">
        {campo}
        {mudou && <button className="btn-primario" disabled={!!problema} onClick={salvar}>Salvar</button>}
        {mudou && <button className="btn-sec" onClick={() => { setV(undefined); setMsg(null); }}>Descartar</button>}
      </div>
      {item.ajuda && <div className="mt-1 text-[12px] text-apagado">{item.ajuda}</div>}
      {problema && <div className="mt-1 text-[12px] font-semibold text-alerta">{problema}</div>}
      {msg && <div role="status" className={`mt-1 text-[12px] font-semibold ${msg.erro ? 'text-alerta' : 'text-menta-700'}`}>{msg.txt}</div>}
    </div>
  );
}

function Configuracoes() {
  const { data, isLoading, error } = useQuery({ queryKey: ['config'], queryFn: async () => (await supabase.from('config').select('*').order('chave')).data || [] });
  const valores: Record<string, string> = Object.fromEntries(((data || []) as any[]).map((c) => [c.chave, c.valor ?? '']));
  return (
    <div className="space-y-4">
      <ModelosIA />
      {error && <Erro>Não consegui carregar as configurações. Atualize a página.</Erro>}
      {isLoading && <div className="cartao max-w-3xl p-5 text-sm text-apagado">Carregando…</div>}
      {!isLoading && GRUPOS_CONFIG.map((g) => (
        <section key={g.titulo} className="cartao max-w-3xl space-y-4 p-5">
          <div>
            <h2 className="text-[15px] font-bold">{g.titulo}</h2>
            {g.apoio && <p className="mt-0.5 text-[13px] text-noite-600">{g.apoio}</p>}
          </div>
          {g.itens.map((i) => <CampoConfig key={i.chave} item={i} valor={valores[i.chave]} />)}
        </section>
      ))}
    </div>
  );
}

type Aba = 'prompt' | 'followup' | 'config' | 'audios' | 'whatsapp';
const ABAS: { id: Aba; titulo: string; admin: boolean }[] = [
  { id: 'prompt', titulo: 'Comportamento', admin: false },
  { id: 'followup', titulo: 'Follow-up', admin: false },
  { id: 'config', titulo: 'Configurações', admin: true },
  { id: 'audios', titulo: 'Áudios', admin: true },
  { id: 'whatsapp', titulo: 'WhatsApp', admin: true },
];

export default function Agente() {
  const { admin } = useAuth();
  const [params, setParams] = useSearchParams();
  const abas = ABAS.filter((a) => admin || !a.admin);
  const pedida = params.get('aba') as Aba | null;
  const aba: Aba = abas.some((a) => a.id === pedida) ? pedida! : 'prompt';
  const setAba = (a: Aba) => setParams(a === 'prompt' ? {} : { aba: a }, { replace: true });
  return (
    <div className="h-full overflow-y-auto md:pr-1">
      <Cabecalho titulo="Agente" apoio={admin ? 'Como a IA conversa, os follow-ups, as configurações, os áudios da Dra. e a conexão do WhatsApp.' : 'Como a IA conversa e os textos de follow-up.'} />
      <div className="flex flex-wrap gap-1.5 px-4 pb-3 md:px-0">
        {abas.map((a) => <button key={a.id} aria-pressed={aba === a.id} className={aba === a.id ? 'aba-on' : 'aba-off'} onClick={() => setAba(a.id)}>{a.titulo}</button>)}
      </div>
      <div className="px-4 pb-4 md:px-0">
        {aba === 'prompt' ? <Prompts /> : aba === 'followup' ? <Followups /> : aba === 'config' ? <Configuracoes /> : aba === 'audios' ? <Audios /> : <WhatsAppConexao />}
      </div>
    </div>
  );
}
