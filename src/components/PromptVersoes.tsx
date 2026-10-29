import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, History, KeyRound, RotateCcw, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { confirmarSenha } from '../lib/funcoes';
import { dataHora } from '../lib/format';
import { Erro, Gaveta } from './ui';

/** Comparação linha a linha (LCS). Bom para textos de prompt (algumas centenas de linhas). */
export type LinhaDiff = { tipo: 'igual' | 'saiu' | 'entrou'; texto: string };
export function diffLinhas(antes: string, depois: string): LinhaDiff[] {
  const a = (antes || '').split('\n'); const b = (depois || '').split('\n');
  const n = a.length, m = b.length;
  const t: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const out: LinhaDiff[] = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ tipo: 'igual', texto: a[i] }); i++; j++; }
    else if (t[i + 1][j] >= t[i][j + 1]) out.push({ tipo: 'saiu', texto: a[i++] });
    else out.push({ tipo: 'entrou', texto: b[j++] });
  }
  while (i < n) out.push({ tipo: 'saiu', texto: a[i++] });
  while (j < m) out.push({ tipo: 'entrou', texto: b[j++] });
  return out;
}

/** Mostra só o que mudou, com 2 linhas de contexto em volta. */
export function Diferencas({ antes, depois, rotuloAntes = 'sai', rotuloDepois = 'entra' }: { antes: string; depois: string; rotuloAntes?: string; rotuloDepois?: string }) {
  const d = diffLinhas(antes, depois);
  if (!d.some((x) => x.tipo !== 'igual')) return <p className="text-xs text-apagado">Os dois textos são iguais.</p>;
  const mostrar = d.map((x, k) => x.tipo !== 'igual' || d.slice(Math.max(0, k - 2), k + 3).some((y) => y.tipo !== 'igual'));
  const linhas: ReactNode[] = [];
  d.forEach((x, k) => {
    if (!mostrar[k]) { if (mostrar[k - 1]) linhas.push(<div key={'p' + k} className="px-2 text-apagado">…</div>); return; }
    const cls = x.tipo === 'saiu' ? 'bg-alerta-100 text-alerta' : x.tipo === 'entrou' ? 'bg-menta-100 text-menta-700' : 'text-noite-600';
    const sinal = x.tipo === 'saiu' ? '−' : x.tipo === 'entrou' ? '+' : ' ';
    linhas.push(<div key={k} className={`whitespace-pre-wrap break-words px-2 ${cls}`}><span aria-hidden="true" className="mr-1 select-none">{sinal}</span>{x.texto || ' '}</div>);
  });
  return (
    <div>
      <div className="mb-1 flex gap-3 text-[11px] font-semibold"><span className="text-alerta">− {rotuloAntes}</span><span className="text-menta-700">+ {rotuloDepois}</span></div>
      <div className="max-h-80 overflow-auto rounded-xl bg-white/90 py-1 font-mono text-[12px] leading-relaxed ring-1 ring-linha">{linhas}</div>
    </div>
  );
}

/** Janela da senha: o admin digita a senha de login para liberar uma mudança na estrutura da Clara.
 *  useSenha() devolve [janela, pedir]; pedir() resolve com o id da aprovação (vale 5 min, uma vez) ou null se cancelar. */
export function useSenha(): [ReactNode, () => Promise<string | null>] {
  const [aberta, setAberta] = useState(false);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const resolver = useRef<((v: string | null) => void) | null>(null);
  function fechar(v: string | null) { resolver.current?.(v); resolver.current = null; setAberta(false); setSenha(''); setErro(''); }
  async function confirmar() {
    if (!senha) return;
    setOcupado(true); setErro('');
    try { const r = await confirmarSenha(senha); fechar(r.aprovacao as string); }
    catch (e) { setErro((e as Error).message); setSenha(''); }
    finally { setOcupado(false); }
  }
  const pedir = () => new Promise<string | null>((res) => { resolver.current = res; setAberta(true); });
  const janela = aberta ? createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-noite/40 p-4" onClick={() => fechar(null)}>
      <form role="dialog" aria-modal="true" aria-labelledby="senha-titulo" className="cartao w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); confirmar(); }}>
        <div className="mb-2 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-sol-700" />
          <h2 id="senha-titulo" className="font-bold">Confirme com a sua senha</h2>
          <button type="button" className="ml-auto rounded-full p-1 hover:bg-papel" aria-label="Cancelar" onClick={() => fechar(null)}><X className="h-4 w-4" /></button>
        </div>
        <p className="mb-3 text-sm text-noite-600">Esta mudança mexe na estrutura ou nas configurações da atendente (ferramentas, passagem para a Dra., regras, valores, horários). Para confirmar, digite a sua senha de login do CRM.</p>
        <label className="rotulo" htmlFor="senha-confirmar">Senha</label>
        <input id="senha-confirmar" className="campo" type="password" autoComplete="current-password" autoFocus value={senha} onChange={(e) => setSenha(e.target.value)} />
        {erro && <div className="mt-2"><Erro>{erro}</Erro></div>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-sec" onClick={() => fechar(null)}>Cancelar</button>
          <button type="submit" className="btn-primario" disabled={!senha || ocupado}>{ocupado ? 'Conferindo…' : 'Confirmar'}</button>
        </div>
      </form>
    </div>, document.body) : null;
  return [janela, pedir];
}

