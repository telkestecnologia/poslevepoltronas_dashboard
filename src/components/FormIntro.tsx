import type { ReactNode } from 'react'
import './FormIntro.css'

/** Boas-vindas no topo de um cadastro novo (igual ao app): ícone, título e uma frase do que fazer. */
export function FormIntro({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <div className="form-intro">
    <span className="form-intro-icon" aria-hidden="true">{icon}</span>
    <div><strong>{title}</strong><p>{children}</p></div>
  </div>
}
