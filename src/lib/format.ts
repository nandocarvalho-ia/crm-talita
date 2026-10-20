export const brl = (v?: number | null) =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function tel(t?: string | null) {
  const d = String(t || '').replace(/\D/g, '');
  const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : d;
}

export function relativo(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso); const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'agora';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  const hoje = new Date(); const ontem = new Date(); ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === hoje.toDateString()) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === ontem.toDateString()) return 'ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function dataHora(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function rotuloDia(iso: string) {
  const d = new Date(iso); const hoje = new Date(); const ontem = new Date(); ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === hoje.toDateString()) return 'Hoje';
  if (d.toDateString() === ontem.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export const primeiroNome = (n?: string | null) => (n || '').trim().split(/\s+/)[0] || '';

/** Valor digitado em reais → texto que o banco lê como número ("38.500" → "38500", "38.500,50" → "38500.50").
 *  Com vírgula, ela é a decimal e os pontos são milhar. Sem vírgula, pontos em grupos de 3 ("1.250.000") são milhar;
 *  qualquer outro texto vai como está ("22000.75") e o banco confere. */
export function dinheiroParaBanco(s: string) {
  const t = s.replace(/[R$\s]/g, '');
  if (t.includes(',')) return t.replace(/\./g, '').replace(',', '.');
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return t.replace(/\./g, '');
  return t;
}

/** Valor do banco → "38.500,00" (o mesmo formato que dinheiroParaBanco lê de volta). */
export function dinheiroParaTela(v: unknown) {
  if (v == null || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  const [int, dec] = Math.abs(n).toFixed(2).split('.');
  return (n < 0 ? '-' : '') + int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec;
}

/** Texto de um arquivo enviado: UTF-8 quando for válido; senão Windows-1252 (CSV salvo pelo Excel em português). */
export function textoDeArquivo(bytes: ArrayBuffer | Uint8Array) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return new TextDecoder('windows-1252').decode(bytes); }
}
