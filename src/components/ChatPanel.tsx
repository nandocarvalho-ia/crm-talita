import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCheck, Clock, AlertTriangle, StickyNote, Send, RotateCcw, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Mensagem } from '../lib/tipos';
import { rotuloDia } from '../lib/format';

const AUTOR: Record<string, string> = { agente: 'Agente (IA)', painel: 'Pelo painel', celular: 'Pelo celular', sistema: 'Sistema', contato: '' };

function useMensagens(telefone: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['mensagens', telefone],
    queryFn: async () => {
      const { data, error } = await supabase.from('chat_mensagens')
        .select('id,telefone,direcao,autor,autor_user_id,tipo,corpo,midia_path,midia_mime,midia_estado,status,ocorreu_em,erro,origem')
        .eq('telefone', telefone).order('ocorreu_em', { ascending: false }).limit(500);
      if (error) throw error;
      return ((data || []) as Mensagem[]).reverse();
    },
  });
  useEffect(() => {
    const ch = supabase.channel(`chat:conv:${telefone}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_mensagens', filter: `telefone=eq.${telefone}` },
        () => { qc.invalidateQueries({ queryKey: ['mensagens', telefone] }); supabase.rpc('chat_marcar_lida', { p_telefone: telefone }); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [telefone, qc]);
  return q;
}

// URLs assinadas em lote; renova as que passaram de 50 min.
function useMidias(msgs: Mensagem[]) {
  const [urls, setUrls] = useState<Record<string, { url: string; em: number }>>({});
  useEffect(() => {
    const precisa = msgs.filter((m) => m.midia_estado === 'pronta' && m.midia_path)
      .map((m) => m.midia_path as string)
      .filter((p) => !urls[p] || Date.now() - urls[p].em > 50 * 60 * 1000);
    if (!precisa.length) return;
    supabase.storage.from('chat-midia').createSignedUrls(precisa, 3600).then(({ data }) => {
      if (!data) return;
      setUrls((u) => { const n = { ...u }; data.forEach((d) => { if (d.signedUrl && d.path) n[d.path] = { url: d.signedUrl, em: Date.now() }; }); return n; });
    });
  }, [msgs]); // eslint-disable-line react-hooks/exhaustive-deps
  return urls;
}

function StatusIcone({ m }: { m: Mensagem }) {
  if (m.direcao !== 'saida' || m.status === 'importada') return null;
  if (m.status === 'na_fila' || m.status === 'enviando') return <Clock className="h-3.5 w-3.5 opacity-60" />;
  if (m.status === 'enviada') return <Check className="h-3.5 w-3.5 opacity-70" />;
  if (m.status === 'entregue') return <CheckCheck className="h-3.5 w-3.5 opacity-70" />;
  if (m.status === 'lida') return <CheckCheck className="h-3.5 w-3.5 lido" />;
  if (m.status === 'falhou') return <AlertTriangle className="h-3.5 w-3.5 text-red-600" />;
  return null;
}

function Midia({ m, url }: { m: Mensagem; url?: string }) {
  if (!m.midia_estado) return null;
  if (m.midia_estado === 'pendente') return <div className="text-xs italic opacity-70">Buscando o arquivo…</div>;
  if (m.midia_estado === 'falhou' || !url) return <div className="text-xs italic opacity-70">Arquivo indisponível</div>;
  if (m.tipo === 'audio') return <audio controls src={url} className="max-w-[260px]" />;
  if (m.tipo === 'imagem' || m.tipo === 'figurinha') return <a href={url} target="_blank" rel="noreferrer"><img src={url} className="max-h-72 rounded-lg" /></a>;
  if (m.tipo === 'video') return <video controls src={url} className="max-h-72 rounded-lg" />;
  return <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm underline"><FileText className="h-4 w-4" />Abrir arquivo</a>;
}

export default function ChatPanel({ telefone }: { telefone: string }) {
  const { data: msgs = [], isLoading } = useMensagens(telefone);
  const urls = useMidias(msgs);
  const [modo, setModo] = useState<'responder' | 'nota'>('responder');
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const fim = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  useEffect(() => { supabase.rpc('chat_marcar_lida', { p_telefone: telefone }).then(() => qc.invalidateQueries({ queryKey: ['leads'] })); }, [telefone, qc]);
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }); }, [msgs.length]);

  const grupos = useMemo(() => {
    const out: { dia: string; itens: Mensagem[] }[] = [];
    for (const m of msgs) {
      const dia = rotuloDia(m.ocorreu_em);
      if (!out.length || out[out.length - 1].dia !== dia) out.push({ dia, itens: [] });
      out[out.length - 1].itens.push(m);
    }
    return out;
  }, [msgs]);

  async function enviar() {
    const t = texto.trim(); if (!t) return;
    setEnviando(true); setErro('');
    const { data, error } = await supabase.rpc(modo === 'responder' ? 'chat_responder' : 'chat_nota', { p_telefone: telefone, p_texto: t });
    setEnviando(false);
    if (error || (data && (data as any).status !== 'ok')) { setErro(error?.message || `Não foi: ${(data as any)?.status}`); return; }
    setTexto(''); qc.invalidateQueries({ queryKey: ['mensagens', telefone] }); qc.invalidateQueries({ queryKey: ['leads'] });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="tela-chat flex-1 min-h-0 overflow-y-auto px-3 py-4 sm:px-6">
        {isLoading && <div className="text-center text-sm text-apagado">Carregando conversa…</div>}
        {!isLoading && !msgs.length && <div className="mx-auto mt-10 max-w-xs rounded-xl bg-white/80 p-4 text-center text-sm text-apagado">Nenhuma mensagem registrada ainda. As mensagens aparecem aqui a partir do momento em que o espelho do WhatsApp foi ligado.</div>}
        {grupos.map((g) => (
          <div key={g.dia}>
            <div className="my-3 flex justify-center"><span className="rounded-lg bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-apagado shadow-sm">{g.dia}</span></div>
            {g.itens.map((m, i) => {
              const ant = g.itens[i - 1];
              const mostraAutor = m.direcao === 'saida' && (!ant || ant.autor !== m.autor || ant.direcao !== m.direcao);
              if (m.direcao === 'nota') return (
                <div key={m.id} className="my-2 flex justify-center">
                  <div className="max-w-[85%] rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <div className="mb-0.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide"><StickyNote className="h-3.5 w-3.5" />Nota interna</div>
                    <div className="whitespace-pre-wrap">{m.corpo}</div>
                  </div>
                </div>
              );
              const eu = m.direcao === 'saida';
              return (
                <div key={m.id} className={`my-1 flex ${eu ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm ${eu ? 'balao-eu rounded-br-md' : 'balao-contato rounded-bl-md'}`}>
                    {mostraAutor && AUTOR[m.autor] && <div className="mb-0.5 text-[11px] font-bold opacity-70">{AUTOR[m.autor]}</div>}
                    <Midia m={m} url={m.midia_path ? urls[m.midia_path]?.url : undefined} />
                    {m.corpo && <div className="whitespace-pre-wrap break-words text-[14px] leading-snug">{m.corpo}</div>}
                    <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] opacity-70">
                      {new Date(m.ocorreu_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}<StatusIcone m={m} />
                    </div>
                    {m.status === 'falhou' && (
                      <div className="mt-1 rounded-lg bg-alerta-100 px-2 py-1 text-[11px] text-alerta">
                        Não saiu{m.erro ? `: ${m.erro}` : ''}
                        {m.origem === 'painel' && <button className="ml-2 inline-flex items-center gap-1 font-bold underline" onClick={async () => { await supabase.rpc('chat_reenviar', { p_id: m.id }); qc.invalidateQueries({ queryKey: ['mensagens', telefone] }); }}><RotateCcw className="h-3 w-3" />Reenviar</button>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={fim} />
      </div>
      <div className="border-t border-linha bg-white p-3">
        <div className="mb-2 flex gap-1.5">
          <button aria-pressed={modo === 'responder'} className={modo === 'responder' ? 'aba-on !h-8' : 'aba-off !h-8 !bg-papel'} onClick={() => setModo('responder')}>Responder</button>
          <button aria-pressed={modo === 'nota'} className={modo === 'nota' ? 'aba !h-8 bg-amber-500 text-white' : 'aba-off !h-8 !bg-papel'} onClick={() => setModo('nota')}>Nota interna</button>
        </div>
        <div className="flex items-end gap-2">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            placeholder={modo === 'responder' ? 'Escreva para o cliente…' : 'Anotação que só a equipe vê…'}
            className={`campo resize-none ${modo === 'nota' ? 'border-amber-300 bg-amber-50' : ''}`} />
          <button className={modo === 'nota' ? 'btn bg-amber-500 text-white hover:bg-amber-600' : 'btn-primario'} disabled={enviando || !texto.trim()} onClick={enviar}>
            {modo === 'nota' ? <StickyNote className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-apagado">
          {modo === 'responder' ? 'Sai pelo WhatsApp em até 15 s e pausa a IA neste contato.' : 'Fica só no CRM. O cliente não recebe.'}
          {erro && <span className="ml-2 font-semibold text-alerta">{erro}</span>}
        </p>
      </div>
    </div>
  );
}
