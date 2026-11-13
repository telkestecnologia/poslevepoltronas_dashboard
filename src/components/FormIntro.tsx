import type { ReactNode } from 'react'
import './FormIntro.css'

/**
 * Boas-vindas no topo de um cadastro novo (igual ao app): ícone, título e uma frase do que fazer. Com `image`, vira
 * um banner com a foto ao fundo e o texto por cima (eyebrow e signature aparecem no banner).
 */
export function FormIntro({ icon, title, image, eyebrow, signature, portraits, children }: {
  icon: ReactNode; title: string; image?: string; eyebrow?: string; signature?: string; portraits?: string[]; children: ReactNode
}) {
  if (portraits) {
    // Retratos redondos lado a lado, um encaixado no outro, com o recado de boas-vindas embaixo (igual ao app).
    return <div className="form-welcome">
      <div className="form-welcome-portraits">{portraits.map(src => <img key={src} src={src} alt="" />)}</div>
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  }
  if (image) {
    return <div className="form-banner" style={{ backgroundImage: `url(${image})` }}>
      <div className="form-banner-body">
        {eyebrow && <span className="form-banner-eyebrow">{icon}{eyebrow}</span>}
        <strong>{title}</strong>
        <p>{children}</p>
        {signature && <small>{signature}</small>}
      </div>
    </div>
  }
  return <div className="form-intro">
    <span className="form-intro-icon" aria-hidden="true">{icon}</span>
    <div><strong>{title}</strong><p>{children}</p></div>
  </div>
}
