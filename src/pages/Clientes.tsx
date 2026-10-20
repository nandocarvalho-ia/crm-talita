import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UserPlus, Upload, Loader2, ShieldCheck, ShieldOff, Pencil, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { dataHora, tel, textoDeArquivo } from '../lib/format';
import { Cabecalho, Erro, Gaveta, textoStatus } from '../components/ui';

type Cliente = { telefone: string; nome: string | null; observacao: string | null; ativo: boolean; criado_em: string; atualizado_em: string };
type Linha = { telefone: string; nome: string; observacao: string };

/** Telefone com DDI 55 → +55 (16) 99999-0000; senão, os dígitos. */
const telBonito = (t: string) => (t.startsWith('55') ? `+55 ${tel(t)}` : t);

/** Lê o texto colado ou o CSV: uma pessoa por linha, "telefone;nome;observação" (aceita ; , ou tab). */
function lerLista(txt: string): Linha[] {
  const linhas = txt.replace(/^﻿/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const sep = (l: string) => (l.includes(';') ? ';' : l.includes('\t') ? '\t' : ',');
  const saida: Linha[] = [];
  linhas.forEach((l, i) => {
    const partes = l.split(sep(l)).map((p) => p.trim().replace(/^"(.*)"$/, '$1').trim());
    // descobre a coluna do telefone (a primeira com 8+ dígitos); o resto vira nome e observação
    let k = partes.findIndex((p) => p.replace(/\D/g, '').length >= 8 && /^[\d\s()+\-.]+$/.test(p));
    if (k < 0) { if (i === 0) return; k = 0; }   // primeira linha sem telefone = cabeçalho
    const resto = partes.filter((_, j) => j !== k);
    saida.push({ telefone: partes[k].replace(/\D/g, ''), nome: resto[0] || '', observacao: resto.slice(1).join(' ').trim() });
  });
  return saida;
}

function Editor({ cliente, onFechar }: { cliente: Cliente | null; onFechar: () => void }) {
  const qc = useQueryClient();
  const [telefone, setTelefone] = useState(cliente?.telefone || '');
  const [nome, setNome] = useState(cliente?.nome || '');
  const [ativo, setAtivo] = useState(cliente?.ativo ?? true);
  const [erro, setErro] = useState(''); const [salvando, setSalvando] = useState(false);
  const digitos = telefone.replace(/\D/g, '');
  async function salvar() {
    setErro(''); setSalvando(true);
    const { data: r, error } = await supabase.rpc('crm_cliente_salvar', { p_telefone: digitos, p_nome: nome, p_ativo: ativo });
    setSalvando(false);
    if (error || (r as any)?.status !== 'ok') {
      setErro(error ? 'Não salvou. Confira a conexão e tente de novo.' : (r as any)?.status === 'valor_invalido' ? 'Telefone inválido. Use DDD + número (ex.: 16 99999-0000), com ou sem o 55.' : textoStatus((r as any)?.status));
      return;
    }
    qc.invalidateQueries({ queryKey: ['clientes'] }); qc.invalidateQueries({ queryKey: ['leads'] });
    onFechar();
  }
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-linha px-5 py-4">
        <h2 className="font-display text-xl font-semibold">{cliente ? 'Editar cliente' : 'Novo cliente'}</h2>
        <button className="btn-sec !px-2" onClick={onFechar} aria-label="Fechar"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto bg-papel/60 p-4">
        <div className="space-y-3 rounded-[18px] bg-white p-4 shadow-card">
          <div><label className="rotulo" htmlFor="cl-tel">Telefone (WhatsApp)</label>
            <input id="cl-tel" className="campo" inputMode="tel" readOnly={!!cliente} placeholder="(16) 99999-0000" value={cliente ? telBonito(telefone) : telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
          <div><label className="rotulo" htmlFor="cl-nome">Nome</label>
            <input id="cl-nome" className="campo" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />Cliente atual (a IA não responde este número)</label>
          <div className="text-[12px] text-apagado">Marcar como cliente pausa a IA na conversa desse número. Quando ele escrever, a Dra. recebe um aviso (no máximo 1 a cada 6 h). Desmarcar não religa a IA: para isso, use "Devolver para a IA" na ficha do lead.</div>
        </div>
        {erro && <Erro>{erro}</Erro>}
        <div className="flex gap-2">
          <button className="btn-primario" disabled={salvando || digitos.length < 10} onClick={salvar}>{salvando && <Loader2 className="h-4 w-4 animate-spin" />}Salvar</button>
          <button className="btn-sec" onClick={onFechar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function Importar({ onFechar }: { onFechar: () => void }) {
  const qc = useQueryClient();
  const [txt, setTxt] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [res, setRes] = useState<{ importados: number; invalidos: number } | null>(null);
  const [erro, setErro] = useState('');
  const linhas = useMemo(() => lerLista(txt), [txt]);
  const suspeitas = linhas.filter((l) => l.telefone.length < 10 || l.telefone.length > 15).length;

  async function arquivo(f: File | null) {
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { setErro('Arquivo grande demais (até 2 MB).'); return; }
    setErro(''); setRes(null); setTxt(textoDeArquivo(await f.arrayBuffer()));   // Excel em português salva CSV em Windows-1252
  }
  async function importar() {
    setErro(''); setEnviando(true);
    let importados = 0, invalidos = 0;
    // em lotes de 500 para não estourar o tamanho do pedido
    for (let i = 0; i < linhas.length; i += 500) {
      const lote = linhas.slice(i, i + 500).map((l) => ({ telefone: l.telefone, nome: l.nome, observacao: l.observacao }));
      const { data: r, error } = await supabase.rpc('crm_clientes_importar', { p: lote });
      if (error || (r as any)?.status !== 'ok') {
        setEnviando(false);
        setErro(`${error ? 'A conexão falhou' : textoStatus((r as any)?.status)}${importados ? ` Já tinham entrado ${importados} antes da falha; pode importar de novo, quem já está não duplica.` : ''}`);
        qc.invalidateQueries({ queryKey: ['clientes'] });
        return;
      }
      importados += Number((r as any).importados || 0); invalidos += Number((r as any).invalidos || 0);
    }
    setEnviando(false); setRes({ importados, invalidos });
    qc.invalidateQueries({ queryKey: ['clientes'] });
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-linha px-5 py-4">
        <h2 className="font-display text-xl font-semibold">Importar lista de clientes</h2>
        <button className="btn-sec !px-2" onClick={onFechar} aria-label="Fechar"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto bg-papel/60 p-4">
        <div className="space-y-3 rounded-[18px] bg-white p-4 shadow-card">
          <p className="text-[13px] text-noite-700">Cole uma pessoa por linha, no formato <b>telefone;nome</b> (pode ter uma terceira coluna de observação), ou escolha o CSV exportado do Excel. Quem já está na lista não duplica; ninguém é apagado.</p>
          <textarea className="campo font-mono text-[12.5px]" rows={8} aria-label="Lista de clientes" placeholder={'16999990000;Maria Souza\n5516988887777;João Lima'}
            value={txt} onChange={(e) => { setTxt(e.target.value); setRes(null); }} />
          <label className="btn-sec cursor-pointer"><Upload className="h-4 w-4" />Escolher CSV
            <input type="file" className="sr-only" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => arquivo(e.target.files?.[0] || null)} /></label>
        </div>

        {linhas.length > 0 && !res && (
          <div className="space-y-2 rounded-[18px] bg-white p-4 shadow-card">
            <div className="text-sm font-bold">Prévia: {linhas.length.toLocaleString('pt-BR')} {linhas.length === 1 ? 'linha' : 'linhas'}
              {suspeitas > 0 && <span className="ml-2 chip bg-sol-100 text-sol-700">{suspeitas} com telefone estranho</span>}</div>
            <div className="max-h-56 overflow-y-auto rounded-xl ring-1 ring-linha">
              {linhas.slice(0, 50).map((l, i) => (
                <div key={i} className="flex gap-3 border-b border-linha px-3 py-1.5 text-[13px] last:border-0">
                  <span className={`numero w-32 shrink-0 font-mono ${l.telefone.length < 10 || l.telefone.length > 15 ? 'text-alerta' : ''}`}>{l.telefone || '(sem telefone)'}</span>
                  <span className="min-w-0 flex-1 truncate">{l.nome || '—'}</span>
                </div>
              ))}
              {linhas.length > 50 && <div className="px-3 py-1.5 text-[12px] text-apagado">e mais {(linhas.length - 50).toLocaleString('pt-BR')}…</div>}
            </div>
            <div className="text-[12px] text-apagado">O banco confere cada número: quem vier sem o 55 ganha o 55; os inválidos são contados e ficam de fora.</div>
          </div>
        )}

        {res && (
          <div role="status" className="rounded-[18px] bg-menta-100 p-4 text-sm text-menta-700">
            <b>{res.importados.toLocaleString('pt-BR')} {res.importados === 1 ? 'cliente entrou' : 'clientes entraram'}</b> na lista
            {res.invalidos > 0 ? `; ${res.invalidos.toLocaleString('pt-BR')} ${res.invalidos === 1 ? 'telefone inválido ficou' : 'telefones inválidos ficaram'} de fora.` : '.'}
          </div>
        )}
        {erro && <Erro>{erro}</Erro>}
        <div className="flex gap-2">
          {!res && <button className="btn-primario" disabled={!linhas.length || enviando} onClick={importar}>{enviando && <Loader2 className="h-4 w-4 animate-spin" />}Importar {linhas.length ? linhas.length.toLocaleString('pt-BR') : ''}</button>}
          <button className="btn-sec" onClick={onFechar}>{res ? 'Fechar' : 'Cancelar'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Clientes() {
  const qc = useQueryClient();
  const { data = [], isLoading, error } = useQuery<Cliente[]>({ queryKey: ['clientes'], queryFn: async () => {
    const todos: Cliente[] = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await supabase.from('clientes_ativos').select('*').order('nome', { nullsFirst: false }).range(de, de + 999);
      if (error) throw error;
      todos.push(...((data || []) as Cliente[]));
      if (!data || data.length < 1000) break;
    }
    return todos;
  } });
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'ativos' | 'inativos' | 'todos'>('ativos');
  const [gaveta, setGaveta] = useState<{ tipo: 'editar'; c: Cliente | null } | { tipo: 'importar' } | null>(null);
  const [ocupado, setOcupado] = useState('');
  const [msg, setMsg] = useState('');

  const ativos = data.filter((c) => c.ativo).length;
  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase(); const d = b.replace(/\D/g, '');
    return data.filter((c) => (filtro === 'todos' || (filtro === 'ativos') === c.ativo))
      .filter((c) => !b || (c.nome || '').toLowerCase().includes(b) || (d.length >= 3 && c.telefone.includes(d)));
  }, [data, busca, filtro]);

  async function alternar(c: Cliente) {
    setOcupado(c.telefone); setMsg('');
    const { data: r, error: e } = await supabase.rpc('crm_cliente_salvar', { p_telefone: c.telefone, p_nome: c.nome || '', p_ativo: !c.ativo });
    setOcupado('');
    if (e || (r as any)?.status !== 'ok') setMsg(e ? 'Não salvou. Confira a conexão.' : textoStatus((r as any)?.status));
    qc.invalidateQueries({ queryKey: ['clientes'] }); qc.invalidateQueries({ queryKey: ['leads'] });
  }

  return (
    <div className="h-full overflow-y-auto md:pr-1">
      <Cabecalho titulo="Clientes atuais" apoio="Quem já tem processo com a Dra. Talita. A IA não responde esses números e avisa a Dra. quando eles escrevem.">
        <div className="flex flex-wrap gap-2">
          <button className="btn-sec" onClick={() => setGaveta({ tipo: 'importar' })}><Upload className="h-4 w-4" />Importar lista</button>
          <button className="btn-primario" onClick={() => setGaveta({ tipo: 'editar', c: null })}><UserPlus className="h-4 w-4" />Adicionar</button>
        </div>
      </Cabecalho>
      <div className="max-w-4xl space-y-3 px-4 pb-4 md:px-0">
        <div className="flex flex-wrap items-center gap-2">
          {([['ativos', `Clientes · ${ativos.toLocaleString('pt-BR')}`], ['inativos', `Desmarcados · ${(data.length - ativos).toLocaleString('pt-BR')}`], ['todos', 'Todos']] as const).map(([k, t]) => (
            <button key={k} aria-pressed={filtro === k} className={filtro === k ? 'aba-on' : 'aba-off'} onClick={() => setFiltro(k)}>{t}</button>
          ))}
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-apagado" />
            <input className="campo h-11 !rounded-2xl !border-white/90 !bg-white/80 pl-10" aria-label="Buscar cliente" placeholder="Buscar nome ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </div>
        {msg && <Erro>{msg}</Erro>}
        {error && <Erro>Não consegui carregar a lista de clientes. Atualize a página.</Erro>}
        {isLoading && <div className="cartao p-5 text-sm text-apagado">Carregando…</div>}
        {!isLoading && !error && !data.length && (
          <div className="cartao p-6 text-center text-sm text-apagado">
            Nenhum cliente cadastrado ainda. Sem a lista, a IA atende cliente como se fosse lead novo.
            <div className="mt-3"><button className="btn-primario" onClick={() => setGaveta({ tipo: 'importar' })}><Upload className="h-4 w-4" />Importar a lista do Excel</button></div>
          </div>
        )}
        {!!data.length && !lista.length && <div className="cartao p-5 text-center text-sm text-apagado">Ninguém encontrado com esse filtro.</div>}
        {!!lista.length && (
          <div className="cartao divide-y divide-linha">
            {lista.slice(0, 300).map((c) => (
              <div key={c.telefone} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{c.nome || 'Sem nome'}</div>
                  <div className="text-xs text-apagado"><span className="numero">{telBonito(c.telefone)}</span>{c.observacao ? ` · ${c.observacao}` : ''} · desde {dataHora(c.criado_em)}</div>
                </div>
                <div className="flex items-center gap-2">
                {c.ativo ? <span className="chip bg-menta-100 text-menta-700">cliente</span> : <span className="chip bg-papel text-apagado">desmarcado</span>}
                <span className="flex-1 sm:hidden" />
                <button className="btn-sec !px-2.5 !py-1.5" aria-label={`Editar ${c.nome || c.telefone}`} onClick={() => setGaveta({ tipo: 'editar', c })}><Pencil className="h-4 w-4" /></button>
                <button className={c.ativo ? 'btn-sec !py-1.5' : 'btn-primario !py-1.5'} disabled={ocupado === c.telefone} onClick={() => alternar(c)}>
                  {ocupado === c.telefone ? <Loader2 className="h-4 w-4 animate-spin" /> : c.ativo ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                  {c.ativo ? 'Desmarcar' : 'Marcar cliente'}
                </button>
                </div>
              </div>
            ))}
            {lista.length > 300 && <div className="px-4 py-3 text-xs text-apagado">Mostrando 300 de {lista.length.toLocaleString('pt-BR')}. Use a busca para achar os outros.</div>}
          </div>
        )}
      </div>
      {gaveta?.tipo === 'editar' && <Gaveta onFechar={() => setGaveta(null)}><Editor cliente={gaveta.c} onFechar={() => setGaveta(null)} /></Gaveta>}
      {gaveta?.tipo === 'importar' && <Gaveta onFechar={() => setGaveta(null)}><Importar onFechar={() => setGaveta(null)} /></Gaveta>}
    </div>
  );
}
