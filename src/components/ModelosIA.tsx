import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Brain, CheckCircle2, Loader2, TriangleAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { dataHora } from '../lib/format';
import { CONFIG_ROTULOS, ESFORCOS } from '../lib/config';
import { textoStatus } from './ui';

type Modelo = { id: string; rotulo: string; descricao: string | null; raciocinio: boolean; aceita_imagem: boolean;
  preco_entrada: number | null; preco_saida: number | null; ativo: boolean; ordem: number };

/** As 4 funções do agente (fn_modelos_ia), com modelo_<funcao> e esforco_<funcao> na config, e o assistente do CRM (assistente_modelo/assistente_esforco). */
const FUNCOES: { funcao: string; titulo: string; ajuda: string; imagem?: boolean; km?: string; ke?: string }[] = [
  { funcao: 'agente', titulo: 'Conversa com o lead', ajuda: 'Responde no WhatsApp como a Dra. Talita (ou como a equipe, no plantão).' },
  { funcao: 'classificador', titulo: 'Classificador', ajuda: 'Lê cada turno e grava os dados do caso (tipo, valor pago, parcelas, entrega…).' },
  { funcao: 'leitura_documento', titulo: 'Leitura de documento', ajuda: 'Lê a foto ou o PDF do contrato, relatório ou comprovante. Só classifica e extrai; nunca analisa.', imagem: true },
  { funcao: 'followup', titulo: 'Follow-up', ajuda: 'Escreve a mensagem de retomada a partir da conversa. Se falhar, vai o texto de reserva.' },
  { funcao: 'assistente', titulo: 'Assistente do CRM', ajuda: 'Conversa com a administração (aba Assistente e WhatsApp), prepara mudanças e lê fotos e documentos. Padrão: GPT-6.1 Sol com raciocínio alto. O custo entra no gasto do mês do assistente.', imagem: true, km: 'assistente_modelo', ke: 'assistente_esforco' },
];
const chaves = (f: { funcao: string; km?: string; ke?: string }) => [f.km || 'modelo_' + f.funcao, f.ke || 'esforco_' + f.funcao];

const preco = (m: Modelo) => (m.preco_entrada == null ? '' : ` · US$ ${Number(m.preco_entrada).toFixed(2)} / ${Number(m.preco_saida ?? 0).toFixed(2)} por 1 milhão de tokens`);

