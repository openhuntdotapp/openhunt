import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { GFExtractor } from '@/components/GFExtractor'
import './index.css'

const rootElement = document.getElementById('root')!
const viewType = rootElement.getAttribute('data-view')

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    {viewType === 'gf' ? <GFExtractor /> : <App />}
  </React.StrictMode>,
)
