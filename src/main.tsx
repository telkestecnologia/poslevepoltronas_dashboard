import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import './styles-partner.css'
// Tema só do computador (a partir de 901px); o celular continua igual.
import './desktop-theme.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
