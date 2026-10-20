import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, LogOut, QrCode, RefreshCw, Smartphone, TriangleAlert, Hash } from 'lucide-react';
import { whatsappConexao } from '../lib/funcoes';
import { dataHora, tel } from '../lib/format';

type Estado = {
  // configurado/aviso: extensão da função da Talita (false = ainda sem instância ou sem o token no servidor)
  configurado?: boolean; aviso?: string | null;
  instancia: string; status: 'connected' | 'connecting' | 'disconnected' | 'nao_configurado' | string; conectado: boolean;
  qrcode: string | null; paircode: string | null; numero: string | null; perfil: string | null; business: boolean;
  ultima_queda: string | null; motivo_queda: string | null; em_uso: boolean;
  producao: { instancia: string; numero: string | null; status: string; status_desde: string } | null;
  historico?: { em: string; evento: string; numero: string | null; por: string | null }[];
};

const EVENTOS: Record<string, string> = {
  numero_conectado: 'Celular conectado', connected: 'Reconectado', disconnected: 'Caiu a conexão',
  desconectado_pelo_crm: 'Desconectado pelo CRM', instancia_trocada: 'Instância ativada no agente', desconhecido: 'Estado desconhecido',
};
const LIMITE_QR_MS = 3 * 60_000;   // depois disso o QR venceu: pede um novo

const numeroBonito = (n?: string | null) => (n ? `+55 ${tel(n)}` : '');

/** Aviso fixo: saudação e ausência automáticas respondem por cima da IA e confundem o lead. */
function AvisoAntes() {
  return (
    <div className="cartao flex gap-3 border-l-4 border-sol p-4 text-sm">
      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-sol-700" />
      <div>
        <div className="font-bold">Antes de conectar: desligue a saudação e a ausência automáticas do WhatsApp Business.</div>
        <div className="text-noite-600">No app: Ferramentas comerciais → Mensagem de saudação e Mensagem de ausência → desligar as duas. Senão elas respondem junto com a IA.</div>
      </div>
    </div>
  );
}

