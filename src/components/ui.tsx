import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Nome do escritório como aparece no CRM (título, login, marca sem logo). */
export const EMPRESA = 'TCF Advogados';
export const EMPRESA_SUB = 'Dra. Talita';

/** Logo oficial do escritório: selo circular da TCF em public/marca/logo.png (fundo verde só dentro do círculo,
 *  transparente fora; original em crm/marca-origem/). O selo já tem fundo próprio e serve em fundo claro ou escuro,
 *  por isso não há versão branca. O nome fica ao lado (compacta: topo do celular) ou abaixo (menu e login).
 *  Sem o arquivo, um disco verde com "TCF" em dourado ocupa o lugar do selo. */
export function Marca({ compacta = false }: { compacta?: boolean }) {
  const [semLogo, setSemLogo] = useState(false);
  const tam = compacta ? 'h-10 w-10' : 'h-[76px] w-[76px]';
  const selo = semLogo
    ? <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full bg-petroleo font-display font-semibold tracking-[.2em] text-sol-300 ring-2 ring-sol-300 ${tam} ${compacta ? 'text-[10px]' : 'text-[15px]'}`}>TCF</span>
    : <img src="/marca/logo.png" alt="" width={compacta ? 40 : 76} height={compacta ? 40 : 76} onError={() => setSemLogo(true)}
        className={`shrink-0 rounded-full drop-shadow-[0_2px_6px_rgba(15,29,25,.18)] ${tam}`} />;
  if (compacta) return (
    <div className="flex items-center gap-2.5">
      {selo}
      <div className="leading-tight">
        <div className="whitespace-nowrap font-display text-[15px] font-semibold tracking-tight">{EMPRESA}</div>
        <div className="text-xs font-semibold text-noite-600">{EMPRESA_SUB}</div>
      </div>
    </div>
  );
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      {selo}
      <div className="leading-tight">
        <div className="whitespace-nowrap font-display text-[16px] font-semibold tracking-tight">{EMPRESA}</div>
        <div className="text-[13px] font-semibold text-noite-600">{EMPRESA_SUB}</div>
      </div>
    </div>
  );
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
