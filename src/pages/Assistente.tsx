import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronRight, FileText, ImageIcon, KeyRound, Mic, Paperclip, Send, Sparkles, Square, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { assistente } from '../lib/funcoes';
import { dataHora } from '../lib/format';
import { CONFIG_ROTULOS } from '../lib/config';
import { Cabecalho, Erro, textoStatus } from '../components/ui';
import { Diferencas, useSenha } from '../components/PromptVersoes';

type Msg = { id: number; papel: 'talita' | 'assistente' | 'sistema'; canal: string; texto: string; meta: any; em: string };
type Proposta = { id: number; tipo: 'prompt' | 'config'; alvo_tipo: string | null; alvo_campo: string; texto_antes: string | null; texto_novo: string;
  explicacao: string; estrutural: boolean; teste: any; status: string; criado_em: string; resolvido_por: string | null };

const PARTES: Record<string, string> = {
  identidade: 'Identidade e tom de voz', base_conhecimento: 'Base de conhecimento', script: 'Roteiro do funil', objecoes: 'Objeções e respostas',
  transferencia: 'Quando passar para a Dra.', tools: 'Ferramentas', regras_finais: 'Regras que nunca quebra', regra_fundamental: 'Regra fundamental',
};
const TIPOS: Record<string, string> = { agente: 'Conversa', classificador: 'Classificador', followup: 'Retornos' };
const SITUACAO: Record<string, [string, string]> = {
  aberta: ['esperando você', 'bg-sol-100 text-sol-700'], aplicada: ['aplicada', 'bg-menta-100 text-menta-700'],
  descartada: ['descartada', 'bg-papel text-apagado'], substituida: ['trocada por outra', 'bg-papel text-apagado'],
  desatualizada: ['desatualizada', 'bg-alerta-100 text-alerta'], vencida: ['vencida', 'bg-papel text-apagado'],
};
const titulo = (p: Proposta) => p.tipo === 'config' ? `Configuração: ${CONFIG_ROTULOS[p.alvo_campo] || p.alvo_campo}`
  : `${PARTES[p.alvo_campo] || p.alvo_campo}${p.alvo_tipo && p.alvo_tipo !== 'agente' ? ` (${TIPOS[p.alvo_tipo] || p.alvo_tipo})` : ''}`;
const pedeSenha = (p: Proposta) => p.estrutural || p.tipo === 'config';

function frase(r: any) {
  switch (r?.status) {
    case 'ok': return 'Aplicado. Vale a partir da próxima mensagem.';
    case 'desatualizada': return 'Não apliquei: o texto mudou depois da proposta. Peça de novo para a Clara.';
    case 'vencida': return 'Esta proposta venceu (mais de 7 dias). Peça de novo.';
    case 'ja_resolvida': return 'Esta proposta já foi resolvida.';
    case 'aprovacao_invalida': return 'A confirmação da senha venceu. Tente de novo.';
    case 'precisa_senha': return 'Não apliquei: a senha não foi confirmada.';
    case 'prompt_incompleto': return 'Não apliquei: a mudança tiraria algo que o sistema precisa.';
    default: return textoStatus(r?.status);
  }
}

function Teste({ teste }: { teste: any }) {
  const [aberto, setAberto] = useState(false);
  const cen = (teste?.cenarios || []) as any[];
  if (!cen.length) return null;
  return (
    <div className="mt-2">
      <button className="flex items-center gap-1 text-xs font-semibold text-petroleo" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        {aberto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}Teste rápido ({cen.length} {cen.length === 1 ? 'situação' : 'situações'})
      </button>
      {aberto && <div className="mt-2 space-y-2">{cen.map((c, i) => (
        <div key={i} className="rounded-xl bg-white/90 p-2.5 text-xs ring-1 ring-linha">
          <div className="font-semibold">{c.descricao}</div>
          {c.ultima_do_lead && <div className="mt-1 text-apagado">Lead: “{c.ultima_do_lead}”</div>}
          {c.erro ? <div className="mt-1 text-alerta">Não deu para testar ({c.erro}).</div> : (
            <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
              <div className="rounded-lg bg-papel p-2"><div className="mb-0.5 font-semibold text-apagado">Hoje</div><div className="whitespace-pre-wrap">{c.hoje?.resposta}</div>
                {!!c.hoje?.ferramentas?.length && <div className="mt-1 text-apagado">→ {c.hoje.ferramentas.join(', ')}</div>}</div>
              <div className="rounded-lg bg-menta-100/60 p-2"><div className="mb-0.5 font-semibold text-menta-700">Com a mudança</div><div className="whitespace-pre-wrap">{c.com_a_mudanca?.resposta}</div>
                {!!c.com_a_mudanca?.ferramentas?.length && <div className="mt-1 text-apagado">→ {c.com_a_mudanca.ferramentas.join(', ')}</div>}</div>
            </div>)}
        </div>))}</div>}
    </div>
  );
}

