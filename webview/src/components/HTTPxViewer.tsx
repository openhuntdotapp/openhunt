import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Search,
  FolderOpen,
  Copy,
  ExternalLink,
  X,
  ChevronLeft,
  ChevronRight,
  Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type JsonRecord = Record<string, unknown>

interface HTTPxViewerProps {
  data: JsonRecord[]
  filename?: string
  onOpenFile?: () => void
}

function formatKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (isNaN(date.getTime())) return value
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isTimestampKey(key: string): boolean {
  const k = key.toLowerCase()
  return k.includes('timestamp') || k.includes('time') || k.includes('date') || k === 'created_at' || k === 'updated_at'
}

function getStatusStyle(status: number) {
  if (status >= 200 && status < 300) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  if (status >= 300 && status < 400) return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
  if (status >= 400 && status < 500) return 'bg-orange-500/20 text-orange-300 border-orange-500/30'
  if (status >= 500) return 'bg-red-500/20 text-red-300 border-red-500/30'
  return 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30'
}

function getMainUrl(record: JsonRecord): string {
  const urlKey = Object.keys(record).find(k => 
    k.toLowerCase() === 'url' || k.toLowerCase() === 'host' || k.toLowerCase().includes('url')
  )
  if (urlKey) {
    const url = String(record[urlKey])
    return url.replace(/^https?:\/\//, '').split('/')[0]
  }
  return 'Unknown'
}

function getStatusCode(record: JsonRecord): number | null {
  const statusKey = Object.keys(record).find(k => 
    k.toLowerCase().includes('status') || k.toLowerCase() === 'code'
  )
  if (statusKey && typeof record[statusKey] === 'number') {
    return record[statusKey] as number
  }
  return null
}

function getTitle(record: JsonRecord): string {
  const titleKey = Object.keys(record).find(k => 
    k.toLowerCase() === 'title' || k.toLowerCase() === 'page_title'
  )
  if (titleKey && record[titleKey]) {
    return String(record[titleKey]).slice(0, 60)
  }
  return ''
}

export function HTTPxViewer({ data, filename, onOpenFile }: HTTPxViewerProps) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [selectedRecord, setSelectedRecord] = useState<JsonRecord | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const pageSize = 50

  const filteredData = useMemo(() => {
    if (!globalFilter) return data
    const lower = globalFilter.toLowerCase()
    return data.filter(record => 
      Object.values(record).some(value => 
        String(value).toLowerCase().includes(lower)
      )
    )
  }, [data, globalFilter])

  const paginatedData = useMemo(() => {
    const start = currentPage * pageSize
    return filteredData.slice(start, start + pageSize)
  }, [filteredData, currentPage, pageSize])

  const totalPages = Math.ceil(filteredData.length / pageSize)

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-6">
        <p className="text-muted-foreground text-sm">
          Open an HTTPx JSON file to view results
        </p>
        <Button 
          onClick={onOpenFile} 
          size="sm"
          className="gap-1.5 h-7 px-3 bg-white/10 hover:bg-white/15 text-white rounded border border-white/10 text-xs"
        >
          <FolderOpen className="h-3 w-3" />
          Open File
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      <div className={cn(
        "flex flex-col transition-all duration-300 ease-out",
        selectedRecord ? "w-[55%]" : "w-full"
      )}>
        <header className="flex-shrink-0 px-3 py-2 border-b border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {filename && (
                  <span className="text-xs text-muted-foreground">{filename}</span>
                )}
                <span className="text-xs text-emerald-400 font-medium">{filteredData.length.toLocaleString()} results</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={globalFilter}
                    onChange={(e) => { setGlobalFilter(e.target.value); setCurrentPage(0) }}
                    className="h-7 w-44 rounded border border-white/10 bg-white/5 pl-7 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder:text-muted-foreground/40"
                  />
                </div>

                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onOpenFile} 
                  className="gap-1.5 h-7 px-2 text-xs rounded border border-white/10 bg-white/5 hover:bg-white/10"
                >
                  <FolderOpen className="h-3 w-3" />
                  Open
                </Button>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto p-2">
            <div className="space-y-0.5">
              {paginatedData.map((record, index) => {
                const status = getStatusCode(record)
                const url = getMainUrl(record)
                const title = getTitle(record)
                const isSelected = selectedRecord === record

                return (
                  <div
                    key={index}
                    onClick={() => setSelectedRecord(isSelected ? null : record)}
                    className={cn(
                      "group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-all duration-150",
                      "border border-transparent hover:border-white/10 hover:bg-white/[0.03]",
                      isSelected && "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/10"
                    )}
                  >
                    {status && (
                      <div className={cn(
                        "flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold border",
                        getStatusStyle(status)
                      )}>
                        {status}
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Globe className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                        <span className="font-medium text-foreground/90 truncate text-xs">{url}</span>
                      </div>
                      {title && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate pl-4">{title}</p>
                      )}
                    </div>

                    <ChevronRight className={cn(
                      "h-3 w-3 text-muted-foreground/30 transition-transform",
                      isSelected && "rotate-180 text-emerald-400"
                    )} />
                  </div>
                )
              })}
            </div>
          </div>

          {totalPages > 1 && (
            <footer className="flex-shrink-0 px-3 py-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {currentPage * pageSize + 1} - {Math.min((currentPage + 1) * pageSize, filteredData.length)} of {filteredData.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 rounded border-white/10 bg-white/5 hover:bg-white/10"
                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <span className="text-[10px] text-muted-foreground px-1.5">
                    {currentPage + 1} / {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 rounded border-white/10 bg-white/5 hover:bg-white/10"
                    onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage >= totalPages - 1}
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </footer>
          )}
      </div>

<div className={cn(
            "flex flex-col border-l border-white/[0.08] bg-gradient-to-b from-[#0f0f0f] to-[#0a0a0a] transition-all duration-300 ease-out overflow-hidden",
            selectedRecord ? "w-[45%] opacity-100" : "w-0 opacity-0"
          )}>
            {selectedRecord && (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-black/20">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {getStatusCode(selectedRecord) && (
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[11px] font-semibold border",
                          getStatusStyle(getStatusCode(selectedRecord)!)
                        )}>
                          {getStatusCode(selectedRecord)}
                        </span>
                      )}
                      <span className="text-[11px] text-white/60 font-medium">
                        {getMainUrl(selectedRecord)}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80"
                    onClick={() => setSelectedRecord(null)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                
                <div className="flex-1 overflow-auto">
                  <div className="p-4 space-y-1">
                    {Object.entries(selectedRecord).map(([key, value]) => (
                      <div 
                        key={key} 
                        className="group flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-white/[0.03] transition-colors"
                      >
                        <div className="flex-shrink-0 w-28 pt-0.5">
                          <span className="text-[10px] font-medium text-white/35 uppercase tracking-wide">
                            {formatKey(key)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          {renderDetailValue(value, key)}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigator.clipboard.writeText(
                              typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
                            )
                          }}
                          className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-white/10 text-white/30 hover:text-white/60 transition-all"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex-shrink-0 p-3 border-t border-white/[0.06] bg-black/20">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      className="flex-1 h-8 gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-[11px] text-white/70 hover:text-white"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(selectedRecord, null, 2))
                      }}
                    >
                      <Copy className="h-3 w-3" />
                      Copy JSON
                    </Button>
                    {typeof selectedRecord.url === 'string' && selectedRecord.url && (
                      <Button
                        variant="ghost"
                        className="flex-1 h-8 gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-[11px] text-white/70 hover:text-white"
                        onClick={() => window.open(String(selectedRecord.url), '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open URL
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
    </div>
  )
}

function renderDetailValue(value: unknown, key: string): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-white/20 italic text-[11px]">—</span>
  }

  if (typeof value === 'boolean') {
    return (
      <span className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium",
        value ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
      )}>
        {value ? 'true' : 'false'}
      </span>
    )
  }

  if (typeof value === 'number') {
    if (key.toLowerCase().includes('status') || key.toLowerCase().includes('code')) {
      return (
        <span className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border",
          getStatusStyle(value)
        )}>
          {value}
        </span>
      )
    }
    return <span className="text-cyan-400 font-mono text-[11px]">{value.toLocaleString()}</span>
  }

  if (typeof value === 'string') {
    if (isTimestampKey(key) || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
      return (
        <span className="text-amber-400/90 text-[11px]">
          {formatTimestamp(value)}
        </span>
      )
    }
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1.5 text-[11px] break-all hover:underline"
        >
          <span className="break-all">{value}</span>
          <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-50" />
        </a>
      )
    }
    return <span className="text-white/80 text-[11px] break-all leading-relaxed">{value}</span>
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-white/20 text-[11px] italic">—</span>
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {value.map((item, i) => (
          <span
            key={i}
            className="px-2 py-0.5 bg-white/[0.06] rounded-md text-[11px] text-white/70 border border-white/[0.08]"
          >
            {String(item)}
          </span>
        ))}
      </div>
    )
  }

  if (typeof value === 'object') {
    return (
      <pre className="text-[10px] overflow-auto whitespace-pre-wrap font-mono text-white/70 p-2.5 rounded-lg bg-black/30 border border-white/[0.06] max-h-32">
        {JSON.stringify(value, null, 2)}
      </pre>
    )
  }

  return <span className="text-[11px] text-white/80">{String(value)}</span>
}
