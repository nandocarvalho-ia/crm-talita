import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Nome do escritório como aparece no CRM (título, login, marca sem logo). */
export const EMPRESA = 'TCF Advogados';
export const EMPRESA_SUB = 'Dra. Talita';

/** Símbolo neutro de reserva (balança), usado enquanto não chega a logo do escritório (pendência 19). */
export function SimboloMarca({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 34 34" className={className} aria-hidden="true">
      <rect width="34" height="34" rx="9" fill="#0E5E6B" />
      <g fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 9v16.5M12 26h10M8.5 11.5h17" />
        <path d="M9 11.5 6 19M9 11.5l3 7.5M25 11.5 22 19M25 11.5l3 7.5" />
        <path d="M5.4 19h7.2a3.6 3.6 0 0 1-7.2 0ZM21.4 19h7.2a3.6 3.6 0 0 1-7.2 0Z" />
      </g>
      <circle cx="17" cy="8.4" r="1.5" fill="#F2B01E" />
    </svg>
  );
}

/** Logo oficial do cliente: public/marca/logo.png (PNG transparente, sem bordas — ferramentas/preparar_marca.py).
 *  Sem o arquivo, mostra o símbolo de reserva + nome do escritório. */
export function Marca({ compacta = false }: { compacta?: boolean }) {
  const [semLogo, setSemLogo] = useState(false);
  if (semLogo) return (
    <div className="flex items-center gap-2.5">
      <SimboloMarca className={compacta ? 'h-9 w-9' : 'h-10 w-10'} />
      <div className="leading-tight">
        <div className="whitespace-nowrap font-display text-[15px] font-semibold tracking-tight">{EMPRESA}</div>
        <div className="text-xs font-semibold text-noite-600">{EMPRESA_SUB}</div>
      </div>
    </div>
  );
  return <img src="/marca/logo.png" alt={`${EMPRESA} · ${EMPRESA_SUB}`} onError={() => setSemLogo(true)} className={compacta ? 'h-10 w-auto' : 'h-[76px] w-auto'} />;
}

/** Cabeçalho padrão das telas: título, frase de apoio e ações à direita. */
export function Cabecalho({ titulo, apoio, children }: { titulo: string; apoio?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 pb-3 pt-4 md:px-0 md:pt-1">
      <div className="mr-auto min-w-0">
        <h1 className="titulo-tela">{titulo}</h1>
        {apoio && <div className="mt-0.5 text-[13px] text-noite-600">{apoio}</div>}
      </div>
      {children}
    </div>
  );
}

export const iniciais = (nome?: string | null) =>
  (nome || '?').trim().split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?';

/** Gaveta lateral por cima de tudo (fora do painel de vidro, que prenderia o "fixed"). */
export function Gaveta({ onFechar, children }: { onFechar: () => void; children: ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end bg-noite/40" onClick={onFechar}>
      <div className="h-full w-full max-w-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>,
    document.body,
  );
}

/** Aviso de erro em português, sem código técnico. */
export function Erro({ children }: { children: ReactNode }) {
  return <div role="alert" className="rounded-xl bg-alerta-100 px-3 py-2 text-sm text-alerta">{children}</div>;
}

/** Status devolvido pelas funções do banco → frase para a pessoa. */
export function textoStatus(s?: string | null) {
  switch (s) {
    case 'ok': return 'Salvo.';
    case 'somente_admin': case 'sem_permissao': return 'Só o administrador pode fazer isso.';
    case 'valor_invalido': return 'Valor inválido. Confira o formato e tente de novo.';
    case 'nao_encontrado': return 'Não encontrei esse registro. Atualize a página.';
    case 'campo_invalido': return 'Campo que não pode ser editado.';
    case 'coluna_invalida': return 'Coluna do funil inválida.';
    default: return s ? `Não salvou (${s}).` : 'Não salvou. Tente de novo.';
  }
}
