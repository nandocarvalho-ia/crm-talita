import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Mic, Plus, Upload, Loader2, X, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Erro, Gaveta, textoStatus } from './ui';

type Audio = { slug: string; situacao: string; texto_equivalente: string; url: string | null; duracao_seg: number | null; ativo: boolean; ordem: number; atualizado_em: string };

// Bucket público `audios` (008): a Uazapi baixa o arquivo pela URL. Nome aleatório para a URL não ser adivinhável.
const BUCKET = 'audios';
const TIPOS: Record<string, string> = { ogg: 'audio/ogg', opus: 'audio/ogg', oga: 'audio/ogg', mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac' };
const LIMITE = 10 * 1024 * 1024;

const hexAleatorio = (bytes = 16) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
const duracao = (s?: number | null) => (s == null ? '—' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

/** Lê a duração do arquivo no navegador (sem enviar nada). */
function medirDuracao(arquivo: File): Promise<number | null> {
  return new Promise((ok) => {
    const a = document.createElement('audio'); const u = URL.createObjectURL(arquivo);
    const fim = (v: number | null) => { URL.revokeObjectURL(u); ok(v); };
    a.preload = 'metadata';
    a.onloadedmetadata = () => fim(Number.isFinite(a.duration) ? Math.round(a.duration) : null);
    a.onerror = () => fim(null);
    setTimeout(() => fim(null), 5000);
    a.src = u;
  });
}

function Editor({ audio, onFechar }: { audio: Audio | null; onFechar: () => void }) {
  const qc = useQueryClient();
  const novo = !audio;
  const [f, setF] = useState({
    slug: audio?.slug || '', situacao: audio?.situacao || '', texto_equivalente: audio?.texto_equivalente || '',
    ordem: String(audio?.ordem ?? 0), ativo: audio?.ativo ?? false,
  });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [passo, setPasso] = useState('');
  const [erro, setErro] = useState('');
  const slugOk = /^[a-z0-9_-]{2,40}$/.test(f.slug);
  const completo = slugOk && f.situacao.trim() && f.texto_equivalente.trim();

  function escolher(a: File | null) {
    setErro('');
    if (!a) { setArquivo(null); return; }
    const ext = (a.name.split('.').pop() || '').toLowerCase();
    if (!TIPOS[ext]) { setErro('Formato não aceito. Use .ogg/.opus (de preferência), .mp3, .m4a ou .aac.'); return; }
    if (a.size > LIMITE) { setErro('Arquivo maior que 10 MB. Mande um áudio mais curto.'); return; }
    setArquivo(a);
  }

  async function salvar() {
    setErro('');
    const p: Record<string, unknown> = { situacao: f.situacao.trim(), texto_equivalente: f.texto_equivalente.trim(), ordem: f.ordem || '0', ativo: f.ativo };
    if (arquivo) {
      setPasso('Enviando o arquivo…');
      const ext = (arquivo.name.split('.').pop() || '').toLowerCase();
      const caminho = `${hexAleatorio()}.${ext === 'opus' || ext === 'oga' ? 'ogg' : ext}`;
      const seg = await medirDuracao(arquivo);
      let up;
      try { up = await supabase.storage.from(BUCKET).upload(caminho, arquivo, { contentType: TIPOS[ext], upsert: false, cacheControl: '31536000' }); }
      catch { setPasso(''); setErro('A conexão caiu durante o envio. Tente de novo.'); return; }
      if (up.error) {
        setPasso('');
        setErro(/row-level|policy|unauthorized|403/i.test(up.error.message)
          ? 'O servidor não deixou enviar o arquivo (permissão do armazenamento). Fale com a equipe técnica.'
          : 'Não consegui enviar o arquivo. Confira o formato e tente de novo.');
        return;
      }
      p.url = supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
      if (seg != null) p.duracao_seg = String(seg);
    }
    setPasso('Salvando…');
    const { data: r, error } = await supabase.rpc('crm_audio_salvar', { p_slug: f.slug, p });
    setPasso('');
    if (error || (r as any)?.status !== 'ok') { setErro(error ? 'Não salvou. Confira a conexão e tente de novo.' : textoStatus((r as any)?.status)); return; }
    qc.invalidateQueries({ queryKey: ['audios'] });
    onFechar();
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-linha px-5 py-4">
        <h2 className="font-display text-xl font-semibold">{novo ? 'Novo áudio' : `Áudio ${audio!.slug}`}</h2>
        <button className="btn-sec !px-2" onClick={onFechar} aria-label="Fechar"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto bg-papel/60 p-4">
        <div className="space-y-3 rounded-[18px] bg-white p-4 shadow-card">
          <div>
            <label className="rotulo" htmlFor="au-slug">Nome curto (identificador)</label>
            <input id="au-slug" className="campo font-mono" value={f.slug} readOnly={!novo} placeholder="ex.: explica-direito"
              onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} />
            <div className={`mt-1 text-[12px] ${f.slug && !slugOk ? 'font-semibold text-alerta' : 'text-apagado'}`}>Letras minúsculas, números, hífen ou _ (2 a 40). A IA usa esse nome para escolher o áudio. {novo ? '' : 'Não muda depois de criado.'}</div>
          </div>
          <div>
            <label className="rotulo" htmlFor="au-sit">Quando usar</label>
            <textarea id="au-sit" className="campo" rows={2} value={f.situacao} placeholder="ex.: depois das perguntas, para explicar o direito de receber de volta"
              onChange={(e) => setF({ ...f, situacao: e.target.value })} />
            <div className="mt-1 text-[12px] text-apagado">Vai para o prompt da IA. Seja claro sobre o momento da conversa.</div>
          </div>
          <div>
            <label className="rotulo" htmlFor="au-txt">O que ela fala no áudio (texto equivalente)</label>
            <textarea id="au-txt" className="campo" rows={5} value={f.texto_equivalente} onChange={(e) => setF({ ...f, texto_equivalente: e.target.value })} />
            <div className="mt-1 text-[12px] text-apagado">Sai em texto quando o áudio não pode ir (lead não mandou áudio, já ouviu este, ou o arquivo falhou).</div>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-28"><label className="rotulo" htmlFor="au-ord">Ordem</label>
              <input id="au-ord" className="campo" inputMode="numeric" value={f.ordem} onChange={(e) => setF({ ...f, ordem: e.target.value.replace(/\D/g, '') })} /></div>
            <label className="flex h-10 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} />Ativo (a IA pode usar)</label>
          </div>
        </div>

        <div className="space-y-3 rounded-[18px] bg-white p-4 shadow-card">
          <div className="text-sm font-bold">Arquivo</div>
          {audio?.url && !arquivo && <audio controls preload="none" src={audio.url} className="w-full" />}
          {!audio?.url && !arquivo && <div className="text-[13px] text-apagado">Sem arquivo: enquanto não tiver, vai sempre o texto.</div>}
          {arquivo && <div className="text-[13px]">Novo arquivo: <b>{arquivo.name}</b> ({(arquivo.size / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} KB)</div>}
          <label className="btn-sec cursor-pointer">
            <Upload className="h-4 w-4" />{audio?.url || arquivo ? 'Trocar arquivo' : 'Escolher arquivo'}
            <input type="file" className="sr-only" accept=".ogg,.opus,.oga,.mp3,.m4a,.aac,audio/*" onChange={(e) => escolher(e.target.files?.[0] || null)} />
          </label>
          <div className="text-[12px] text-apagado">Só gravações reais da Dra. Talita. De preferência .ogg/.opus (o formato do áudio do WhatsApp), até 10 MB.</div>
        </div>

        {erro && <Erro>{erro}</Erro>}
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primario" disabled={!completo || !!passo} onClick={salvar}>{passo ? <><Loader2 className="h-4 w-4 animate-spin" />{passo}</> : 'Salvar'}</button>
          <button className="btn-sec" onClick={onFechar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

export default function Audios() {
  const { data = [], isLoading, error } = useQuery<Audio[]>({ queryKey: ['audios'],
    queryFn: async () => { const { data, error } = await supabase.from('audios').select('*').order('ordem').order('slug'); if (error) throw error; return (data || []) as Audio[]; } });
  const [aberto, setAberto] = useState<Audio | null | 'novo'>(null);
  const ativos = data.filter((a) => a.ativo && a.url).length;
  return (
    <div className="max-w-4xl space-y-4">
      <div className="cartao flex flex-wrap items-center gap-3 p-5">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-sol-100 text-sol-700"><Mic className="h-5 w-5" /></span>
        <div className="min-w-[220px] flex-1 text-sm">
          <div className="text-[15px] font-bold">Áudios gravados pela Dra. Talita</div>
          <div className="text-noite-600">Só vão quando o lead mandou áudio, cada um no máximo uma vez por lead, e o arquivo sai antes do texto. {data.length ? `${ativos} de ${data.length} ${data.length === 1 ? 'pronto' : 'prontos'} para uso.` : ''}</div>
        </div>
        <button className="btn-primario" onClick={() => setAberto('novo')}><Plus className="h-4 w-4" />Novo áudio</button>
      </div>

      {error && <Erro>Não consegui carregar os áudios. Atualize a página.</Erro>}
      {isLoading && <div className="cartao p-5 text-sm text-apagado">Carregando…</div>}
      {!isLoading && !error && !data.length && (
        <div className="cartao p-6 text-center text-sm text-apagado">
          Nenhum áudio cadastrado ainda. Enquanto isso, a IA responde só em texto.
          <div className="mt-3"><button className="btn-sec" onClick={() => setAberto('novo')}><Plus className="h-4 w-4" />Cadastrar o primeiro</button></div>
        </div>
      )}
      {!!data.length && (
        <div className="cartao divide-y divide-linha">
          {data.map((a) => (
            <div key={a.slug} className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold">{a.slug}</span>
                  {a.ativo && a.url ? <span className="chip bg-menta-100 text-menta-700">ativo</span>
                    : a.ativo ? <span className="chip bg-sol-100 text-sol-700">ativo, sem arquivo: vai o texto</span>
                    : <span className="chip bg-papel text-apagado">desligado</span>}
                  <span className="text-[12px] text-apagado numero">{duracao(a.duracao_seg)}</span>
                </div>
                <div className="mt-0.5 text-[13px] text-noite-700">{a.situacao}</div>
                <div className="mt-0.5 line-clamp-2 text-[12px] text-apagado">“{a.texto_equivalente}”</div>
              </div>
              {a.url ? <audio controls preload="none" src={a.url} className="h-10 w-full md:w-60" aria-label={`Ouvir ${a.slug}`} /> : null}
              <button className="btn-sec shrink-0 self-start md:self-center" onClick={() => setAberto(a)}><Pencil className="h-4 w-4" />Editar</button>
            </div>
          ))}
        </div>
      )}
      {aberto && <Gaveta onFechar={() => setAberto(null)}><Editor audio={aberto === 'novo' ? null : aberto} onFechar={() => setAberto(null)} /></Gaveta>}
    </div>
  );
}
