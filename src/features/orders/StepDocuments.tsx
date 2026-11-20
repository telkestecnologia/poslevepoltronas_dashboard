import { useEffect, useState } from 'react'
import { Download, ExternalLink, FileSignature, Receipt } from 'lucide-react'
import { api, orderPdf, type Order } from '../../api'
import { currency, paymentMethodLabels } from '../../data/orders'
import './step-documents.css'

type Doc = { url: string; kind: 'pdf' | 'image'; name: string } | null

/**
 * Dentro da janela da etapa: "Pedido feito" mostra o contrato assinado em PDF (o aceito no site, na Isa ou pelo link;
 * no pedido manual, o arquivo anexado) e "Pagamento confirmado" mostra o comprovante do banco. Abre ao clicar.
 */
export function StepDocument({ credentials, order, kind }: { credentials: string; order: Order; kind: 'contract' | 'payment' }) {
  const [open, setOpen] = useState(false)
  const [doc, setDoc] = useState<Doc | undefined>(undefined)

  useEffect(() => {
    if (!open) return
    let active = true
    let created = ''
    void (async () => {
      const pdf = await orderPdf(credentials, order.id, kind === 'contract' ? 'contract.pdf' : 'pix/receipt.pdf')
      if (pdf) {
        created = URL.createObjectURL(pdf)
        if (active) setDoc({ url: created, kind: 'pdf', name: kind === 'contract' ? 'contrato.pdf' : 'comprovante.pdf' })
        return
      }
      if (kind === 'contract' && order.source === 'MANUAL') {
        const file = await api.orderContractFile(credentials, order.id).catch(() => null)
        if (file?.url && active) {
          setDoc({ url: file.url, kind: /\.(jpe?g|png)$/i.test(file.fileName) ? 'image' : 'pdf', name: file.fileName })
          return
        }
      }
      if (active) setDoc(null)
    })()
    return () => { active = false; if (created) URL.revokeObjectURL(created) }
  }, [open, credentials, order.id, order.source, kind])

  const manual = kind === 'payment' ? order.manualPayments ?? [] : []
  const Icon = kind === 'contract' ? FileSignature : Receipt
  if (!open) return <button type="button" className="button secondary sd-open" onClick={() => setOpen(true)}>
    <Icon size={16} /> {kind === 'contract' ? 'Ver o contrato assinado (PDF)' : 'Ver os comprovantes de pagamento'}</button>

  return <div className="sd">
    <div className="sd-head"><Icon size={16} /><strong>{kind === 'contract' ? 'Contrato assinado' : 'Comprovantes de pagamento'}</strong>
      <button type="button" className="sd-close" onClick={() => setOpen(false)}>Esconder</button></div>
    {doc === undefined && <p className="order-muted">Carregando...</p>}
    {doc && <>
      {doc.kind === 'pdf' ? <iframe className="sd-frame" src={doc.url} title={doc.name} />
        : <img className="sd-image" src={doc.url} alt={doc.name} />}
      <div className="sd-actions">
        <a className="button secondary" href={doc.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} /> Abrir em outra aba</a>
        <a className="button secondary" href={doc.url} download={doc.name}><Download size={15} /> Baixar</a>
      </div>
    </>}
    {doc === null && <p className="sd-empty">{kind === 'contract'
      ? 'Este pedido não tem contrato assinado guardado no sistema.'
      : manual.length ? 'Sem comprovante do banco: o pagamento foi registrado manualmente pela equipe.' : 'Ainda não há comprovante de pagamento do banco.'}</p>}
    {manual.length > 0 && <ul className="sd-manual">
      {manual.map(payment => <li key={payment.id}><b>{currency(payment.amountCents)}</b> • {paymentMethodLabels[payment.method]} •
        {' '}{new Date(`${payment.paidOn}T12:00:00`).toLocaleDateString('pt-BR')} <span className="finance-tag-manual">Pagamento registrado manualmente</span></li>)}
    </ul>}
  </div>
}
