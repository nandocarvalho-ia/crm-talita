import { useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { Marca } from '../components/ui';

/** Moldura das telas de fora do painel (login, criar senha). */
export function TelaEntrada({ children }: { children: ReactNode }) {
  return (
    <div className="ceu relative grid min-h-full place-items-center overflow-hidden p-4">
      <div className="relative w-full max-w-sm rounded-[24px] bg-white/80 p-7 shadow-painel ring-1 ring-white backdrop-blur-xl">
        <div className="flex justify-center"><Marca /></div>
        {children}
      </div>
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState(''); const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(''); const [carregando, setCarregando] = useState(false);
  async function entrar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
    setCarregando(false);
    if (error) setErro('E-mail ou senha não conferem.');
  }
  return (
    <TelaEntrada>
      <form onSubmit={entrar}>
        <h1 className="mt-7 font-display text-2xl font-semibold tracking-tight">Entrar no CRM</h1>
        <p className="mt-1 text-sm text-noite-600">O atendimento do escritório TCF Advogados em um só lugar.</p>
        <div className="mt-5 space-y-3">
          <div><label className="rotulo" htmlFor="email">E-mail</label><input id="email" className="campo h-11" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div><label className="rotulo" htmlFor="senha">Senha</label><input id="senha" className="campo h-11" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required /></div>
        </div>
        {erro && <div className="mt-3 rounded-xl bg-alerta-100 p-2.5 text-sm text-alerta">{erro}</div>}
        <button className="btn-primario mt-5 h-11 w-full" disabled={carregando}>{carregando ? 'Entrando…' : 'Entrar'}</button>
        <p className="mt-3 text-center text-xs text-apagado">Esqueceu a senha? Peça um novo link ao administrador.</p>
      </form>
    </TelaEntrada>
  );
}