function Cartoes({ ids, pedirSenha }: { ids: number[]; pedirSenha: () => Promise<string | null> }) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ['propostas', ids.join(',')], queryFn: async () =>
    ((await supabase.from('assistente_propostas').select('*').in('id', ids).order('id')).data || []) as Proposta[] });
  const [ver, setVer] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const abertas = data.filter((p) => p.status === 'aberta');
  async function aplicar(lista: Proposta[]) {
    setOcupado(true); setMsg('');
    try {
      const chamada = (ap?: string) => lista.length === 1
        ? supabase.rpc('assistente_proposta_aplicar', { p_id: lista[0].id, ...(ap ? { p_aprovacao: ap } : {}) })
        : supabase.rpc('assistente_propostas_aplicar', { p_ids: lista.map((p) => p.id), ...(ap ? { p_aprovacao: ap } : {}) });
      let { data: r, error } = await chamada();
      if (!error && (r as any)?.status === 'precisa_senha') {
        const ap = await pedirSenha();
        if (!ap) { setMsg('Não apliquei: a senha não foi confirmada.'); return; }
        ({ data: r, error } = await chamada(ap));
      }
      setMsg(error ? 'Não apliquei. Confira a conexão e tente de novo.' : frase(r));
    } finally {
      setOcupado(false);
      for (const k of ['propostas', 'assistente-msgs', 'prompts', 'prompt-estado', 'historico', 'config']) qc.invalidateQueries({ queryKey: [k] });
    }
  }
  async function descartar(p: Proposta) {
    const { data: r } = await supabase.rpc('assistente_proposta_descartar', { p_id: p.id });
    setMsg((r as any)?.status === 'ok' ? 'Descartada.' : textoStatus((r as any)?.status));
    qc.invalidateQueries({ queryKey: ['propostas'] }); qc.invalidateQueries({ queryKey: ['assistente-msgs'] });
  }
  if (!data.length) return null;
  return (
    <div className="mt-2 space-y-2">
      {data.map((p) => {
        const [sit, cor] = SITUACAO[p.status] || [p.status, 'bg-papel text-apagado'];
        return (
          <div key={p.id} className="rounded-2xl bg-white/95 p-3 ring-1 ring-linha">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-bold">{titulo(p)}</span>
              <span className={`chip ${cor}`}>{sit}</span>
              {pedeSenha(p) && p.status === 'aberta' && <span className="chip bg-papel text-noite-600"><KeyRound className="h-3 w-3" />pede senha</span>}
            </div>
            <p className="mt-1 text-sm text-noite-600">{p.explicacao}</p>
            {p.tipo === 'config'
              ? <p className="mt-1 text-sm">De <b>{p.texto_antes || '(vazio)'}</b> para <b>{p.texto_novo || '(vazio)'}</b></p>
              : <>
                  <button className="mt-1 flex items-center gap-1 text-xs font-semibold text-petroleo" aria-expanded={ver === p.id} onClick={() => setVer(ver === p.id ? null : p.id)}>
                    {ver === p.id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}Ver o que muda
                  </button>
                  {ver === p.id && <div className="mt-2"><Diferencas antes={p.texto_antes || ''} depois={p.texto_novo} rotuloAntes="hoje" rotuloDepois="com a mudança" /></div>}
                </>}
            <Teste teste={p.teste} />
            {p.status === 'aberta' && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="btn-primario !py-1.5" disabled={ocupado} onClick={() => aplicar([p])}>{pedeSenha(p) ? <KeyRound className="h-4 w-4" /> : <Check className="h-4 w-4" />}Aplicar</button>
                <button className="btn-sec !py-1.5" disabled={ocupado} onClick={() => descartar(p)}><X className="h-4 w-4" />Descartar</button>
              </div>)}
          </div>
        );
      })}
      {abertas.length > 1 && (
        <button className="btn-sol w-full" disabled={ocupado} onClick={() => aplicar(abertas)}>
          {abertas.some(pedeSenha) ? <KeyRound className="h-4 w-4" /> : <Check className="h-4 w-4" />}Aplicar todas ({abertas.length}) de uma vez
        </button>)}
      {msg && <p className="text-sm font-semibold" role="status">{msg}</p>}
    </div>
  );
}

