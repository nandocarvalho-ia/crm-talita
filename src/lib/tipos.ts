export type Lead = {
  telefone: string; nome: string | null; cidade: string | null;
  origem_lead: string | null; indicado_por: string | null;
  // caso (classificador e leitura de documento)
  tipo_caso: string | null; vendedor: string | null; empreendimento: string | null; ano_compra: number | null;
  valor_pago: number | null; pagou_entrada: boolean | null; pagou_corretagem: boolean | null;
  motivo_cancelamento: string | null; parcelas: string | null; qtd_atraso: number | null;
  notificacao: string | null; entrega: string | null; construcao: string | null; construcao_regular: string | null;
  mora_no_lote: boolean | null; alienacao_mencionada: boolean; quer_presencial: boolean; persona_revelada: boolean;
  prioridade: 'baixa' | 'normal' | 'alta'; avisos_enviados: Record<string, unknown>;
  // documentos (o que foi lido fica em documentos_dados, por tipo de documento)
  contrato_recebido: boolean; contrato_recebido_em: string | null; relatorio_recebido: boolean;
  documentos_dados: Record<string, Record<string, unknown>>;
  // funil
  etapa_atual: string; status_lead: string; status_crm: string; pausar_ia: boolean; comprou: boolean;
  perfil_lead: string | null; observacoes: string | null; motivo_handoff: string | null; transferido_em: string | null;
  motivo_status: string | null; origem_campanha: string | null;
  followup_pendente: string | null; tentativas_followup: number; proximo_followup: string | null;
  retorno_prometido: string | null; retorno_prometido_em: string | null; retorno_motivo: string | null;
  retomar_em: string | null; recontatos: number;
  criado_em: string; atualizado_em: string;
  ultima_mensagem_em?: string | null; ultima_previa?: string | null; ultima_direcao?: string | null;
  nao_lidas?: number; movimentado_em?: string | null;
};

export type Mensagem = {
  id: string; telefone: string; direcao: 'entrada' | 'saida' | 'nota';
  autor: 'contato' | 'agente' | 'painel' | 'celular' | 'sistema'; autor_user_id: string | null;
  tipo: string; corpo: string | null; midia_path: string | null; midia_mime: string | null;
  midia_estado: 'pendente' | 'pronta' | 'falhou' | null; status: string; ocorreu_em: string;
  erro: string | null; origem: string;
};

export type Usuario = { email: string; user_id: string | null; nome: string | null; papel: 'admin' | 'operador'; ativo: boolean; senha_definida_em: string | null; ultimo_link_em: string | null };

/** Quem assume o lead depois da IA (textos da Visão geral, do funil e da ficha). */
export const EQUIPE = 'Dra. Talita';

/**
 * Colunas do funil. As chaves (id) são as do banco (leads.status_crm, crm_lead_mover) e não mudam.
 * Os rótulos são os da pendência 26, ainda a confirmar com a cliente: para trocar, mude só aqui.
 */
export const COLUNAS: { id: string; titulo: string; dica: string; cor: string }[] = [
  { id: 'novo', titulo: 'Novo', dica: 'Chegou e ainda não avançou', cor: 'bg-[#7C8F94]' },
  { id: 'em_atendimento', titulo: 'Em atendimento', dica: 'A IA está conduzindo', cor: 'bg-petroleo' },
  { id: 'com_consultor', titulo: 'Com a Dra. Talita', dica: 'Mandou o contrato ou pediu a Dra.', cor: 'bg-sol' },
  { id: 'proposta', titulo: 'Honorários enviados', dica: 'Formulário e honorários enviados', cor: 'bg-[#6B5BD2]' },
  { id: 'ganho', titulo: 'Contratado', dica: 'Fechou com o escritório', cor: 'bg-menta-600' },
  { id: 'perdido', titulo: 'Perdido', dica: 'Fora do perfil ou desistiu', cor: 'bg-alerta' },
];
export const coluna = (id: string) => COLUNAS.find((c) => c.id === id)?.titulo || id;

export const ETAPAS: Record<string, string> = {
  etapa_1: '1 · Identificar', etapa_2: '2 · Qualificar', etapa_3: '3 · Contrato', finalizado: 'Qualificado',
};

/** Opções dos campos da ficha: só os valores que o banco aceita (check das colunas e crm_lead_editar). */
export const OPCOES: Record<string, [string, string][]> = {
  tipo_caso: [['lote', 'Lote'], ['cota', 'Cota / multipropriedade'], ['consorcio', 'Consórcio'], ['apartamento', 'Apartamento'], ['casa', 'Casa'], ['outro', 'Outro']],
  vendedor: [['loteadora', 'Loteadora'], ['imobiliaria', 'Imobiliária'], ['banco', 'Banco'], ['pessoa_fisica', 'Pessoa física'], ['corretor', 'Corretor'], ['cessao_agio', 'Cessão / ágio'], ['nao_sabe', 'Não sabe']],
  origem_lead: [['anuncio', 'Anúncio'], ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['indicacao', 'Indicação'], ['google', 'Google'], ['outro', 'Outro']],
  parcelas: [['em_dia', 'Em dia'], ['atraso', 'Em atraso']],
  notificacao: [['nao', 'Não recebeu'], ['empresa', 'Da empresa'], ['extrajudicial', 'Extrajudicial'], ['judicial', 'Judicial']],
  entrega: [['entregue', 'Entregue'], ['em_obras', 'Em obras'], ['atrasada', 'Atrasada'], ['nao_sabe', 'Não sabe']],
  construcao: [['sim', 'Sim'], ['nao', 'Não']],
  construcao_regular: [['sim', 'Sim'], ['nao', 'Não'], ['nao_sabe', 'Não sabe']],
  status_lead: [['ativo', 'Ativo'], ['transferido', `Com a ${EQUIPE}`], ['inativo', 'Esfriou'], ['desqualificado', 'Fora do perfil'], ['opt_out', 'Pediu para parar']],
  prioridade: [['baixa', 'Prioridade baixa'], ['normal', 'Prioridade normal'], ['alta', 'Valor alto']],
};
/** Rótulo de um valor (ex.: rotOpcao('vendedor', 'pessoa_fisica') → "Pessoa física"). */
export const rotOpcao = (campo: string, v?: string | null) => (v ? OPCOES[campo]?.find(([k]) => k === v)?.[1] || v : '—');
export const simNao = (v?: boolean | null) => (v == null ? '—' : v ? 'Sim' : 'Não');
