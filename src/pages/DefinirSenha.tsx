import { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminUsuarios } from '../lib/funcoes';
import { TelaEntrada } from './Login';

export default function DefinirSenha() {
  const token = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token') || '';
  const [senha, setSenha] = useState(''); const [conf, setConf] = useState('');
  const [erro, setErro] = useState(''); const [ok, setOk] = useState('');
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro('');
    if (senha.length < 8) return setErro('Use pelo menos 8 caracteres.');
    if (senha !== conf) return setErro('As duas senhas não são iguais.');
    try { const r = await adminUsuarios({ acao: 'definir_senha', token, senha }); setOk(r.email); history.replaceState(null, '', '/definir-senha'); }
    catch (e2) { setErro((e2 as Error).message); }
  }
  return (
        <TelaEntrada>
        {ok ? (<>
          <h1 className="mt-7 font-display text-2xl font-semibold">Senha criada</h1>
          <p className="mt-2 text-sm text-apagado">Agora é só entrar com <b>{ok}</b> e a senha que você acabou de criar.</p>
          <Link to="/" className="btn-primario mt-5 h-11 w-full">Ir para o login</Link>
        </>) : (
          <form onSubmit={salvar}>
            <h1 className="mt-7 font-display text-2xl font-semibold tracking-tight">Criar sua senha</h1>
            {!token && <div className="mt-3 rounded-xl bg-alerta-100 p-2.5 text-sm text-alerta">Link incompleto. Abra o link exatamente como recebeu.</div>}
            <div className="mt-4 space-y-3">
              <div><label className="rotulo" htmlFor="s1">Nova senha</label><input id="s1" className="campo h-11" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} /></div>
              <div><label className="rotulo" htmlFor="s2">Repita a senha</label><input id="s2" className="campo h-11" type="password" autoComplete="new-password" value={conf} onChange={(e) => setConf(e.target.value)} /></div>
            </div>
            {erro && <div className="mt-3 rounded-xl bg-alerta-100 p-2.5 text-sm text-alerta">{erro}</div>}
            <button className="btn-primario mt-5 h-11 w-full" disabled={!token}>Salvar senha</button>
          </form>
        )}
    </TelaEntrada>
  );
}