// grava áudio pelo navegador e devolve base64 + tipo
function useGravador() {
  const [gravando, setGravando] = useState(false);
  const rec = useRef<MediaRecorder | null>(null);
  const partes = useRef<Blob[]>([]);
  async function iniciar() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const tipo = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg'].find((t) => (window as any).MediaRecorder?.isTypeSupported?.(t)) || '';
    const r = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
    partes.current = [];
    r.ondataavailable = (e) => e.data.size && partes.current.push(e.data);
    r.start(); rec.current = r; setGravando(true);
  }
  function parar(): Promise<{ audio: string; mime: string } | null> {
    return new Promise((res) => {
      const r = rec.current; if (!r) return res(null);
      r.onstop = async () => {
        r.stream.getTracks().forEach((t) => t.stop()); setGravando(false);
        const blob = new Blob(partes.current, { type: r.mimeType || 'audio/webm' });
        if (!blob.size) return res(null);
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        res({ audio: btoa(bin), mime: blob.type });
      };
      r.stop();
    });
  }
  return { gravando, iniciar, parar };
}

// anexos: imagem, PDF ou texto, até 3 por mensagem e 7 MB no total (vão em base64 para a função)
type Arquivo = { nome: string; mime: string; base64: string; tam: number };
const ACEITOS = 'image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/csv';
const MAX_ARQ = 3, MAX_BYTES = 7 * 1024 * 1024;
function lerBase64(f: File): Promise<string> {
  return new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] || '');
    r.onerror = () => falha(r.error); r.readAsDataURL(f);
  });
}
function mimeDe(f: File) {
  if (f.type) return f.type.toLowerCase();
  const ext = f.name.split('.').pop()?.toLowerCase();
  return ext === 'pdf' ? 'application/pdf' : ext === 'csv' ? 'text/csv' : ext === 'txt' ? 'text/plain' : '';
}
function ListaAnexos({ itens, tirar }: { itens: { nome: string; mime: string }[]; tirar?: (i: number) => void }) {
  if (!itens?.length) return null;
  return (
    <div className="mb-1.5 flex flex-wrap gap-1.5">{itens.map((a, i) => (
      <span key={i} className="inline-flex max-w-[220px] items-center gap-1.5 rounded-lg bg-papel px-2 py-1 text-[12px] font-semibold text-noite-600 ring-1 ring-linha">
        {String(a.mime).startsWith('image/') ? <ImageIcon className="h-3.5 w-3.5 shrink-0" /> : <FileText className="h-3.5 w-3.5 shrink-0" />}
        <span className="truncate">{a.nome || 'arquivo'}</span>
        {tirar && <button className="rounded text-apagado hover:text-alerta" aria-label={`Tirar ${a.nome}`} onClick={() => tirar(i)}><X className="h-3.5 w-3.5" /></button>}
      </span>))}
    </div>);
}

