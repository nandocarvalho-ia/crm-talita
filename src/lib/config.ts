/**
 * Chaves da tabela `config` que aparecem em Agente → Configurações.
 * A validação abaixo repete a do crm_config_salvar (003/006) só para avisar antes de salvar:
 * quem decide é o banco, que confere de novo e devolve `valor_invalido`.
 * Modelos e esforço de raciocínio (modelo_*, esforco_*) ficam no cartão "Modelos de IA".
 */
export type TipoCfg = 'texto' | 'hora' | 'simnao' | 'reais' | 'reais_opcional' | 'dias' | 'telefones' | 'feriados' | 'leitura';
export type ItemCfg = { chave: string; rotulo: string; ajuda?: string; tipo: TipoCfg };

export const GRUPOS_CONFIG: { titulo: string; apoio?: string; itens: ItemCfg[] }[] = [
  { titulo: 'Atendimento da Dra. Talita', apoio: 'Fora deste horário (e nos feriados) a IA atende como plantão, falando como a equipe.', itens: [
    { chave: 'horario_humano_inicio', rotulo: 'A Dra. atende a partir de', tipo: 'hora' },
    { chave: 'horario_humano_fim', rotulo: 'A Dra. atende até', tipo: 'hora' },
    { chave: 'atende_sabado', rotulo: 'Sábado conta como horário da Dra.', tipo: 'simnao' },
    { chave: 'feriados', rotulo: 'Dias extras sem atendimento (DD/MM, separados por vírgula)', ajuda: 'Feriados nacionais, de SP e de Franca (inclusive Carnaval, Sexta-feira Santa e Corpus Christi) já são automáticos. Use aqui só dias a mais, ex.: 24/12, 31/12.', tipo: 'feriados' },
    { chave: 'prefixo_plantao', rotulo: 'Linha antes das mensagens do plantão (até 60 letras; vazio = nenhuma)', ajuda: 'Ex.: Atendimento · Dra. Talita', tipo: 'texto' },
    { chave: 'nome_agente', rotulo: 'Nome da atendente virtual (vazio = "Clara")', tipo: 'texto' },
  ] },
  { titulo: 'Valores do caso', apoio: 'Valor já pago pelo lote. O texto do prompt também cita o valor mínimo: se mudar aqui, confira o roteiro.', itens: [
    { chave: 'valor_minimo', rotulo: 'Abaixo deste valor pago (R$) o caso não é atendido', tipo: 'reais' },
    { chave: 'valor_prioridade', rotulo: 'Abaixo deste valor pago (R$) o lead é prioridade baixa (1 follow-up)', tipo: 'reais' },
    { chave: 'aviso_valor_alto', rotulo: 'A partir deste valor pago (R$) a Dra. recebe aviso quando falta só o contrato (vazio = não avisa)', ajuda: 'O aviso sai uma vez, depois que a IA explicou o caso e pediu o contrato, com a ficha e o resumo do lead. Também marca a prioridade alta.', tipo: 'reais_opcional' },
  ] },
  { titulo: 'Follow-up', itens: [
    { chave: 'janela_inicio', rotulo: 'Não enviar antes de', tipo: 'hora' },
    { chave: 'janela_fim', rotulo: 'Não enviar depois de', tipo: 'hora' },
    { chave: 'enviar_sabado', rotulo: 'Enviar aos sábados', tipo: 'simnao' },
    { chave: 'enviar_domingo', rotulo: 'Enviar aos domingos', tipo: 'simnao' },
    { chave: 'recontato_dias', rotulo: 'Recontato do lead que esfriou (dias)', tipo: 'dias' },
    { chave: 'turnos_retomar', rotulo: 'Conversa fora do assunto: respostas até a IA retomar o roteiro', tipo: 'dias' },
    { chave: 'turnos_avisar', rotulo: 'Conversa fora do assunto: respostas até a Dra. receber aviso', tipo: 'dias' },
  ] },
  { titulo: 'Números', apoio: 'Só dígitos, com DDI e DDD (ex.: 5516999990000), separados por vírgula.', itens: [
    { chave: 'notificar_telefones', rotulo: 'Quem recebe os avisos ("lead precisa de você", cliente escreveu, aviso silencioso)', tipo: 'telefones' },
    { chave: 'telefones_teste', rotulo: 'Números de teste (conversam com a IA como lead, mesmo sendo da equipe)', tipo: 'telefones' },
    { chave: 'telefones_internos', rotulo: 'Números da equipe que nunca viram lead (além dos que recebem aviso)', tipo: 'telefones' },
    { chave: 'delete_liberado', rotulo: '/delete zera a conversa de qualquer número (fase de testes)', ajuda: 'Desligue antes de ir ao ar: com "não", só os números de teste podem usar /delete.', tipo: 'simnao' },
  ] },
  { titulo: 'Assistente do CRM', apoio: 'A Clara que conversa com você na aba Assistente. O custo de cada pedido é calculado pelos tokens que a OpenAI informa.', itens: [
    { chave: 'assistente_teto_mensal', rotulo: 'Gasto máximo por mês (R$)', ajuda: 'Ao chegar, o assistente para até o mês virar. Com 80% gasto, ele avisa.', tipo: 'reais' },
    { chave: 'assistente_limite_diario', rotulo: 'Pedidos por dia', ajuda: 'Proteção contra uso estranho.', tipo: 'dias' },
    { chave: 'cotacao_dolar', rotulo: 'Dólar em reais (para calcular o custo)', ajuda: 'Ex.: 5.30. Atualize de vez em quando.', tipo: 'texto' },
  ] },
  { titulo: 'Sistema', itens: [
    { chave: 'fuso', rotulo: 'Fuso horário', ajuda: 'Ex.: America/Sao_Paulo', tipo: 'texto' },
    { chave: 'uazapi_instancia', rotulo: 'Instância do WhatsApp (rótulo técnico; quem troca é a equipe técnica)', tipo: 'leitura' },
  ] },
];

