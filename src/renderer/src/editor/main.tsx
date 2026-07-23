import React from 'react'
import ReactDOM from 'react-dom/client'
import '@ds/tokens.css'
import { initI18n } from '../common/i18n'
import { App } from './App'

initI18n()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
