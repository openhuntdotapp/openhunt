import { useState, useEffect } from 'react'
import { HTTPxViewer } from '@/components/HTTPxViewer'
import { GFExtractor } from '@/components/GFExtractor'
import { vscode } from '@/lib/vscode'

type JsonRecord = Record<string, unknown>

function getViewType(): 'gf' | 'httpx' {
  const root = document.getElementById('root')
  return root?.dataset.view === 'gf' ? 'gf' : 'httpx'
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

  return <HTTPxViewer data={data} filename={filename} onOpenFile={handleOpenFile} />
}
