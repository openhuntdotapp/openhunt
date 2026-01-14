import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Download,
  FolderOpen,
  File,
  Play,
  Pause,
  Square,
  X,
  Check,
  AlertCircle,
  Link2,
  Zap,
  FileText,
  Copy,
  ExternalLink,
  Trash2,
  Upload,
  ChevronRight,
  Filter,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { vscode } from '@/lib/vscode'

interface DownloadResult {
  url: string
  success: boolean
  filename?: string
  size?: number
  error?: string
}

export function JSDownloader() {
  const [urls, setUrls] = useState<string[]>([])
  const [singleUrl, setSingleUrl] = useState('')
  const [outputDir, setOutputDir] = useState('')
  const [concurrency, setConcurrency] = useState(10)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  const [results, setResults] = useState<DownloadResult[]>([])
  const [loadedFile, setLoadedFile] = useState('')
  const [selectedResult, setSelectedResult] = useState<'success' | 'failed' | null>(null)
  const [copiedItem, setCopiedItem] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [leftPanelWidth, setLeftPanelWidth] = useState(200)
  const [centerPanelWidth, setCenterPanelWidth] = useState(320)
  const [extensions, setExtensions] = useState('.js')
  const isResizingLeft = useRef(false)
  const isResizingCenter = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      switch (message.command) {
        case 'outputDir':
          setOutputDir(message.path)
          break
        case 'urlsLoaded':
          setUrls(message.urls)
          setLoadedFile(message.filename)
          break
        case 'downloadStarted':
          setIsDownloading(true)
          setResults([])
          break
        case 'downloadProgress':
          setProgress({ completed: message.completed, total: message.total })
          setResults(prev => [...prev, message.result])
          break
        case 'downloadComplete':
          setIsDownloading(false)
          setIsPaused(false)
          break
        case 'downloadPaused':
          setIsPaused(true)
          break
        case 'downloadResumed':
          setIsPaused(false)
          break
        case 'downloadStopped':
          setIsDownloading(false)
          setIsPaused(false)
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isResizingLeft.current) {
      const newWidth = Math.max(150, Math.min(300, e.clientX))
      setLeftPanelWidth(newWidth)
    } else if (isResizingCenter.current) {
      const newWidth = Math.max(250, Math.min(500, e.clientX - leftPanelWidth))
      setCenterPanelWidth(newWidth)
    }
  }, [leftPanelWidth])

  const handleMouseUp = useCallback(() => {
    isResizingLeft.current = false
    isResizingCenter.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  const startResizeLeft = () => {
    isResizingLeft.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const startResizeCenter = () => {
    isResizingCenter.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const selectOutputDir = () => {
    vscode?.postMessage({ command: 'selectOutputDir' })
  }

  const selectTxtFile = () => {
    vscode?.postMessage({ command: 'selectTxtFile' })
  }

  const addSingleUrl = () => {
    const url = singleUrl.trim()
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      setUrls(prev => [...prev, url])
      setSingleUrl('')
    }
  }

  const parseTextareaUrls = () => {
    if (!textareaRef.current) return
    const text = textareaRef.current.value
    const newUrls = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && (line.startsWith('http://') || line.startsWith('https://')))
    if (newUrls.length > 0) {
      setUrls(prev => [...prev, ...newUrls])
      textareaRef.current.value = ''
    }
  }

  const removeUrl = (index: number) => {
    setUrls(prev => prev.filter((_, i) => i !== index))
  }

  const clearUrls = () => {
    setUrls([])
    setLoadedFile('')
    setResults([])
    setProgress({ completed: 0, total: 0 })
    setSelectedResult(null)
  }

  const getExtensionList = (): string[] => {
    return extensions
      .split(',')
      .map(ext => ext.trim().toLowerCase())
      .filter(ext => ext.length > 0)
      .map(ext => ext.startsWith('.') ? ext : `.${ext}`)
  }

  const filterUrlsByExtension = (urlList: string[]): string[] => {
    const extList = getExtensionList()
    if (extList.length === 0) return urlList
    return urlList.filter(url => {
      const urlPath = url.split('?')[0].toLowerCase()
      return extList.some(ext => urlPath.endsWith(ext))
    })
  }

  const filteredUrls = useMemo(() => filterUrlsByExtension(urls), [urls, extensions])

  const startDownload = () => {
    if (filteredUrls.length === 0) return
    if (!outputDir) {
      vscode?.postMessage({ command: 'selectOutputDir' })
      return
    }
    setProgress({ completed: 0, total: filteredUrls.length })
    vscode?.postMessage({
      command: 'startDownload',
      urls: filteredUrls,
      outputDir,
      concurrency
    })
  }

  const pauseDownload = () => {
    vscode?.postMessage({ command: 'pauseDownload' })
  }

  const resumeDownload = () => {
    vscode?.postMessage({ command: 'resumeDownload' })
  }

  const stopDownload = () => {
    vscode?.postMessage({ command: 'stopDownload' })
  }

  const openOutputDir = () => {
    if (outputDir) {
      vscode?.postMessage({ command: 'openOutputDir', path: outputDir })
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedItem(id)
    setTimeout(() => setCopiedItem(null), 2000)
  }

  const copyResults = () => {
    const successful = results.filter(r => r.success)
    const text = successful.map(r => r.filename).join('\n')
    copyToClipboard(text, 'all-success')
  }

  const copyFailedUrls = () => {
    const failed = results.filter(r => !r.success)
    const text = failed.map(r => r.url).join('\n')
    copyToClipboard(text, 'all-failed')
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy'
    }
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (file.name.endsWith('.txt')) {
        const reader = new FileReader()
        reader.onload = (event) => {
          const text = event.target?.result as string || ''
          const newUrls = text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && (line.startsWith('http://') || line.startsWith('https://')))
          if (newUrls.length > 0) {
            setUrls(prev => [...prev, ...newUrls])
            setLoadedFile(file.name)
          }
        }
        reader.readAsText(file)
      }
    }
  }

  useEffect(() => {
    const preventDefaults = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }
    
    document.addEventListener('dragover', preventDefaults)
    document.addEventListener('drop', preventDefaults)
    document.addEventListener('dragenter', preventDefaults)
    
    return () => {
      document.removeEventListener('dragover', preventDefaults)
      document.removeEventListener('drop', preventDefaults)
      document.removeEventListener('dragenter', preventDefaults)
    }
  }, [])

  const successResults = useMemo(() => results.filter(r => r.success), [results])
  const failedResults = useMemo(() => results.filter(r => !r.success), [results])

  const selectedItems = selectedResult === 'success' 
    ? successResults 
    : selectedResult === 'failed' 
      ? failedResults 
      : []

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      <div 
        className="flex flex-col border-r border-white/[0.08]"
        style={{ width: leftPanelWidth }}
      >
        <div className="flex-shrink-0 px-3 py-2.5 border-b border-white/[0.06] bg-black/20">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[11px] font-medium text-white/80">Settings</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Output Directory</label>
            <button
              onClick={selectOutputDir}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-all text-left",
                outputDir 
                  ? "bg-cyan-500/10 border-cyan-500/30 hover:bg-cyan-500/15" 
                  : "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06]"
              )}
            >
              <FolderOpen className={cn("h-3.5 w-3.5", outputDir ? "text-cyan-400" : "text-white/40")} />
              <span className={cn("text-[10px] truncate flex-1", outputDir ? "text-cyan-300" : "text-white/50")}>
                {outputDir || 'Select folder...'}
              </span>
              {outputDir && (
                <button 
                  onClick={(e) => { e.stopPropagation(); openOutputDir() }}
                  className="p-1 hover:bg-white/10 rounded"
                >
                  <ExternalLink className="h-3 w-3 text-cyan-400" />
                </button>
              )}
            </button>
          </div>

            <div className="space-y-2">
              <label className="text-[10px] text-white/40 uppercase tracking-wider">Concurrency</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={concurrency}
                  onChange={e => setConcurrency(Number(e.target.value))}
                  className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400"
                />
                <span className="text-[11px] font-mono text-cyan-400 w-6 text-right">{concurrency}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-white/40 uppercase tracking-wider">File Extensions</label>
              <div className="relative">
                <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/30" />
                <input
                  type="text"
                  value={extensions}
                  onChange={e => setExtensions(e.target.value)}
                  placeholder=".js, .jsx, .ts"
                  className="w-full h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] pl-8 pr-3 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500/50 placeholder:text-white/20"
                />
              </div>
              <p className="text-[9px] text-white/30">Comma-separated (e.g. .js, .jsx)</p>
            </div>

            <div className="pt-2 border-t border-white/[0.06] space-y-2">
              <label className="text-[10px] text-white/40 uppercase tracking-wider">URL Queue</label>
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[11px] text-white/60">{urls.length} URLs loaded</span>
                  {urls.length > 0 && filteredUrls.length !== urls.length && (
                    <span className="text-[10px] text-cyan-400">{filteredUrls.length} matching filter</span>
                  )}
                </div>
                {urls.length > 0 && (
                  <button
                    onClick={clearUrls}
                    className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear
                  </button>
                )}
              </div>
              {loadedFile && (
                <div className="flex items-center gap-1.5 text-[10px] text-cyan-400">
                  <FileText className="h-3 w-3" />
                  <span className="truncate">{loadedFile}</span>
                </div>
              )}
            </div>

            {filteredUrls.length > 0 && !isDownloading && (
              <button
                onClick={startDownload}
                disabled={!outputDir}
                className="w-full h-9 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-white/10 disabled:text-white/30 text-[11px] font-medium text-black transition-colors flex items-center justify-center gap-2"
              >
                <Play className="h-3.5 w-3.5" />
                Download {filteredUrls.length} files
              </button>
            )}

            {isDownloading && (
              <div className="space-y-2">
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-300",
                      isPaused 
                        ? "bg-gradient-to-r from-yellow-600 to-yellow-400" 
                        : "bg-gradient-to-r from-cyan-600 to-cyan-400"
                    )}
                    style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className={cn("text-white/40", isPaused && "text-yellow-400")}>
                    {isPaused ? 'Paused' : 'Downloading'}
                  </span>
                  <span className="text-cyan-400">{progress.completed}/{progress.total}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isPaused ? (
                    <button
                      onClick={resumeDownload}
                      className="flex-1 h-8 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-[10px] font-medium text-black transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Play className="h-3 w-3" />
                      Continue
                    </button>
                  ) : (
                    <button
                      onClick={pauseDownload}
                      className="flex-1 h-8 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-[10px] font-medium text-yellow-400 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Pause className="h-3 w-3" />
                      Pause
                    </button>
                  )}
                  <button
                    onClick={stopDownload}
                    className="h-8 w-8 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 transition-colors flex items-center justify-center"
                  >
                    <Square className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
        </div>
      </div>

      <div 
        className="w-1 cursor-col-resize hover:bg-cyan-500/30 active:bg-cyan-500/50 transition-colors flex-shrink-0"
        onMouseDown={startResizeLeft}
      />

      <div 
        className="flex flex-col border-r border-white/[0.08]"
        style={{ width: centerPanelWidth }}
      >
        {urls.length === 0 && results.length === 0 ? (
          <div 
            className={cn(
              "flex-1 flex flex-col items-center justify-center p-6 m-3 rounded-xl border-2 border-dashed transition-all",
              isDragOver 
                ? "border-cyan-500 bg-cyan-500/10" 
                : "border-white/10 hover:border-white/20"
            )}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors",
              isDragOver ? "bg-cyan-500/20" : "bg-white/5"
            )}>
              <Upload className={cn(
                "h-7 w-7 transition-colors",
                isDragOver ? "text-cyan-400" : "text-white/30"
              )} />
            </div>
            
            <p className="text-[13px] font-medium text-white/70 mb-1">
              {isDragOver ? 'Drop txt file here' : 'Drop URL list (.txt)'}
            </p>
            <p className="text-[11px] text-white/30 mb-5">
              or add URLs manually
            </p>
            
            <div className="w-full space-y-3">
              <button
                onClick={selectTxtFile}
                className="w-full h-8 px-4 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-[11px] text-white/70 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                <FileText className="h-3.5 w-3.5" />
                Load from .txt file
              </button>

              <div className="relative">
                <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/30" />
                <input
                  type="text"
                  value={singleUrl}
                  onChange={e => setSingleUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSingleUrl()}
                  placeholder="https://example.com/script.js"
                  className="w-full h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] pl-8 pr-16 text-[11px] focus:outline-none focus:ring-1 focus:ring-cyan-500/50 placeholder:text-white/20"
                />
                <button
                  onClick={addSingleUrl}
                  disabled={!singleUrl.trim()}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 px-2 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-[10px] text-cyan-400 disabled:opacity-50"
                >
                  Add
                </button>
              </div>

              <div className="space-y-2">
                <textarea
                  ref={textareaRef}
                  placeholder="Paste multiple URLs (one per line)..."
                  rows={4}
                  className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-[11px] placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 resize-none font-mono"
                />
                <button
                  onClick={parseTextareaUrls}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300"
                >
                  Parse and add URLs
                </button>
              </div>
            </div>
          </div>
        ) : results.length === 0 ? (
          <>
            <div className="flex-shrink-0 px-3 py-2.5 border-b border-white/[0.06] bg-black/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link2 className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="text-[11px] font-medium text-white/80">URL Queue</span>
                  <span className="text-[10px] text-cyan-400">{urls.length}</span>
                </div>
                <button
                  onClick={clearUrls}
                  className="h-6 w-6 rounded text-white/30 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-2 space-y-0.5">
                {urls.map((url, i) => (
                  <div
                    key={i}
                    className="group flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                  >
                    <span className="text-[10px] text-white/30 w-6 tabular-nums">{i + 1}.</span>
                    <span className="flex-1 text-[10px] text-white/60 font-mono truncate">{url}</span>
                    <button
                      onClick={() => removeUrl(i)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                    >
                      <X className="h-3 w-3 text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-shrink-0 p-3 border-t border-white/[0.06] space-y-2">
              <div className="relative">
                <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/30" />
                <input
                  type="text"
                  value={singleUrl}
                  onChange={e => setSingleUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSingleUrl()}
                  placeholder="Add more URLs..."
                  className="w-full h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] pl-8 pr-16 text-[11px] focus:outline-none focus:ring-1 focus:ring-cyan-500/50 placeholder:text-white/20"
                />
                <button
                  onClick={addSingleUrl}
                  disabled={!singleUrl.trim()}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 px-2 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-[10px] text-cyan-400 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex-shrink-0 px-3 py-2.5 border-b border-white/[0.06] bg-black/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-white/80">Results</span>
                  <span className="text-[10px] text-cyan-400">{results.length} files</span>
                </div>
                <button
                  onClick={clearUrls}
                  className="h-6 w-6 rounded text-white/30 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {isDownloading && (
                <div className="mt-2">
                  <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-300"
                      style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {successResults.length > 0 && (
                <div
                  onClick={() => setSelectedResult(selectedResult === 'success' ? null : 'success')}
                  className={cn(
                    "group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all",
                    "border border-transparent hover:border-white/[0.08] hover:bg-white/[0.03]",
                    selectedResult === 'success' && "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/10"
                  )}
                >
                  <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                  <span className="text-[11px] font-medium text-white/80 flex-1">Successful</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded tabular-nums",
                    selectedResult === 'success' ? "bg-emerald-500/20 text-emerald-400" : "bg-white/[0.06] text-white/50"
                  )}>
                    {successResults.length}
                  </span>
                  <ChevronRight className={cn(
                    "h-3 w-3 text-white/20 transition-transform",
                    selectedResult === 'success' && "rotate-90 text-emerald-400"
                  )} />
                </div>
              )}

              {failedResults.length > 0 && (
                <div
                  onClick={() => setSelectedResult(selectedResult === 'failed' ? null : 'failed')}
                  className={cn(
                    "group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all",
                    "border border-transparent hover:border-white/[0.08] hover:bg-white/[0.03]",
                    selectedResult === 'failed' && "bg-red-500/10 border-red-500/30 hover:bg-red-500/10"
                  )}
                >
                  <AlertCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                  <span className="text-[11px] font-medium text-white/80 flex-1">Failed</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded tabular-nums",
                    selectedResult === 'failed' ? "bg-red-500/20 text-red-400" : "bg-white/[0.06] text-white/50"
                  )}>
                    {failedResults.length}
                  </span>
                  <ChevronRight className={cn(
                    "h-3 w-3 text-white/20 transition-transform",
                    selectedResult === 'failed' && "rotate-90 text-red-400"
                  )} />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div 
        className="w-1 cursor-col-resize hover:bg-cyan-500/30 active:bg-cyan-500/50 transition-colors flex-shrink-0"
        onMouseDown={startResizeCenter}
      />

      <div className="flex-1 flex flex-col bg-gradient-to-b from-[#0f0f0f] to-[#0a0a0a]">
        {selectedResult && selectedItems.length > 0 ? (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-black/20">
              <div className="flex items-center gap-3">
                {selectedResult === 'success' ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-400" />
                )}
                <span className="text-[12px] font-medium text-white/80">
                  {selectedResult === 'success' ? 'Downloaded Files' : 'Failed Downloads'}
                </span>
                <span className={cn(
                  "text-[10px]",
                  selectedResult === 'success' ? "text-emerald-400" : "text-red-400"
                )}>
                  {selectedItems.length} items
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectedResult === 'success' ? copyResults : copyFailedUrls}
                  className="h-7 px-2.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 flex items-center justify-center gap-1.5 text-[10px]"
                >
                  {copiedItem === (selectedResult === 'success' ? 'all-success' : 'all-failed') ? (
                    <Check className="h-3 w-3 text-cyan-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  Copy all
                </button>
                <button
                  onClick={() => setSelectedResult(null)}
                  className="h-7 w-7 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 flex items-center justify-center"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-4">
              <div className="space-y-1">
                {selectedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="group flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-white/[0.03] transition-colors"
                  >
                    <File className={cn(
                      "h-3.5 w-3.5 mt-0.5 flex-shrink-0",
                      item.success ? "text-emerald-400" : "text-red-400"
                    )} />
                    <div className="flex-1 min-w-0">
                      {item.success ? (
                        <>
                          <code className="text-[11px] font-mono text-white/70 break-all block">{item.filename}</code>
                          {item.size && (
                            <div className="text-[9px] text-white/30 mt-1">
                              {(item.size / 1024).toFixed(1)} KB
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <code className="text-[11px] font-mono text-white/70 break-all block">{item.url}</code>
                          <div className="text-[9px] text-red-400/70 mt-1">{item.error}</div>
                        </>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        copyToClipboard(item.success ? (item.filename || '') : item.url, `item-${idx}`)
                      }}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-white/10 text-white/30 hover:text-white/60 transition-all"
                    >
                      {copiedItem === `item-${idx}` ? (
                        <Check className="h-3 w-3 text-cyan-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-white/30">
            <Download className="h-12 w-12 mb-3 text-white/10" />
            <p className="text-[12px] font-medium text-white/40">JS Downloader</p>
            <p className="text-[10px] text-white/20 mt-1">
              {results.length > 0 ? 'Select a category to view details' : 'Add URLs and start downloading'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
