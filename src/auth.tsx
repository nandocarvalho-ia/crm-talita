import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import type { Usuario } from './lib/tipos';

type Ctx = { sessao: Session | null; usuario: Usuario | null; carregando: boolean; admin: boolean; sair: () => Promise<void> };
const AuthCtx = createContext<Ctx>({ sessao: null, usuario: null, carregando: true, admin: false, sair: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!sessao) { setUsuario(null); setCarregando(false); return; }
      setCarregando(true);
      const { data } = await supabase.from('crm_usuarios').select('*').eq('user_id', sessao.user.id).maybeSingle();
      if (vivo) { setUsuario((data as Usuario) || null); setCarregando(false); }
    })();
    return () => { vivo = false; };
  }, [sessao?.user.id]);

  const sair = async () => { await supabase.auth.signOut(); };
  return (
    <AuthCtx.Provider value={{ sessao, usuario, carregando, admin: usuario?.papel === 'admin' && usuario.ativo, sair }}>
      {children}
    </AuthCtx.Provider>
  );
}
export const useAuth = () => useContext(AuthCtx);