export default function Assistente() {
  const qc = useQueryClient();
  const [janelaSenha, pedirSenha] = useSenha();
  const { data: msgs = [], isLoading, error } = useQuery({ queryKey: ['assistente-msgs'], queryFn: async () => {
    const { data, error: e } = await supabase.from('assistente_mensagens').select('*').order('id', { ascending: false }).limit(80);
    if (e) throw e;
    return ((data || []) as Msg[]).reverse();
  } });
  const { data: uso } = useQuery({ queryKey: ['assistente-uso'], queryFn: async () => (await supabase.rpc('assistente_pode_usar')).data as any });
  const { data: combinados = [] } = useQuery({ queryKey: ['assistente-comb'], queryFn: async () =>
    (await supabase.from('assistente_combinados').select('id,texto,criado_em').eq('ativo', true).order('id')).data || [] });
  const [texto, setTexto] = useState('');
  const [pendente, setPendente] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [pendenteAnexos, setPendenteAnexos] = useState<{ nome: string; mime: string }[]>([]);
  const seletor = useRef<HTMLInputElement>(null);
  const fim = useRef<HTMLDivElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const grav = useGravador();
  // desce até a última mensagem (de novo depois que os cartões das propostas carregam)
  useEffect(() => {
    const descer = () => { if (caixa.current) caixa.current.scrollTop = caixa.current.scrollHeight; };
    descer(); const t = setTimeout(descer, 600); return () => clearTimeout(t);
  }, [msgs.length, pendente]);

  async function juntar(lista: File[]) {
    setErro('');
    const novos: Arquivo[] = [];
    for (const f of lista) {
      const mime = mimeDe(f);
      if (!ACEITOS.split(',').includes(mime)) { setErro(`"${f.name}" não dá para abrir aqui. Mande imagem, PDF ou texto.`); continue; }
      novos.push({ nome: f.name || 'imagem colada', mime, base64: await lerBase64(f), tam: f.size });
    }
    setArquivos((atual) => {
      const tudo = [...atual, ...novos];
      if (tudo.length > MAX_ARQ) { setErro(`Até ${MAX_ARQ} arquivos por mensagem.`); return atual; }
      if (tudo.reduce((s, a) => s + a.tam, 0) > MAX_BYTES) { setErro('Os arquivos passam de 7 MB juntos. Mande menos ou menores.'); return atual; }
      return tudo;
    });
  }
  async function enviar() {
    const t = texto.trim(); if ((!t && !arquivos.length) || pendente) return;
    const ax = arquivos;
    setErro(''); setPendente(t || '(arquivo)'); setPendenteAnexos(ax.map(({ nome, mime }) => ({ nome, mime }))); setTexto(''); setArquivos([]);
    try { await assistente({ acao: 'enviar', texto: t, ...(ax.length ? { anexos: ax.map(({ nome, mime, base64 }) => ({ nome, mime, base64 })) } : {}) }); }
    catch (e) { setErro((e as Error).message); setTexto(t); setArquivos(ax); }
    finally {
      setPendente(null); setPendenteAnexos([]);
      for (const k of ['assistente-msgs', 'assistente-uso', 'assistente-comb', 'propostas']) qc.invalidateQueries({ queryKey: [k] });
    }
  }
  async function microfone() {
    setErro('');
    if (!grav.gravando) {
      try { await grav.iniciar(); } catch { setErro('Não consegui usar o microfone. Confira a permissão do navegador.'); }
      return;
    }
    const a = await grav.parar(); if (!a) return;
    setTranscrevendo(true);
    try { const r = await assistente({ acao: 'transcrever', ...a }); setTexto((x) => (x ? x + ' ' : '') + (r.texto || '')); }
    catch (e) { setErro((e as Error).message); }
    finally { setTranscrevendo(false); }
  }
  async function tirarCombinado(id: number) {
    await supabase.rpc('assistente_combinado_desativar', { p_id: id });
    qc.invalidateQueries({ queryKey: ['assistente-comb'] });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {janelaSenha}
      <Cabecalho titulo="Assistente" apoio="Converse com a Clara sobre o atendimento dela. Ela prepara as mudanças; você aprova." />
      <div className="grid min-h-0 flex-1 gap-4 px-4 md:px-0 lg:grid-cols-[1fr_280px]">
        <section className="cartao flex min-h-0 flex-col overflow-hidden">
          <div ref={caixa} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {isLoading && <div className="text-sm text-apagado">Carregando…</div>}
            {error && <Erro>Não consegui carregar a conversa. Atualize a página.</Erro>}
            {!isLoading && !msgs.length && !pendente && (
              <div className="mx-auto max-w-md py-8 text-center text-sm text-noite-600">
                <Sparkles className="mx-auto mb-2 h-6 w-6 text-sol" />
                Peça do seu jeito. Por exemplo: “Quantos leads chegaram essa semana?”, “Quando perguntarem se atendemos em Minas, responda que sim” ou “Por que a Clara respondeu assim para a Maria?”.
              </div>)}
            {msgs.map((m) => m.papel === 'sistema'
              ? <div key={m.id} className="text-center text-xs text-apagado">{m.texto} · {dataHora(m.em)}</div>
              : (
                <div key={m.id} className={`flex ${m.papel === 'talita' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[92%] md:max-w-[80%] ${m.papel === 'talita' ? '' : 'w-full md:w-auto'}`}>
                    <div className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[14.5px] leading-relaxed ${m.papel === 'talita' ? 'balao-eu' : 'bg-white/95 ring-1 ring-linha'}`}>
                      {m.papel === 'talita' && <ListaAnexos itens={m.meta?.anexos || []} />}{m.texto}</div>
                    <div className={`mt-0.5 text-[11px] text-apagado ${m.papel === 'talita' ? 'text-right' : ''}`}>{m.papel === 'assistente' ? 'Clara · ' : ''}{dataHora(m.em)}{m.canal === 'whatsapp' ? ' · WhatsApp' : ''}</div>
                    {m.papel === 'assistente' && !!m.meta?.propostas?.length && <Cartoes ids={m.meta.propostas} pedirSenha={pedirSenha} />}
                  </div>
                </div>))}
            {pendente && <>
              <div className="flex justify-end"><div className="balao-eu max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[14.5px]"><ListaAnexos itens={pendenteAnexos} />{pendente}</div></div>
              <div className="text-sm text-apagado" role="status">A Clara está pensando… pode levar até 1 minuto quando ela testa uma mudança.</div>
            </>}
            <div ref={fim} />
          </div>
          <div className="border-t border-linha bg-white/70 p-3">
            {erro && <div className="mb-2"><Erro>{erro}</Erro></div>}
            <ListaAnexos itens={arquivos} tirar={(i) => setArquivos((a) => a.filter((_, j) => j !== i))} />
            <input ref={seletor} type="file" multiple accept={ACEITOS} className="hidden" aria-hidden="true" tabIndex={-1}
              onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; if (f.length) juntar(f); }} />
            <div className="flex items-end gap-2">
              <button className="btn btn-sec h-11 w-11 !px-0" aria-label="Anexar imagem ou documento" title="Anexar imagem, PDF ou texto"
                onClick={() => seletor.current?.click()} disabled={!!pendente || arquivos.length >= MAX_ARQ}><Paperclip className="h-5 w-5" /></button>
              <textarea className="campo min-h-[44px] flex-1 resize-none" rows={Math.min(6, Math.max(1, texto.split('\n').length))} aria-label="Mensagem para a Clara"
                placeholder={grav.gravando ? 'Gravando… toque de novo para parar' : transcrevendo ? 'Transcrevendo o áudio…' : 'Escreva para a Clara'}
                value={texto} onChange={(e) => setTexto(e.target.value)} disabled={!!pendente}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                onPaste={(e) => { const f = Array.from(e.clipboardData.files || []); if (f.length) { e.preventDefault(); juntar(f); } }} />
              <button className={`btn h-11 w-11 !px-0 ${grav.gravando ? 'bg-alerta text-white' : 'btn-sec'}`} aria-label={grav.gravando ? 'Parar gravação' : 'Gravar áudio'}
                onClick={microfone} disabled={!!pendente || transcrevendo}>{grav.gravando ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}</button>
              <button className="btn-primario h-11 w-11 !px-0" aria-label="Enviar" onClick={enviar} disabled={(!texto.trim() && !arquivos.length) || !!pendente}><Send className="h-5 w-5" /></button>
            </div>
            <p className="mt-1.5 text-[11px] text-apagado">O áudio vira texto antes de enviar, para você conferir. Pode anexar imagem, PDF ou texto (até 3). Nada muda sem você aprovar no cartão.</p>
          </div>
        </section>
        <aside className="hidden h-max space-y-4 lg:block">
          <div className="cartao p-4 text-sm">
            <div className="mb-1 font-bold">Gasto do mês</div>
            {uso ? <>
              <div className="numero text-lg font-semibold">R$ {Number(uso.gasto_mes || 0).toFixed(2).replace('.', ',')} <span className="text-sm font-normal text-apagado">de R$ {uso.teto}</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-papel"><div className={`h-full ${uso.aviso_80 ? 'bg-alerta' : 'bg-petroleo'}`} style={{ width: `${Math.min(100, (Number(uso.gasto_mes) / Number(uso.teto || 1)) * 100)}%` }} /></div>
              <div className="mt-1.5 text-xs text-apagado">Pedidos hoje: {uso.pedidos_hoje} de {uso.limite_diario}</div>
            </> : <div className="text-apagado">…</div>}
          </div>
          <div className="cartao p-4 text-sm">
            <div className="mb-1 font-bold">Combinados</div>
            <p className="mb-2 text-xs text-apagado">O que você pediu para a Clara lembrar sobre o jeito de te ajudar.</p>
            {!combinados.length && <div className="text-xs text-apagado">Nenhum ainda.</div>}
            <ul className="space-y-1.5">{combinados.map((c: any) => (
              <li key={c.id} className="flex items-start gap-2 text-xs"><span className="flex-1">{c.texto}</span>
                <button className="rounded p-0.5 text-apagado hover:text-alerta" aria-label={`Esquecer: ${c.texto}`} onClick={() => tirarCombinado(c.id)}><Trash2 className="h-3.5 w-3.5" /></button></li>))}</ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