export default function WhatsAppConexao() {
  const qc = useQueryClient();
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState<'' | 'qr' | 'codigo' | 'sair'>('');
  const [modoCodigo, setModoCodigo] = useState(false);
  const [telefone, setTelefone] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const inicioQr = useRef<number | null>(null);
  const [vencido, setVencido] = useState(false);
  const acaoEm = useRef(0);   // logo depois de um clique, consulta mais rápido

  const { data: e, isLoading, error } = useQuery<Estado>({
    queryKey: ['whatsapp-conexao'],
    queryFn: () => whatsappConexao({ acao: 'status' }),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      if (s === 'connecting' && !vencido) return 3000;
      if (Date.now() - acaoEm.current < 15_000) return 2000;
      return 30_000;
    },
    refetchOnWindowFocus: true,
  });

  // controla o prazo do QR e avisa o resto do CRM quando conectar
  useEffect(() => {
    if (e?.status === 'connecting') {
      if (inicioQr.current == null) inicioQr.current = Date.now();
      const t = setInterval(() => setVencido(Date.now() - (inicioQr.current || 0) > LIMITE_QR_MS), 1000);
      return () => clearInterval(t);
    }
    inicioQr.current = null; setVencido(false);
    if (e?.status === 'connected') qc.invalidateQueries({ queryKey: ['status-agente'] });
  }, [e?.status, qc]);

  async function acao(corpo: Record<string, unknown>, qual: typeof ocupado) {
    setErro(''); setOcupado(qual); acaoEm.current = Date.now();
    try {
      const r = await whatsappConexao(corpo);
      qc.setQueryData(['whatsapp-conexao'], r);
      qc.invalidateQueries({ queryKey: ['status-agente'] });
      if (corpo.acao === 'conectar') { inicioQr.current = Date.now(); setVencido(false); }
    } catch (x: any) { setErro(x?.message || 'Não deu certo. Tente de novo.'); }
    finally { setOcupado(''); setConfirmar(false); }
  }

  if (isLoading) return <div className="max-w-3xl space-y-4"><AvisoAntes /><div className="cartao p-6 text-sm text-apagado">Consultando o WhatsApp…</div></div>;
  if (error || !e) return (
    <div className="max-w-3xl space-y-4">
      <AvisoAntes />
      <div className="cartao space-y-3 p-6 text-sm">
        <div className="flex items-center gap-2 font-bold text-alerta"><TriangleAlert className="h-4 w-4" />Não consegui consultar o WhatsApp.</div>
        <div className="text-apagado">{(error as Error)?.message}</div>
        <button className="btn-sec" onClick={() => qc.invalidateQueries({ queryKey: ['whatsapp-conexao'] })}><RefreshCw className="h-4 w-4" />Tentar de novo</button>
      </div>
    </div>
  );

  if (e.configurado === false) return (
    <div className="max-w-3xl space-y-4">
      <AvisoAntes />
      <div className="cartao space-y-3 p-5 text-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-papel text-apagado"><Smartphone className="h-6 w-6" /></span>
          <div className="min-w-0">
            <div className="text-[17px] font-bold">WhatsApp ainda não configurado</div>
            <div className="text-[13px] text-noite-600">{e.aviso || 'A equipe técnica ainda precisa criar a instância do WhatsApp no servidor.'}</div>
          </div>
        </div>
        <div className="text-[12px] text-apagado">Quando estiver pronto, esta tela mostra o botão para gerar o QR code. Não precisa fazer nada aqui por enquanto.</div>
        <button className="btn-sec" onClick={() => qc.invalidateQueries({ queryKey: ['whatsapp-conexao'] })}><RefreshCw className="h-4 w-4" />Consultar de novo</button>
      </div>
    </div>
  );

  const aguardando = e.status === 'connecting';

  return (
    <div className="max-w-3xl space-y-4">
      {!e.conectado && <AvisoAntes />}
      {!e.em_uso && (
        <div className="cartao flex gap-3 border-l-4 border-sol p-4 text-sm">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-sol-700" />
          <div>
            <div className="font-bold">Esta conexão ainda não está ativa no agente.</div>
            <div className="text-noite-600">
              O agente hoje atende pela instância <b>{e.producao?.instancia || '—'}</b>
              {e.producao?.numero ? <> ({numeroBonito(e.producao.numero)})</> : null}. Conectar um celular aqui não muda o atendimento até a ativação ser feita pela equipe técnica.
            </div>
          </div>
        </div>
      )}

      {/* Estado atual */}
      <div className="cartao p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`grid h-11 w-11 place-items-center rounded-full ${e.conectado ? 'bg-menta-100 text-menta-700' : aguardando ? 'bg-sol-100 text-sol-700' : 'bg-alerta-100 text-alerta'}`}>
            {e.conectado ? <CheckCircle2 className="h-6 w-6" /> : aguardando ? <QrCode className="h-6 w-6" /> : <Smartphone className="h-6 w-6" />}
          </span>
          <div className="mr-auto min-w-0">
            <div className="text-[17px] font-bold">
              {e.conectado ? 'WhatsApp conectado' : aguardando ? 'Aguardando a leitura no celular' : 'WhatsApp desconectado'}
            </div>
            <div className="text-[13px] text-noite-600">
              {e.conectado
                ? <>{numeroBonito(e.numero)}{e.perfil ? ` · ${e.perfil}` : ''}{e.business ? ' · WhatsApp Business' : ''}</>
                : aguardando ? 'O QR code muda sozinho a cada poucos segundos. Esta tela atualiza sozinha.'
                : e.em_uso ? 'Enquanto estiver assim, o agente não recebe nem envia mensagens.' : 'Nenhum celular conectado a esta instância.'}
            </div>
          </div>
          {e.conectado && !confirmar && (
            <button className="btn-perigo" onClick={() => setConfirmar(true)}><LogOut className="h-4 w-4" />Desconectar</button>
          )}
        </div>

        {e.conectado && confirmar && (
          <div className="mt-4 rounded-2xl bg-alerta-100 p-4 text-sm">
            <div className="font-bold text-alerta">Desconectar este celular?</div>
            <div className="mt-1 text-noite-700">
              {e.em_uso ? 'O agente para de responder até outro celular ser conectado aqui. ' : ''}
              Use só para trocar o número ou o aparelho.
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-perigo" disabled={!!ocupado} onClick={() => acao({ acao: 'desconectar' }, 'sair')}>
                {ocupado === 'sair' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}Sim, desconectar
              </button>
              <button className="btn-sec" onClick={() => setConfirmar(false)}>Cancelar</button>
            </div>
          </div>
        )}

        {/* Desconectado: escolher QR ou código */}
        {!e.conectado && !aguardando && (
          <div className="mt-5 space-y-4">
            {!modoCodigo ? (
              <div className="flex flex-wrap gap-2">
                <button className="btn-primario" disabled={!!ocupado} onClick={() => acao({ acao: 'conectar' }, 'qr')}>
                  {ocupado === 'qr' ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}Gerar QR code
                </button>
                <button className="btn-sec" onClick={() => setModoCodigo(true)}><Hash className="h-4 w-4" />Prefiro código de pareamento</button>
              </div>
            ) : (
              <form className="space-y-2" onSubmit={(ev) => { ev.preventDefault(); acao({ acao: 'conectar', telefone }, 'codigo'); }}>
                <label className="rotulo" htmlFor="tel-pareamento">Número do celular que vai ser conectado</label>
                <div className="flex flex-wrap gap-2">
                  <input id="tel-pareamento" className="campo max-w-xs" inputMode="tel" placeholder="(16) 99999-0000"
                    value={telefone} onChange={(ev) => setTelefone(ev.target.value)} />
                  <button className="btn-primario" disabled={!!ocupado || telefone.replace(/\D/g, '').length < 10}>
                    {ocupado === 'codigo' && <Loader2 className="h-4 w-4 animate-spin" />}Gerar código
                  </button>
                  <button type="button" className="btn-sec" onClick={() => setModoCodigo(false)}>Voltar ao QR</button>
                </div>
                <div className="text-[12px] text-apagado">Use o código quando estiver abrindo o CRM no próprio celular e não tiver como apontar a câmera para a tela.</div>
              </form>
            )}
            {e.ultima_queda && e.em_uso && (
              <div className="text-[12px] text-apagado">Última queda: {dataHora(e.ultima_queda)}{e.motivo_queda ? ` (${e.motivo_queda})` : ''}</div>
            )}
          </div>
        )}

        {/* Aguardando leitura */}
        {aguardando && (
          <div className="mt-5 grid gap-5 md:grid-cols-[auto,1fr]">
            <div className="grid place-items-center">
              {vencido ? (
                <div className="grid h-[264px] w-[264px] place-items-center rounded-2xl bg-papel p-6 text-center text-sm text-noite-600">
                  O código venceu.
                </div>
              ) : e.paircode ? (
                <div className="grid h-[264px] w-[264px] place-items-center rounded-2xl bg-white p-4 ring-1 ring-linha">
                  <div className="text-center">
                    <div className="rotulo">Código de pareamento</div>
                    <div className="mt-2 font-mono text-[34px] font-bold tracking-[0.12em]">{e.paircode}</div>
                  </div>
                </div>
              ) : e.qrcode ? (
                <img src={e.qrcode} alt="QR code para conectar o WhatsApp" className="h-[264px] w-[264px] rounded-2xl bg-white p-3 ring-1 ring-linha [image-rendering:pixelated]" />
              ) : (
                <div className="grid h-[264px] w-[264px] place-items-center rounded-2xl bg-papel"><Loader2 className="h-6 w-6 animate-spin text-apagado" /></div>
              )}
            </div>
            <div className="space-y-3 text-sm">
              <ol className="list-decimal space-y-1.5 pl-5 text-noite-700">
                <li>No celular, abra o <b>WhatsApp</b> (ou WhatsApp Business).</li>
                <li>Toque em <b>⋮</b> (Android) ou <b>Configurações</b> (iPhone) → <b>Dispositivos conectados</b>.</li>
                <li>Toque em <b>Conectar dispositivo</b>.</li>
                {e.paircode
                  ? <li>Escolha <b>Conectar com número de telefone</b> e digite o código ao lado.</li>
                  : <li>Aponte a câmera para o QR code ao lado.</li>}
              </ol>
              <div className="text-[12px] text-apagado">Quando ler, esta tela muda para "conectado" sozinha em poucos segundos.</div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button className="btn-sec" disabled={!!ocupado} onClick={() => (e.paircode && !telefone.trim()
                  ? acao({ acao: 'cancelar' }, 'sair').then(() => setModoCodigo(true))   // depois de recarregar: pede o número de novo
                  : acao(e.paircode ? { acao: 'conectar', telefone, novo: true } : { acao: 'conectar', novo: true }, e.paircode ? 'codigo' : 'qr'))}>
                  {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{e.paircode ? 'Gerar novo código' : 'Gerar novo QR'}
                </button>
                <button className="btn-sec" disabled={!!ocupado} onClick={() => acao({ acao: 'cancelar' }, 'sair')}>Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {erro && <div className="mt-4 rounded-xl bg-alerta-100 px-3 py-2 text-sm text-alerta">{erro}</div>}
      </div>

      {/* Histórico */}
      {!!e.historico?.length && (
        <div className="cartao p-5">
          <div className="rotulo">Histórico da conexão</div>
          <ul className="mt-2 divide-y divide-linha text-sm">
            {e.historico.map((h, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-3 py-2">
                <span className="w-28 shrink-0 text-[12px] text-apagado">{dataHora(h.em)}</span>
                <span className="font-semibold">{EVENTOS[h.evento] || h.evento}</span>
                {h.numero && <span className="text-noite-600">{numeroBonito(h.numero)}</span>}
                {h.por && h.por.includes('@') && <span className="text-[12px] text-apagado">por {h.por}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="px-1 text-[12px] leading-relaxed text-apagado">
        Use o número do WhatsApp Business do escritório. Tudo que chegar nele é respondido pela IA, menos os clientes atuais e os números da equipe cadastrados em Configurações.
        Quando a Dra. responde pelo celular, a IA pausa naquele contato.
      </div>
    </div>
  );
}
