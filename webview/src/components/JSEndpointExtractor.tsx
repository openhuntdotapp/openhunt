import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  Search,
  FolderOpen,
  Copy,
  Check,
  ChevronRight,
  Link2,
  Key,
  Globe,
  Database,
  Mail,
  X,
  Download,
  RefreshCw,
  File,
  Play,
  Upload,
  Code,
  Filter,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { vscode } from '@/lib/vscode'

interface ExtractionCategory {
  id: string
  name: string
  icon: typeof Link2
  color: string
  description: string
  patterns: RegExp[]
}

interface ExtractedItem {
  value: string
  category: string
  context?: string
}

interface WorkspaceFile {
  name: string
  path: string
  relativePath: string
}

const EXTRACTION_CATEGORIES: ExtractionCategory[] = [
  {
    id: 'endpoints',
    name: 'API Endpoints',
    icon: Link2,
    color: 'text-blue-400',
    description: 'REST API routes and paths',
    patterns: [
      /['"`]\/api\/[a-zA-Z0-9/_\-{}:?&=.]+['"`]/g,
      /['"`]\/v[0-9]+\/[a-zA-Z0-9/_\-{}:?&=.]+['"`]/g,
      /['"`]\/graphql['"`]/gi,
      /['"`]\/rest\/[a-zA-Z0-9/_\-{}:?&=.]+['"`]/g,
      /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /axios\.[a-z]+\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /\.get\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /\.post\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /\.put\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /\.delete\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /\.patch\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /['"`]\/[a-zA-Z0-9]+\/[a-zA-Z0-9/_\-{}:]+['"`]/g,
    ]
  },
  {
    id: 'urls',
    name: 'Full URLs',
    icon: Globe,
    color: 'text-emerald-400',
    description: 'Complete HTTP/HTTPS URLs',
    patterns: [
      /https?:\/\/[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}[^\s'"`<>)}\]\\]*/gi,
      /['"`](https?:\/\/[^'"`\s]+)['"`]/g,
    ]
  },
  {
    id: 'secrets',
    name: 'Potential Secrets',
    icon: Key,
    color: 'text-red-400',
    description: 'API keys, tokens, credentials',
    patterns: [
      /['"`](?:sk|pk|api|key|token|secret|password|auth|bearer|access)[_-]?[a-zA-Z0-9]{16,}['"`]/gi,
      /['"`]AKIA[0-9A-Z]{16}['"`]/g,
      /['"`]ghp_[a-zA-Z0-9]{36}['"`]/g,
      /['"`]gho_[a-zA-Z0-9]{36}['"`]/g,
      /['"`]ghu_[a-zA-Z0-9]{36}['"`]/g,
      /['"`]ghs_[a-zA-Z0-9]{36}['"`]/g,
      /['"`]ghr_[a-zA-Z0-9]{36}['"`]/g,
      /['"`]glpat-[a-zA-Z0-9\-_]{20,}['"`]/g,
      /['"`]xox[baprs]-[a-zA-Z0-9\-]+['"`]/g,
      /['"`]sk-[a-zA-Z0-9]{32,}['"`]/g,
      /['"`]AIza[0-9A-Za-z\-_]{35}['"`]/g,
      /['"`][0-9a-f]{32}['"`]/g,
      /['"`][A-Za-z0-9+/]{40,}={0,2}['"`]/g,
      /api[_-]?key\s*[:=]\s*['"`]([^'"`]+)['"`]/gi,
      /secret\s*[:=]\s*['"`]([^'"`]+)['"`]/gi,
      /password\s*[:=]\s*['"`]([^'"`]+)['"`]/gi,
      /token\s*[:=]\s*['"`]([^'"`]+)['"`]/gi,
    ]
  },
  {
    id: 'domains',
    name: 'Domains & Subdomains',
    icon: Database,
    color: 'text-purple-400',
    description: 'Domain names found in code',
    patterns: [
      /[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.(?:com|org|net|io|dev|app|co|ai|xyz|info|biz|us|uk|de|fr|jp|cn|ru|br|in|au|ca|nl|se|no|fi|dk|pl|es|it|ch|at|be|cz|hu|ro|bg|hr|sk|si|lt|lv|ee|ie|pt|gr|cy|mt|lu|is|li|mc|ad|sm|va|by|ua|kz|ge|am|az|md|kg|tj|tm|uz|mn|af|pk|bd|lk|np|bt|mv|mm|th|vn|la|kh|sg|my|id|ph|tw|hk|mo|kr|nz)/gi,
      /['"`]([a-z0-9]+(?:\.[a-z0-9]+)*\.[a-z]{2,})['"`]/gi,
    ]
  },
  {
    id: 'emails',
    name: 'Email Addresses',
    icon: Mail,
    color: 'text-amber-400',
    description: 'Email addresses in code',
    patterns: [
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    ]
  },
  {
    id: 'params',
    name: 'Query Parameters',
    icon: Filter,
    color: 'text-cyan-400',
    description: 'URL query parameters',
    patterns: [
      /[?&]([a-zA-Z_][a-zA-Z0-9_]*)=/g,
      /params\[['"`]([a-zA-Z_][a-zA-Z0-9_]*)['"`]\]/g,
      /query\.([a-zA-Z_][a-zA-Z0-9_]*)/g,
      /searchParams\.get\(['"`]([^'"`]+)['"`]\)/g,
      /getParam\(['"`]([^'"`]+)['"`]\)/g,
    ]
  },
]

function extractFromText(text: string, categories: ExtractionCategory[]): ExtractedItem[] {
  const results: ExtractedItem[] = []
  const seen = new Set<string>()

  for (const category of categories) {
    for (const pattern of category.patterns) {
      const regex = new RegExp(pattern.source, pattern.flags)
      let match

      while ((match = regex.exec(text)) !== null) {
        const value = match[1] || match[0]
        const cleaned = value.replace(/^['"`]|['"`]$/g, '').trim()
        
        if (cleaned.length < 3) continue
        if (cleaned.length > 500) continue
        
        const key = `${category.id}:${cleaned}`
        if (seen.has(key)) continue
        seen.add(key)

        const start = Math.max(0, match.index - 30)
        const end = Math.min(text.length, match.index + match[0].length + 30)
        const context = text.slice(start, end).replace(/\n/g, ' ').trim()

        results.push({
          value: cleaned,
          category: category.id,
          context: context !== cleaned ? context : undefined
        })
      }
    }
  }

  return results
}

export function JSEndpointExtractor() {
  const [inputText, setInputText] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(EXTRACTION_CATEGORIES.map(c => c.id))
  )
  const [copiedItem, setCopiedItem] = useState<string | null>(null)
  const [filename, setFilename] = useState<string | null>(null)
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([])
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [fileSearch, setFileSearch] = useState('')
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [selectedResultCategory, setSelectedResultCategory] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [leftPanelWidth, setLeftPanelWidth] = useState(200)
  const [centerPanelWidth, setCenterPanelWidth] = useState(320)
  const [urlInput, setUrlInput] = useState('')
  const [isFetchingUrl, setIsFetchingUrl] = useState(false)
  const isResizingLeft = useRef(false)
  const isResizingCenter = useRef(false)

  const results = useMemo(() => {
    if (!inputText.trim() || selectedCategories.size === 0) return []
    const selected = EXTRACTION_CATEGORIES.filter(c => selectedCategories.has(c.id))
    return extractFromText(inputText, selected)
  }, [inputText, selectedCategories])

  const resultsByCategory = useMemo(() => {
    const grouped: Record<string, ExtractedItem[]> = {}
    for (const item of results) {
      if (!grouped[item.category]) {
        grouped[item.category] = []
      }
      grouped[item.category].push(item)
    }
    return grouped
  }, [results])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      if (message.command === 'fileContent') {
        setInputText(message.data)
        setFilename(message.filename)
        setIsScanning(false)
      } else if (message.command === 'workspaceFiles') {
        setWorkspaceFiles(message.files || [])
        setLoadingFiles(false)
      } else if (message.command === 'multiFileContent') {
        setInputText(message.data)
        setFilename(`${message.fileCount} files`)
        setIsScanning(false)
      } else if (message.command === 'urlContent') {
        setInputText(message.data)
        setFilename(message.url)
        setIsFetchingUrl(false)
      } else if (message.command === 'urlError') {
        setIsFetchingUrl(false)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  useEffect(() => {
    refreshFiles()
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

  const refreshFiles = () => {
    setLoadingFiles(true)
    if (vscode) {
      vscode.postMessage({ command: 'listWorkspaceFiles' })
    }
  }

  const filteredFiles = useMemo(() => {
    if (!fileSearch.trim()) return workspaceFiles
    const search = fileSearch.toLowerCase()
    return workspaceFiles.filter(f => 
      f.name.toLowerCase().includes(search) || 
      f.relativePath.toLowerCase().includes(search)
    )
  }, [workspaceFiles, fileSearch])

  const toggleFileSelection = (path: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const selectAllFiles = () => {
    if (selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(filteredFiles.map(f => f.path)))
    }
  }

  const loadSelectedFiles = () => {
    if (vscode && selectedFiles.size > 0) {
      setIsScanning(true)
      vscode.postMessage({ 
        command: 'readMultipleFiles', 
        paths: Array.from(selectedFiles) 
      })
    }
  }

  const toggleCategory = (id: string) => {
    setSelectedCategories(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedItem(id)
    setTimeout(() => setCopiedItem(null), 2000)
  }

  const copyAllResults = () => {
    const allValues = results.map(r => r.value)
    const unique = [...new Set(allValues)]
    copyToClipboard(unique.join('\n'), 'all')
  }

  const copyCategoryResults = (categoryId: string) => {
    const items = resultsByCategory[categoryId] || []
    const unique = [...new Set(items.map(i => i.value))]
    copyToClipboard(unique.join('\n'), `cat-${categoryId}`)
  }

  const exportResults = () => {
    const output: Record<string, string[]> = {}
    for (const [cat, items] of Object.entries(resultsByCategory)) {
      output[cat] = [...new Set(items.map(i => i.value))]
    }
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'js-endpoints.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const openFile = () => {
    if (vscode) {
      vscode.postMessage({ command: 'openFile' })
    }
  }

  const fetchUrl = () => {
    if (!urlInput.trim()) return
    setIsFetchingUrl(true)
    if (vscode) {
      vscode.postMessage({ command: 'fetchUrl', url: urlInput.trim() })
    }
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
      const reader = new FileReader()
      reader.onload = (event) => {
        setInputText(event.target?.result as string || '')
        setFilename(file.name)
      }
      reader.readAsText(file)
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

  const allFilesSelected = filteredFiles.length > 0 && selectedFiles.size === filteredFiles.length
  const totalMatches = results.length

  const selectedCategoryData = selectedResultCategory 
    ? EXTRACTION_CATEGORIES.find(c => c.id === selectedResultCategory)
    : null

  const selectedCategoryItems = selectedResultCategory
    ? resultsByCategory[selectedResultCategory] || []
    : []

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      <div 
        className="flex flex-col border-r border-white/[0.08]"
        style={{ width: leftPanelWidth }}
      >
        <div className="flex-shrink-0 px-3 py-2.5 border-b border-white/[0.06] bg-black/20">
          <div className="flex items-center gap-2">
            <Code className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-[11px] font-medium text-white/80">Categories</span>
            <span className="text-[10px] text-blue-400 ml-auto">{selectedCategories.size}</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {EXTRACTION_CATEGORIES.map(category => {
            const Icon = category.icon
            const isSelected = selectedCategories.has(category.id)
            
            return (
              <div
                key={category.id}
                onClick={() => toggleCategory(category.id)}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all",
                  isSelected 
                    ? "bg-white/[0.06] border border-white/[0.1]" 
                    : "hover:bg-white/[0.03] border border-transparent"
                )}
              >
                <button
                  className={cn(
                    "w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors flex-shrink-0",
                    isSelected 
                      ? "bg-blue-500 border-blue-500" 
                      : "border-white/20 hover:border-white/40"
                  )}
                >
                  {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                </button>
                
                <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", category.color)} />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-white/70 block truncate">{category.name}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div 
        className="w-1 cursor-col-resize hover:bg-blue-500/30 active:bg-blue-500/50 transition-colors flex-shrink-0"
        onMouseDown={startResizeLeft}
      />

      <div 
        className="flex flex-col border-r border-white/[0.08]"
        style={{ width: centerPanelWidth }}
      >
        {!filename && !inputText ? (
          <div 
            className={cn(
              "flex-1 flex flex-col items-center justify-center p-6 m-3 rounded-xl border-2 border-dashed transition-all",
              isDragOver 
                ? "border-blue-500 bg-blue-500/10" 
                : "border-white/10 hover:border-white/20"
            )}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors",
              isDragOver ? "bg-blue-500/20" : "bg-white/5"
            )}>
              <Upload className={cn(
                "h-7 w-7 transition-colors",
                isDragOver ? "text-blue-400" : "text-white/30"
              )} />
            </div>
            
            <p className="text-[13px] font-medium text-white/70 mb-1">
              {isDragOver ? 'Drop file here' : 'Drop JS files to analyze'}
            </p>
            <p className="text-[11px] text-white/30 mb-5">
              or enter URL / browse workspace
            </p>

            <div className="w-full mb-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/30" />
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchUrl()}
                    placeholder="https://example.com/bundle.js"
                    className="w-full h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] pl-8 pr-3 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500/50 placeholder:text-white/20"
                  />
                </div>
                <button
                  onClick={fetchUrl}
                  disabled={isFetchingUrl || !urlInput.trim()}
                  className="h-8 px-3 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-[10px] text-blue-400 hover:text-blue-300 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isFetchingUrl ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <Zap className="h-3 w-3" />
                  )}
                  Fetch
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={openFile}
                className="h-8 px-4 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-[11px] text-white/70 hover:text-white transition-all flex items-center gap-2"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Browse Files
              </button>
              <button
                onClick={refreshFiles}
                className="h-8 w-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/50 hover:text-white transition-all flex items-center justify-center"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loadingFiles && "animate-spin")} />
              </button>
            </div>
            
            {workspaceFiles.length > 0 && (
              <div className="w-full mt-5 pt-5 border-t border-white/[0.06]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-white/40 uppercase tracking-wider">JS Files</span>
                  <button 
                    onClick={selectAllFiles}
                    className="text-[10px] text-blue-400 hover:text-blue-300"
                  >
                    {allFilesSelected ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                
                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/30" />
                  <input
                    type="text"
                    value={fileSearch}
                    onChange={(e) => setFileSearch(e.target.value)}
                    placeholder="Search files..."
                    className="w-full h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] pl-8 pr-3 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500/50 placeholder:text-white/20"
                  />
                </div>
                
                <div className="max-h-48 overflow-y-auto space-y-0.5 rounded-lg border border-white/[0.06] bg-black/20">
                  {filteredFiles.map((file) => {
                    const isSelected = selectedFiles.has(file.path)
                    return (
                      <div
                        key={file.path}
                        onClick={() => toggleFileSelection(file.path)}
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-2 cursor-pointer transition-colors",
                          isSelected 
                            ? "bg-blue-500/10 hover:bg-blue-500/15" 
                            : "hover:bg-white/[0.03]"
                        )}
                      >
                        <File className={cn(
                          "h-3.5 w-3.5 flex-shrink-0",
                          isSelected ? "text-blue-400" : "text-white/30"
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className={cn(
                            "text-[11px] truncate",
                            isSelected ? "text-blue-300" : "text-white/60"
                          )}>
                            {file.name}
                          </div>
                          <div className="text-[9px] text-white/25 truncate">{file.relativePath}</div>
                        </div>
                        {isSelected && <Check className="h-3 w-3 text-blue-400 flex-shrink-0" />}
                      </div>
                    )
                  })}
                </div>
                
                {selectedFiles.size > 0 && (
                  <button
                    onClick={loadSelectedFiles}
                    disabled={isScanning}
                    className="w-full mt-3 h-9 rounded-lg bg-blue-500 hover:bg-blue-400 text-[11px] font-medium text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isScanning ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Scanning...
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" />
                        Analyze {selectedFiles.size} file{selectedFiles.size > 1 ? 's' : ''}
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex-shrink-0 px-3 py-2.5 border-b border-white/[0.06] bg-black/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-white/80">Results</span>
                  {totalMatches > 0 && (
                    <span className="text-[10px] text-blue-400">{totalMatches} found</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {results.length > 0 && (
                    <>
                      <button
                        onClick={copyAllResults}
                        className="h-6 px-2 rounded text-[10px] text-white/50 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1"
                      >
                        {copiedItem === 'all' ? <Check className="h-3 w-3 text-blue-400" /> : <Copy className="h-3 w-3" />}
                      </button>
                      <button
                        onClick={exportResults}
                        className="h-6 px-2 rounded text-[10px] text-white/50 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1"
                      >
                        <Download className="h-3 w-3" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => { 
                      setFilename(null)
                      setInputText('')
                      setSelectedFiles(new Set())
                      setSelectedResultCategory(null)
                      setUrlInput('')
                    }}
                    className="h-6 w-6 rounded text-white/30 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {filename && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Code className="h-3 w-3 text-white/30" />
                  <span className="text-[10px] text-white/40 truncate">{filename}</span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {Object.keys(resultsByCategory).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-6">
                  <Search className="h-8 w-8 text-white/20 mb-3" />
                  <p className="text-[11px] text-white/40">No endpoints found</p>
                </div>
              ) : (
                <div className="p-2 space-y-0.5">
                  {Object.entries(resultsByCategory).map(([categoryId, items]) => {
                    const category = EXTRACTION_CATEGORIES.find(c => c.id === categoryId)
                    if (!category) return null
                    const Icon = category.icon
                    const isSelected = selectedResultCategory === categoryId
                    
                    return (
                      <div
                        key={categoryId}
                        onClick={() => setSelectedResultCategory(isSelected ? null : categoryId)}
                        className={cn(
                          "group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all",
                          "border border-transparent hover:border-white/[0.08] hover:bg-white/[0.03]",
                          isSelected && "bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/10"
                        )}
                      >
                        <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", category.color)} />
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] font-medium text-white/80 truncate block">{category.name}</span>
                        </div>
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded tabular-nums",
                          isSelected ? "bg-blue-500/20 text-blue-400" : "bg-white/[0.06] text-white/50"
                        )}>
                          {items.length}
                        </span>
                        <ChevronRight className={cn(
                          "h-3 w-3 text-white/20 transition-transform",
                          isSelected && "rotate-90 text-blue-400"
                        )} />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div 
        className="w-1 cursor-col-resize hover:bg-blue-500/30 active:bg-blue-500/50 transition-colors flex-shrink-0"
        onMouseDown={startResizeCenter}
      />

      <div className="flex-1 flex flex-col bg-gradient-to-b from-[#0f0f0f] to-[#0a0a0a]">
        {selectedCategoryData && selectedCategoryItems.length > 0 ? (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-black/20">
              <div className="flex items-center gap-3">
                {(() => {
                  const Icon = selectedCategoryData.icon
                  return <Icon className={cn("h-4 w-4", selectedCategoryData.color)} />
                })()}
                <span className="text-[12px] font-medium text-white/80">{selectedCategoryData.name}</span>
                <span className="text-[10px] text-blue-400">
                  {selectedCategoryItems.length} items
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyCategoryResults(selectedCategoryData.id)}
                  className="h-7 px-2.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 flex items-center justify-center gap-1.5 text-[10px]"
                >
                  {copiedItem === `cat-${selectedCategoryData.id}` ? (
                    <Check className="h-3 w-3 text-blue-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  Copy all
                </button>
                <button
                  onClick={() => setSelectedResultCategory(null)}
                  className="h-7 w-7 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 flex items-center justify-center"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-4">
              <div className="space-y-1">
                {selectedCategoryItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="group flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <code className="text-[11px] font-mono text-white/70 break-all block">{item.value}</code>
                      {item.context && (
                        <div className="text-[9px] text-white/30 mt-1 truncate font-mono">
                          ...{item.context}...
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        copyToClipboard(item.value, `item-${idx}`)
                      }}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-white/10 text-white/30 hover:text-white/60 transition-all"
                    >
                      {copiedItem === `item-${idx}` ? (
                        <Check className="h-3 w-3 text-blue-400" />
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
            <Zap className="h-12 w-12 mb-3 text-white/10" />
            <p className="text-[12px] font-medium text-white/40">JS Endpoint Extractor</p>
            <p className="text-[10px] text-white/20 mt-1">Select a category to view extracted data</p>
          </div>
        )}
      </div>
    </div>
  )
}
