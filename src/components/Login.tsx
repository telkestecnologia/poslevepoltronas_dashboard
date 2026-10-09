import { useState, type FormEvent } from 'react'
import { ArrowRight, CircleHelp, ShieldCheck, Sparkles } from 'lucide-react'
import { Brand } from './common'

export function Login({
  onLogin,
  busy,
  error,
  localBypass,
}: {
  onLogin: (email: string, password: string) => Promise<void>
  busy: boolean
  error: string
  localBypass: boolean
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    void onLogin(email.trim(), password)
  }

  return (
    <main className="login-layout">
      <section className="login-art" aria-label="Pós Leve">
        <div className="login-art-top">
          <Brand />
          <span>GESTÃO COM CUIDADO</span>
        </div>
        <div className="login-art-copy">
          <span className="eyebrow light">
            <Sparkles size={15} /> CUIDAR TAMBÉM É ORGANIZAR
          </span>
          <h1>
            Mais clareza para
            <br />
            cuidar de cada
            <br />
            <em>detalhe.</em>
          </h1>
          <p>As poltronas da Pós Leve em um só lugar.</p>
        </div>
        <img className="login-chair" src="/cadeira-metade.webp" alt="Poltrona elétrica Pós Leve" />
        <div className="login-art-bottom">Pós Leve • Conforto em cada etapa</div>
      </section>
      <section className="login-panel">
        <div className="login-mobile-brand">
          <Brand compact />
        </div>
        <div className="login-card">
          <div className="login-icon">
            <ShieldCheck size={26} strokeWidth={1.8} />
          </div>
          <span className="eyebrow">ÁREA RESTRITA</span>
          <h2>Bem-vindo de volta</h2>
          <p>
            {localBypass
              ? 'Acesse o painel no ambiente local sem informar e-mail ou senha.'
              : 'Acesse o painel para acompanhar a operação da Pós Leve.'}
          </p>
          <form onSubmit={submit} className="login-form">
            {!localBypass && (
              <>
                <label>
                  E-mail
                  <input
                    type="email"
                    autoComplete="username"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Senha
                  <input
                    type="password"
                    autoComplete="current-password"
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </label>
              </>
            )}
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button className="button primary login-submit" disabled={busy} type="submit">
              {busy ? 'Entrando...' : 'Entrar no painel'} <ArrowRight size={18} />
            </button>
          </form>
          <div className="login-help">
            <CircleHelp size={16} />{' '}
            {localBypass
              ? 'Acesso local de desenvolvimento.'
              : 'Acesso exclusivo à equipe autorizada.'}
          </div>
        </div>
        <small className="login-footnote">© {new Date().getFullYear()} Pós Leve Poltronas</small>
      </section>
    </main>
  )
}
