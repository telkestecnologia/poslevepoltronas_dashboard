import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import './password-input.css'

/** Campo de senha com o olhinho para mostrar ou esconder o que foi digitado. */
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return <span className="password-input">
    <input {...props} type={visible ? 'text' : 'password'} />
    <button type="button" className="password-input-eye" onClick={() => setVisible(value => !value)}
      aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={visible} title={visible ? 'Ocultar senha' : 'Mostrar senha'}>
      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  </span>
}
