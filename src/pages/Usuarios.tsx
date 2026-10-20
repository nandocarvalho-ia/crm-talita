import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, UserPlus, KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { adminUsuarios } from '../lib/funcoes';
import type { Usuario } from '../lib/tipos';
import { dataHora } from '../lib/format';
import { useAuth } from '../auth';
import { Cabecalho } from '../components/ui';

export default function Usuarios() {
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ['usuarios'], queryFn: async () => ((await supabase.from('crm_usuarios').select('*').order('criado_em')).data || []) as Usuario[] });
  const [novo, setNovo] = useState({ email: '', nome: '', papel: 'operador' });
  const [link, setLink] = useState(''); const [erro, setErro] = useState('');
  async function acao(corpo: Record<string, unknown>) {
    setErro(''); setLink('');
    try { const r = await adminUsuarios(corpo); if (r.link) setLink(r.link); qc.invalidateQueries({ queryKey: ['usuarios'] }); }
    catch (e) { setErro((e as Error).message); }
  }
  return (
    <div className="h-full overflow-y-auto md:pr-1">
      <Cabecalho titulo="Usuários do CRM" apoio="Quem entra no painel e o que cada pessoa pode fazer." />
      <div className="max-w-4xl space-y-4 px-4 pb-4 md:px-0">
        <div className="cartao p-5">
          <h2 className="mb-3 text-[15px] font-bold">Convidar pessoa</h2>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_150px_auto]">
            <input className="campo" placeholder="e-mail" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} />
            <input className="campo" placeholder="nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
            <select className="campo" value={novo.papel} onChange={(e) => setNovo({ ...novo, papel: e.target.value })}><option value="operador">Operador</option><option value="admin">Administrador</option></select>
            <button className="btn-primario" onClick={() => acao({ acao: 'convidar', ...novo })}><UserPlus className="h-4 w-4" />Convidar</button>
          </div>
          <p className="mt-2 text-xs text-apagado">Operador atende, move cards e edita a base de conhecimento, as objeções e os textos de follow-up. Administrador também vê a Visão geral e mexe no roteiro, nas regras, nas configurações, nos clientes atuais, nos áudios e na conexão do WhatsApp.</p>
          {link && <div className="mt-3 rounded-xl bg-menta-100 p-3 text-sm text-menta-700"><b>Link para criar a senha (vale 72 h).</b> Mande para a pessoa pelo WhatsApp:
            <div className="mt-1 flex gap-2"><input className="campo" readOnly value={link} /><button className="btn-sec" onClick={() => navigator.clipboard.writeText(link)}><Copy className="h-4 w-4" /></button></div></div>}
          {erro && <div className="mt-3 rounded-xl bg-alerta-100 p-3 text-sm text-alerta">{erro}</div>}
        </div>
        <div className="cartao divide-y divide-linha">
          {data.map((u) => (
            <div key={u.email} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1"><div className="font-bold">{u.nome || u.email}</div><div className="text-xs text-apagado">{u.email} · {u.senha_definida_em ? `senha definida em ${dataHora(u.senha_definida_em)}` : 'ainda não criou a senha'}</div></div>
              <span className={`chip ${u.papel === 'admin' ? 'bg-petroleo text-white' : 'bg-papel text-noite-600'}`}>{u.papel === 'admin' ? 'Administrador' : 'Operador'}</span>
              {!u.ativo && <span className="chip bg-alerta-100 text-alerta">inativo</span>}
              {u.email !== usuario?.email && <>
                <button className="btn-sec !py-1" onClick={() => acao({ acao: 'link_senha', email: u.email })}><KeyRound className="h-4 w-4" />Link de senha</button>
                <button className="btn-sec !py-1" onClick={() => acao({ acao: 'papel', email: u.email, papel: u.papel === 'admin' ? 'operador' : 'admin' })}>{u.papel === 'admin' ? 'Tornar operador' : 'Tornar admin'}</button>
                <button className={u.ativo ? 'btn-perigo !py-1' : 'btn-sec !py-1'} onClick={() => acao({ acao: u.ativo ? 'desativar' : 'ativar', email: u.email })}>{u.ativo ? 'Desativar' : 'Reativar'}</button>
              </>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
