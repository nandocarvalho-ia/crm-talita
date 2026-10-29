import { supabase, FUNCOES_URL } from './supabase';

/** Chama uma Edge Function com o login de quem está usando. Erros viram mensagem em português. */
async function chamar(funcao: string, corpo: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession();
  let r: Response;
  try {
    r = await fetch(`${FUNCOES_URL}/${funcao}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}) },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new Error('A conexão caiu. Confira a internet e tente de novo.');
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || (j && typeof j === 'object' && 'erro' in j && j.erro)) {
    throw new Error(j?.erro || (r.status === 401 || r.status === 403 ? 'Sem permissão. Entre de novo como administrador.' : 'O servidor não respondeu como esperado. Tente de novo em instantes.'));
  }
  return j;
}

/** Usuários do CRM (Edge Function admin-usuarios). */
export async function adminUsuarios(corpo: Record<string, unknown>) {
  return chamar('admin-usuarios', { ...corpo, origem: window.location.origin });
}

/** Conexão do WhatsApp (Edge Function whatsapp-conexao): status, conectar, cancelar, desconectar. Só administrador. */
export async function whatsappConexao(corpo: Record<string, unknown>) {
  return chamar('whatsapp-conexao', corpo);
}

/** Senha do admin para liberar uma mudança na estrutura dos prompts (Edge Function confirmar-senha).
 *  Devolve { aprovacao } (vale 5 minutos e uma vez só). Senha errada vira erro "Senha incorreta." */
export async function confirmarSenha(senha: string) {
  return chamar('confirmar-senha', { senha });
}
