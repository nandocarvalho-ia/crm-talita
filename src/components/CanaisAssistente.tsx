import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { tel as telefoneBonito } from '../lib/format';

type Canal = { telefone: string; usuario_email: string; usuario_nome: string | null; usuario_ok: boolean; ativo: boolean; relatorio: boolean };
type Admin = { email: string; nome: string | null };

const MSG: Record<string, string> = {
  telefone_invalido: 'Número inválido. Use DDI 55, DDD e número (ex.: 5516999990000).',
  usuario_invalido: 'Escolha um administrador ativo do CRM.',
  ja_existe: 'Esse número já está na lista.',
  somente_admin: 'Só administrador pode mexer nesta lista.',
  nao_encontrado: 'Esse número já não estava na lista.',
};

/** Números de WhatsApp que conversam com a assistente (023). Fora da lista, quem responde é a Clara, como para um lead. */
export default function CanaisAssistente() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['assistente-canais'], queryFn: async () => {
    const { data: r, error: e } = await supabase.rpc('crm_assistente_canais');
    if (e) throw e;
    return r as { status: string; canais: Canal[]; admins: Admin[] };
  } });
  const canais = data?.canais || [], admins = data?.admins || [];
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');
  const [relatorio, setRelatorio] = useState(true);
  const [msg, setMsg] = useState<{ erro: boolean; txt: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const dono = email || admins[0]?.email || '';

  async function chamar(fn: string, args: Record<string, unknown>, ok: string) {
    setOcupado(true); setMsg(null);
    const { data: r, error: e } = await supabase.rpc(fn, args);
    setOcupado(false);
    const st = (r as any)?.status;
    if (e || st !== 'ok') { setMsg({ erro: true, txt: e ? 'Não salvou. Confira a conexão.' : MSG[st] || 'Não deu certo. Tente de novo.' }); return false; }
    setMsg({ erro: false, txt: ok });
    qc.invalidateQueries({ queryKey: ['assistente-canais'] });
    return true;
  }
  async function adicionar() {
    if (await chamar('crm_assistente_canal_salvar', { p_telefone: tel, p_email: dono, p_relatorio: relatorio },
      'Pronto. Mensagens desse número agora vão para a assistente.')) { setTel(''); }
  }
  async function remover(c: Canal) {
    if (!window.confirm(`Tirar ${telefoneBonito(c.telefone)} da lista? A partir da próxima mensagem, quem responde esse número é a Clara, como para um lead.`)) return;
    await chamar('crm_assistente_canal_remover', { p_telefone: c.telefone }, 'Removido. Esse número volta a falar com a Clara (use /delete para começar do zero).');
  }
  const nome = (c: Canal) => c.usuario_nome || c.usuario_email;

  return (
    <section className="cartao max-w-3xl space-y-4 p-5">
      <div>
        <h2 className="flex items-center gap-2 text-[15px] font-bold"><MessageCircle className="h-5 w-5 text-petroleo" />Números que falam com a assistente no WhatsApp</h2>
        <p className="mt-0.5 text-[13px] text-noite-600">
          Mensagens desses números vão para a assistente, na mesma conversa do usuário escolhido. Qualquer outro número, mesmo sendo da equipe, fala com a Clara como se fosse um lead.
        </p>
      </div>
      {error && <div className="text-sm text-alerta">Não consegui carregar a lista. Atualize a página.</div>}
      {isLoading && <div className="text-sm text-apagado">Carregando…</div>}
      {!isLoading && !error && (
        canais.length ? (
          <ul className="divide-y divide-linha rounded-xl ring-1 ring-linha">
            {canais.map((c) => (
              <li key={c.telefone} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                <span className="numero font-semibold">{telefoneBonito(c.telefone)}</span>
                <span className="order-last basis-full text-noite-600 sm:order-none sm:basis-auto sm:flex-1">conversa de {nome(c)}{c.relatorio ? ' · recebe o relatório de segunda' : ''}
                  {!c.usuario_ok && <span className="ml-1 font-semibold text-alerta">(usuário inativo ou sem admin: não funciona)</span>}</span>
                <button className="btn-sec ml-auto !h-9 !px-2.5 sm:ml-0" disabled={ocupado} aria-label={`Tirar ${telefoneBonito(c.telefone)}`} onClick={() => remover(c)}>
                  <Trash2 className="h-4 w-4" />Tirar
                </button>
              </li>
            ))}
          </ul>
        ) : <div className="rounded-xl bg-papel px-3 py-2.5 text-sm text-apagado">Nenhum número. A assistente fica só na aba Assistente do CRM.</div>
      )}
      <div className="space-y-2 border-t border-linha pt-4">
        <div className="rotulo">Colocar um número</div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[180px] flex-1">
            <label className="text-[12px] text-apagado" htmlFor="canal-tel">WhatsApp (com DDI e DDD)</label>
            <input id="canal-tel" className="campo" inputMode="tel" placeholder="5516999990000" value={tel} onChange={(e) => { setTel(e.target.value); setMsg(null); }} />
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="text-[12px] text-apagado" htmlFor="canal-dono">Conversa de quem</label>
            <select id="canal-dono" className="campo" value={dono} onChange={(e) => setEmail(e.target.value)}>
              {admins.map((a) => <option key={a.email} value={a.email}>{a.nome ? `${a.nome} (${a.email})` : a.email}</option>)}
            </select>
          </div>
          <label className="flex h-11 items-center gap-2 text-sm"><input type="checkbox" checked={relatorio} onChange={(e) => setRelatorio(e.target.checked)} />Relatório de segunda</label>
          <button className="btn-primario" disabled={ocupado || !tel.trim() || !dono} onClick={adicionar}><Plus className="h-4 w-4" />Colocar</button>
        </div>
        <p className="text-[12px] text-apagado">Ao entrar na lista, a conversa desse número com a Clara fica pausada. Ao sair, a Clara volta a responder.</p>
        {msg && <div role="status" className={`text-[13px] font-semibold ${msg.erro ? 'text-alerta' : 'text-menta-700'}`}>{msg.txt}</div>}
      </div>
    </section>
  );
}