/** Rótulo de cada chave (inclui modelos e esforço), para o histórico e para conferir que nenhuma chave ficou sem nome. */
export const CONFIG_ROTULOS: Record<string, string> = {
  ...Object.fromEntries(GRUPOS_CONFIG.flatMap((g) => g.itens.map((i) => [i.chave, i.rotulo]))),
  modelo_agente: 'Modelo da conversa com o lead', modelo_classificador: 'Modelo do classificador',
  modelo_leitura_documento: 'Modelo da leitura de documento', modelo_followup: 'Modelo do follow-up',
  esforco_agente: 'Raciocínio da conversa', esforco_classificador: 'Raciocínio do classificador',
  esforco_leitura_documento: 'Raciocínio da leitura de documento', esforco_followup: 'Raciocínio do follow-up',
  assistente_modelo: 'Modelo do assistente do CRM', assistente_esforco: 'Raciocínio do assistente do CRM',
};

/** Mesmo critério do crm_config_salvar. Devolve a frase do problema ou null. */
export function validarConfig(chave: string, bruto: string): string | null {
  const v = bruto.trim();
  if (['janela_inicio', 'janela_fim', 'horario_humano_inicio', 'horario_humano_fim'].includes(chave) && !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(v)) return 'Use o formato HH:MM (ex.: 08:00).';
  if (['enviar_domingo', 'enviar_sabado', 'atende_sabado', 'delete_liberado'].includes(chave) && !['true', 'false'].includes(v)) return 'Escolha sim ou não.';
  if (chave.startsWith('esforco_') && !['minimal', 'low', 'medium', 'high'].includes(v)) return 'Escolha um dos níveis da lista.';
  if (chave === 'recontato_dias' && !/^[0-9]{1,3}$/.test(v)) return 'Use um número de dias (até 3 dígitos).';
  if (['turnos_retomar', 'turnos_avisar'].includes(chave) && !/^([3-9]|[1-3][0-9])$/.test(v)) return 'Use um número de 3 a 39.';
  if (['notificar_telefones', 'telefones_teste', 'telefones_internos'].includes(chave) && !/^[0-9 ,]*$/.test(v)) return 'Só números, separados por vírgula.';
  if (chave === 'nome_agente' && !/^[A-Za-zÀ-ÿ. ]{0,30}$/.test(v)) return 'Só letras, espaço e ponto (até 30).';
  if (['valor_minimo', 'valor_prioridade'].includes(chave) && !/^[0-9]{1,9}$/.test(v)) return 'Use só números, sem ponto nem vírgula (ex.: 10000).';
  if (chave === 'aviso_valor_alto' && !/^[0-9]{0,9}$/.test(v)) return 'Use só números, sem ponto nem vírgula, ou deixe vazio.';
  if (chave === 'feriados' && !/^([0-3][0-9]\/[01][0-9])?( *, *[0-3][0-9]\/[01][0-9])*$/.test(v)) return 'Use DD/MM separados por vírgula (ex.: 25/12, 01/01).';
  if (chave === 'prefixo_plantao' && v.length > 60) return 'No máximo 60 letras.';
  if (chave === 'assistente_teto_mensal' && !/^[0-9]{1,5}$/.test(v)) return 'Use só números (ex.: 60).';
  if (chave === 'assistente_limite_diario' && !/^([1-9]|[1-9][0-9]|[1-4][0-9][0-9])$/.test(v)) return 'Use um número de 1 a 499.';
  if (chave === 'cotacao_dolar' && !/^[1-9][0-9]?([.,][0-9]{1,4})?$/.test(v)) return 'Use um valor como 5.30.';
  if (chave === 'fuso' && !/^[A-Za-z_]+\/[A-Za-z_\/]+$/.test(v)) return 'Use um fuso como America/Sao_Paulo.';
  return null;
}

export const ESFORCOS: [string, string][] = [['minimal', 'Mínimo'], ['low', 'Baixo'], ['medium', 'Médio'], ['high', 'Alto']];