const ORIGEM: Record<string, string> = {
  crm: 'Editado no CRM', assistente: 'Assistente', volta: 'Voltou a uma versão', restaurar: 'Voltou à base',
  base_nova: 'Base nova aplicada', seed: 'Atualização do sistema', inicial: 'Início do histórico', sql: 'Ajuste direto no banco',
};
export const rotuloOrigem = (o?: string | null) => (o && ORIGEM[o]) || 'Alteração';

type Versao = { id: number; texto: string; origem: string; por: string; em: string; atual: boolean; igual_base: boolean };

/** Gaveta com as versões de uma parte do prompt. Voltar gera uma versão nova; nada se apaga. */
export function Versoes({ tipo, campo, titulo, atual, podeVoltar, onVoltar, onFechar }: {
  tipo: string; campo: string; titulo: string; atual: string; podeVoltar: boolean;
  onVoltar: (id: number) => Promise<void>; onFechar: () => void;
}) {
  const { data, isLoading, error } = useQuery({ queryKey: ['prompt-versoes', tipo, campo], queryFn: async () => {
    const { data: r, error: e } = await supabase.rpc('crm_prompt_versoes', { p_tipo: tipo, p_campo: campo });
    if (e || (r as any)?.status !== 'ok') throw e || new Error('versoes');
    return (r as any).versoes as Versao[];
  } });
  const [aberta, setAberta] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);
  return (
    <Gaveta onFechar={onFechar}>
      <div className="flex h-full flex-col bg-papel">
        <div className="flex items-center gap-2 border-b border-linha bg-white/90 px-4 py-3">
          <History className="h-5 w-5" />
          <div className="min-w-0"><h2 className="font-bold">Versões · {titulo}</h2><p className="text-xs text-apagado">Voltar para uma versão cria uma versão nova. Nenhuma versão é apagada.</p></div>
          <button className="ml-auto rounded-full p-1.5 hover:bg-papel" aria-label="Fechar" onClick={onFechar}><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 space-y-2 overflow-auto p-4">
          {isLoading && <div className="text-sm text-apagado">Carregando…</div>}
          {error && <Erro>Não consegui carregar as versões. Tente de novo.</Erro>}
          {data && !data.length && <div className="text-sm text-apagado">Nenhuma versão registrada ainda.</div>}
          {data?.map((v) => (
            <div key={v.id} className="cartao p-3">
              <button className="flex w-full items-start gap-2 text-left" aria-expanded={aberta === v.id} onClick={() => setAberta(aberta === v.id ? null : v.id)}>
                {aberta === v.id ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                    {rotuloOrigem(v.origem)}
                    {v.atual && <span className="chip bg-petroleo-100 text-petroleo">em uso</span>}
                    {v.igual_base && <span className="chip bg-papel text-apagado">igual à base</span>}
                  </div>
                  <div className="text-xs text-apagado">{dataHora(v.em)} · {v.por}</div>
                </div>
              </button>
              {aberta === v.id && (
                <div className="mt-3 space-y-2">
                  {v.atual ? <p className="text-xs text-apagado">Esta é a versão em uso agora.</p>
                    : <Diferencas antes={atual} depois={v.texto} rotuloAntes="em uso agora" rotuloDepois="nesta versão" />}
                  {podeVoltar && !v.atual && (
                    <button className="btn-sec" disabled={ocupado !== null} onClick={async () => { setOcupado(v.id); try { await onVoltar(v.id); } finally { setOcupado(null); } }}>
                      <RotateCcw className="h-4 w-4" />{ocupado === v.id ? 'Voltando…' : 'Voltar para esta versão'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Gaveta>
  );
}