export default function ModelosIA() {
  const qc = useQueryClient();
  const { data: modelos = [], error } = useQuery<Modelo[]>({ queryKey: ['modelos-ia'],
    queryFn: async () => { const { data, error } = await supabase.from('modelos_ia').select('*').eq('ativo', true).order('ordem'); if (error) throw error; return (data || []) as Modelo[]; } });
  const { data: linhasCfg } = useQuery({ queryKey: ['config'],
    queryFn: async () => ((await supabase.from('config').select('*').order('chave')).data || []) as any[] });
  const cfg: Record<string, string> = Object.fromEntries((linhasCfg || []).map((c: any) => [c.chave, c.valor ?? '']));
  const { data: hist = [] } = useQuery({ queryKey: ['config-historico'],
    queryFn: async () => (await supabase.from('config_historico').select('*').order('id', { ascending: false }).limit(30)).data || [] });

  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [estado, setEstado] = useState<Record<string, { tipo: 'salvando' | 'ok' | 'erro'; msg: string }>>({});

  async function salvar(funcao: string) {
    const f = FUNCOES.find((x) => x.funcao === funcao)!;
    const pares = chaves(f).filter((k) => escolha[k] !== undefined && escolha[k] !== cfg[k]);
    setEstado((s) => ({ ...s, [funcao]: { tipo: 'salvando', msg: 'Salvando…' } }));
    for (const k of pares) {
      const { data: r, error: e } = await supabase.rpc('crm_config_salvar', { p_chave: k, p_valor: escolha[k] });
      if (e || (r as any)?.status !== 'ok') {
        setEstado((s) => ({ ...s, [funcao]: { tipo: 'erro', msg: e ? 'Não salvou. Confira a conexão.' : textoStatus((r as any)?.status) } }));
        qc.invalidateQueries({ queryKey: ['config'] });
        return;
      }
    }
    setEstado((s) => ({ ...s, [funcao]: { tipo: 'ok', msg: 'Salvo. Vale a partir da próxima mensagem.' } }));
    setEscolha((x) => { const n = { ...x }; pares.forEach((k) => delete n[k]); return n; });
    qc.invalidateQueries({ queryKey: ['config'] }); qc.invalidateQueries({ queryKey: ['config-historico'] });
  }

  const rotulo = (id?: string | null) => modelos.find((m) => m.id === id)?.rotulo || ESFORCOS.find(([k]) => k === id)?.[1] || id || '—';
  const trocas = (hist as any[]).filter((h) => /^(modelo|esforco)_|^assistente_(modelo|esforco)$/.test(h.chave)).slice(0, 6);

  return (
    <div className="cartao max-w-3xl space-y-5 p-5">
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5 text-petroleo" />
        <h2 className="text-[15px] font-bold">Modelos de IA</h2>
      </div>
      <p className="-mt-3 text-[13px] text-noite-600">
        Cada função do agente usa um modelo de raciocínio (sem temperatura) e um nível de raciocínio. Mais raciocínio deixa a resposta mais cuidadosa, porém mais lenta e mais cara.
        Depois de trocar, converse com o agente por um número de teste antes de deixar valendo.
      </p>
      {error && <div className="text-sm text-alerta">Não consegui carregar a lista de modelos. Atualize a página.</div>}

      {FUNCOES.map((f) => {
        const [km, ke] = chaves(f);
        const selM = escolha[km] ?? cfg[km] ?? '';
        const selE = escolha[ke] ?? cfg[ke] ?? '';
        const opcoes = modelos.filter((m) => !f.imagem || m.aceita_imagem);
        const mudou = (escolha[km] !== undefined && escolha[km] !== cfg[km]) || (escolha[ke] !== undefined && escolha[ke] !== cfg[ke]);
        const mSel = modelos.find((m) => m.id === selM);
        const est = estado[f.funcao];
        return (
          <div key={f.funcao} className="border-t border-linha pt-4 first-of-type:border-0">
            <div className="text-sm font-bold">{f.titulo}</div>
            <div className="mb-2 text-[12px] text-apagado">{f.ajuda}</div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[200px] flex-1">
                <label className="rotulo" htmlFor={km}>Modelo</label>
                <select id={km} className="campo" value={selM}
                  onChange={(e) => { setEscolha({ ...escolha, [km]: e.target.value }); setEstado((s) => { const n = { ...s }; delete n[f.funcao]; return n; }); }}>
                  {!opcoes.some((m) => m.id === selM) && <option value={selM}>{selM || '—'}</option>}
                  {opcoes.map((m) => <option key={m.id} value={m.id}>{m.rotulo}</option>)}
                </select>
              </div>
              <div className="w-40">
                <label className="rotulo" htmlFor={ke}>Raciocínio</label>
                <select id={ke} className="campo" value={selE}
                  onChange={(e) => { setEscolha({ ...escolha, [ke]: e.target.value }); setEstado((s) => { const n = { ...s }; delete n[f.funcao]; return n; }); }}>
                  {!ESFORCOS.some(([k]) => k === selE) && <option value={selE}>{selE || '—'}</option>}
                  {ESFORCOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                </select>
              </div>
              {mudou && (
                <button className="btn-primario" disabled={est?.tipo === 'salvando'} onClick={() => salvar(f.funcao)}>
                  {est?.tipo === 'salvando' && <Loader2 className="h-4 w-4 animate-spin" />}Salvar
                </button>
              )}
            </div>
            {mSel && <div className="mt-1.5 text-[12px] text-noite-600">{mSel.descricao}{preco(mSel)}</div>}
            {mudou && f.funcao === 'agente' && (
              <div className="mt-2 flex gap-2 rounded-xl bg-sol-100 px-3 py-2 text-[12px] text-sol-700"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />O tom do agente foi afinado no GPT-6 Luna com raciocínio baixo. Teste pelo número de teste antes de deixar valendo para os leads.</div>
            )}
            {est && (
              <div role="status" className={`mt-2 flex items-center gap-2 text-[13px] ${est.tipo === 'erro' ? 'text-alerta' : est.tipo === 'ok' ? 'text-menta-700' : 'text-apagado'}`}>
                {est.tipo === 'ok' && <CheckCircle2 className="h-4 w-4" />}{est.msg}
              </div>
            )}
          </div>
        );
      })}

      {trocas.length > 0 && (
        <div className="border-t border-linha pt-4">
          <div className="rotulo">Últimas trocas</div>
          <ul className="mt-1 space-y-1 text-[13px]">
            {trocas.map((h: any) => (
              <li key={h.id} className="text-noite-700">
                <span className="text-[12px] text-apagado">{dataHora(h.em)}</span> · {CONFIG_ROTULOS[h.chave] || h.chave}: {rotulo(h.valor_antes)} → <b>{rotulo(h.valor_depois)}</b>
                {h.por && <span className="text-[12px] text-apagado"> · {h.por}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
