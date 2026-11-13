import type { ReactNode } from 'react'
import './FormIntro.css'

/** Boas-vindas no topo de um cadastro novo (igual ao app): ícone, título e uma frase do que fazer. */
export function FormIntro({ icon, title, figure, children }: { icon: ReactNode; title: string; figure?: string; children: ReactNode }) {
  return <div className={`form-intro${figure ? ' with-figure' : ''}`}>
    {/* Ilustração sentada na borda de baixo das boas-vindas, com as pernas por cima do primeiro campo. */}
    {figure && <img className="form-intro-figure" src={figure} alt="" aria-hidden="true" />}
    <span className="form-intro-icon" aria-hidden="true">{icon}</span>
    <div><strong>{title}</strong><p>{children}</p></div>
  </div>
}
