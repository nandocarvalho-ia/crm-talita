import { useMemo, useState } from 'react';
import { ArrowLeft, Search, BotOff } from 'lucide-react';
import { useLeadsAoVivo } from './Funil';
import { relativo, tel } from '../lib/format';
import LeadPainel from '../components/LeadPainel';

export default function Conversas() {
  const { data: leads = [], isLoading } = useLeadsAoVivo();
  const [aberto, setAberto] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'todas' | 'nao_lidas' | 'equipe'>('todas');

  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase(); const d = b.replace(/\D/g, '');
    return leads
      .filter((l) => !b || (l.nome || '').toLowerCase().includes(b) || (d && l.telefone.includes(d)))
      .filter((l) => filtro === 'todas' || (filtro === 'nao_lidas' ? (l.nao_lidas || 0) > 0 : l.pausar_ia))
      .sort((a, b2) => (b2.ultima_mensagem_em || b2.atualizado_em).localeCompare(a.ultima_mensagem_em || a.atualizado_em));
  }, [leads, busca, filtro]);

  return (
    <div className="flex h-full min-h-0 gap-4 px-4 pb-1 md:px-0 md:pb-0">
      <aside className={`${aberto ? 'hidden md:flex' : 'flex'} w-full flex-col overflow-hidden rounded-[20px] bg-white/70 shadow-card ring-1 ring-white/90 backdrop-blur-md md:w-96`}>
        <div className="space-y-3 border-b border-linha p-4">
          <h1 className="titulo-tela">Conversas</h1>
          <div className="relative"><Search className="absolute left-3.5 top-3 h-4 w-4 text-apagado" />
            <input className="campo h-11 !rounded-2xl pl-10" placeholder="Buscar nome ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
          <div className="flex flex-wrap gap-1.5">
            {([['todas', 'Todas'], ['nao_lidas', 'Não lidas'], ['equipe', 'IA pausada']] as const).map(([k, t]) => (
              <button key={k} aria-pressed={filtro === k} className={filtro === k ? 'aba-on' : 'aba-off'} onClick={() => setFiltro(k)}>{t}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading && <div className="p-4 text-sm text-apagado">Carregando…</div>}
          {lista.map((l) => (
            <button key={l.telefone} onClick={() => setAberto(l.telefone)}
              className={`flex w-full items-start gap-3 border-b border-linha px-4 py-3 text-left transition hover:bg-white/80 ${aberto === l.telefone ? 'bg-petroleo-100' : ''}`}>
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sol-100 text-sm font-bold text-sol-700">{(l.nome || '#').slice(0, 1).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold">{l.nome || tel(l.telefone)}</span>
                  <span className="shrink-0 text-[11px] text-apagado">{relativo(l.ultima_mensagem_em)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-apagado">{l.ultima_direcao === 'saida' ? '↪ ' : ''}{l.ultima_previa || 'sem mensagens no espelho'}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {l.pausar_ia && <BotOff className="h-3.5 w-3.5 text-[#B25A12]" aria-label="IA pausada" />}
                    {!!l.nao_lidas && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-petroleo px-1.5 text-[11px] font-bold text-white">{l.nao_lidas}</span>}
                  </span>
                </div>
              </div>
            </button>
          ))}
          {!isLoading && !lista.length && <div className="p-6 text-center text-sm text-apagado">Nada por aqui.</div>}
        </div>
      </aside>
      <section className={`${aberto ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col overflow-hidden rounded-[20px] shadow-card ring-1 ring-white/90`}>
        {aberto ? (
          <>
            <button className="flex min-h-[44px] items-center gap-1 border-b border-linha bg-white px-3 py-2 text-sm font-semibold md:hidden" onClick={() => setAberto(null)}><ArrowLeft className="h-4 w-4" />Voltar</button>
            <div className="flex-1 min-h-0"><LeadPainel key={aberto} telefone={aberto} embutido /></div>
          </>
        ) : <div className="tela-chat grid flex-1 place-items-center text-sm text-apagado">Escolha uma conversa</div>}
      </section>
    </div>
  );
}
