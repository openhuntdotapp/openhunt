import { useState, useEffect } from 'react'
import { HTTPxViewer } from '@/components/HTTPxViewer'
import { GFExtractor } from '@/components/GFExtractor'
import { JSEndpointExtractor } from '@/components/JSEndpointExtractor'
import { JSDownloader } from '@/components/JSDownloader'
import { vscode } from '@/lib/vscode'

type JsonRecord = Record<string, unknown>

function getViewType(): 'gf' | 'httpx' | 'jsextractor' | 'jsdownloader' {
  const root = document.getElementById('root')
  const view = root?.dataset.view
  if (view === 'gf') return 'gf'
  if (view === 'jsextractor') return 'jsextractor'
  if (view === 'jsdownloader') return 'jsdownloader'
  return 'httpx'
}

export default function App() {
  const [viewType] = useState(getViewType)
  const [data, setData] = useState<JsonRecord[]>([])
  const [filename, setFilename] = useState<string>('')

  useEffect(() => {
    if (viewType === 'httpx') {
      const handleMessage = (event: MessageEvent) => {
        const message = event.data
        if (message.command === 'data') {
          setData(message.data || [])
          setFilename(message.filename || '')
        }
      }

      window.addEventListener('message', handleMessage)

      if (vscode) {
        vscode.postMessage({ command: 'loadFile' })
      }

      return () => window.removeEventListener('message', handleMessage)
    }
  }, [viewType])

  const handleOpenFile = () => {
    if (vscode) {
      vscode.postMessage({ command: 'openFile' })
    }
  }

  if (viewType === 'gf') {
    return <GFExtractor />
  }

  if (viewType === 'jsextractor') {
    return <JSEndpointExtractor />
  }

  if (viewType === 'jsdownloader') {
    return <JSDownloader />
  }

  return <HTTPxViewer data={data} filename={filename} onOpenFile={handleOpenFile} />
}
