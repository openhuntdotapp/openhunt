import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  Search,
  FolderOpen,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Shield,
  Key,
  Bug,
  Sparkles,
  X,
  Download,
  RefreshCw,
  File,
  Play,
  Upload,
  Crosshair,
  Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'

import { vscode } from '@/lib/vscode'
import patternsData from '../patterns.json'

interface GFPattern {
  name: string
  description: string
  category: 'vulnerability' | 'secrets' | 'debug' | 'interesting'
  patterns: string[]
}

interface MatchResult {
  patternName: string
  category: string
  matches: { pattern: string; matches: string[] }[]
}

interface WorkspaceFile {
  name: string
  path: string
  relativePath: string
}

const CATEGORY_CONFIG: Record<string, { icon: typeof Shield; label: string; color: string }> = {
  vulnerability: { icon: Shield, label: 'Vulnerabilities', color: 'text-red-400' },
  secrets: { icon: Key, label: 'Secrets', color: 'text-amber-400' },
  debug: { icon: Bug, label: 'Debug', color: 'text-purple-400' },
  interesting: { icon: Sparkles, label: 'Interesting', color: 'text-cyan-400' },
}

const GF_PATTERNS: GFPattern[] = (patternsData as { patterns: GFPattern[] }).patterns

function findMatches(text: string, patterns: string[]): { pattern: string; matches: string[] }[] {
  const results: { pattern: string; matches: string[] }[] = []
  
  for (const pattern of patterns) {
    try {
      const isRegex = pattern.includes('[') || pattern.includes('(') || 
                     pattern.includes('*') || pattern.includes('+') ||
                     pattern.includes('\\')
      
      let matches: string[] = []
      
      if (isRegex) {
        const regex = new RegExp(pattern, 'gi')
        const found = text.match(regex)
        if (found) {
          matches = [...new Set(found)]
        }
      } else {
        const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(`[?&]?${escapedPattern}[^&\\s"'<>]*`, 'gi')
        const found = text.match(regex)
        if (found) {
          matches = [...new Set(found.map(m => m.replace(/^[?&]/, '')))]
        }
      }
      
      if (matches.length > 0) {
        results.push({ pattern, matches })
      }
    } catch {
      continue
    }
  }
  
  return results
}

function extractAllMatches(text: string, selectedPatterns: GFPattern[]): MatchResult[] {
  return selectedPatterns
    .map(p => ({
      patternName: p.name,
      category: p.category,
      matches: findMatches(text, p.patterns)
    }))
    .filter(r => r.matches.length > 0)
}

export function GFExtractor() {
  const [inputText, setInputText] = useState('')
  const [selectedPatterns, setSelectedPatterns] = useState<Set<string>>(new Set(GF_PATTERNS.map(p => p.name)))
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(Object.keys(CATEGORY_CONFIG)))
  const [copiedItem, setCopiedItem] = useState<string | null>(null)
  const [filename, setFilename] = useState<string | null>(null)
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([])
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [fileSearch, setFileSearch] = useState('')
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [selectedResult, setSelectedResult] = useState<MatchResult | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [leftPanelWidth, setLeftPanelWidth] = useState(200)
  const [centerPanelWidth, setCenterPanelWidth] = useState(320)
  const isResizingLeft = useRef(false)
  const isResizingCenter = useRef(false)

  const results = useMemo(() => {
    if (!inputText.trim() || selectedPatterns.size === 0) return []
    const selected = GF_PATTERNS.filter(p => selectedPatterns.has(p.name))
    const extractedResults = extractAllMatches(inputText, selected)
    return extractedResults
  }, [inputText, selectedPatterns])

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

  const patternsByCategory = useMemo(() => {
    const grouped: Record<string, GFPattern[]> = {}
    for (const pattern of GF_PATTERNS) {
      if (!grouped[pattern.category]) {
        grouped[pattern.category] = []
      }
      grouped[pattern.category].push(pattern)
    }
    return grouped
  }, [])

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const togglePattern = (name: string) => {
    setSelectedPatterns(prev => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  const toggleCategoryPatterns = (category: string) => {
    const patterns = patternsByCategory[category] || []
    const allSelected = patterns.every(p => selectedPatterns.has(p.name))
    setSelectedPatterns(prev => {
      const next = new Set(prev)
      if (allSelected) {
        patterns.forEach(p => next.delete(p.name))
      } else {
        patterns.forEach(p => next.add(p.name))
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
    const allMatches = results.flatMap(r => 
      r.matches.flatMap(m => m.matches)
    )
    const uniqueMatches = [...new Set(allMatches)]
    copyToClipboard(uniqueMatches.join('\n'), 'all')
  }

  const exportResults = () => {
    const allMatches = results.flatMap(r => 
      r.matches.flatMap(m => m.matches)
    )
    const uniqueMatches = [...new Set(allMatches)]
    const blob = new Blob([uniqueMatches.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'extracted-patterns.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalMatches = useMemo(() => {
    return results.reduce((acc, r) => acc + r.matches.reduce((a, m) => a + m.matches.length, 0), 0)
  }, [results])

  const openFile = () => {
    if (vscode) {
      vscode.postMessage({ command: 'openFile' })
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

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      <div 
        className="flex flex-col border-r border-white/[0.08]"
        style={{ width: leftPanelWidth }}
      >
        <div className="flex-shrink-0 px-3 py-2.5 border-b border-white/[0.06] bg-black/20">
          <div className="flex items-center gap-2">
            <Crosshair className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[11px] font-medium text-white/80">Patterns</span>
            <span className="text-[10px] text-emerald-400 ml-auto">{selectedPatterns.size}</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {Object.entries(CATEGORY_CONFIG).map(([category, config]) => {
            const Icon = config.icon
            const patterns = patternsByCategory[category] || []
            const selectedCount = patterns.filter(p => selectedPatterns.has(p.name)).length
            const isExpanded = expandedCategories.has(category)
            const allSelected = patterns.length > 0 && selectedCount === patterns.length
            
            return (
              <div key={category} className="border-b border-white/[0.04]">
                <div 
                  className="flex items-center gap-2 px-3 py-2 hover:bg-white/[0.03] cursor-pointer group"
                  onClick={() => toggleCategory(category)}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleCategoryPatterns(category) }}
                    className={cn(
                      "w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors",
                      allSelected 
                        ? "bg-emerald-500 border-emerald-500" 
                        : selectedCount > 0 
                          ? "border-emerald-500/50 bg-emerald-500/20"
                          : "border-white/20 hover:border-white/40"
                    )}
                  >
                    {allSelected && <Check className="h-2.5 w-2.5 text-black" />}
                    {!allSelected && selectedCount > 0 && <div className="w-1.5 h-0.5 bg-emerald-500" />}
                  </button>
                  
                  <Icon className={cn("h-3.5 w-3.5", config.color)} />
                  <span className="text-[11px] text-white/60 flex-1">{config.label}</span>
                  <span className="text-[9px] text-white/30 tabular-nums">{selectedCount}/{patterns.length}</span>
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 text-white/30" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-white/30" />
                  )}
                </div>
                
                {isExpanded && (
                  <div className="pb-1 bg-black/20">
                    {patterns.map(pattern => (
                      <label
                        key={pattern.name}
                        className="flex items-center gap-2 px-3 pl-9 py-1.5 hover:bg-white/[0.03] cursor-pointer"
                      >
                        <button
                          onClick={() => togglePattern(pattern.name)}
                          className={cn(
                            "w-3 h-3 rounded border flex items-center justify-center transition-colors",
                            selectedPatterns.has(pattern.name)
                              ? "bg-emerald-500 border-emerald-500"
                              : "border-white/20 hover:border-white/40"
                          )}
                        >
                          {selectedPatterns.has(pattern.name) && <Check className="h-2 w-2 text-black" />}
                        </button>
                        <span className="text-[10px] text-white/50">{pattern.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div 
        className="w-1 cursor-col-resize hover:bg-emerald-500/30 active:bg-emerald-500/50 transition-colors flex-shrink-0"
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
                ? "border-emerald-500 bg-emerald-500/10" 
                : "border-white/10 hover:border-white/20"
            )}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors",
              isDragOver ? "bg-emerald-500/20" : "bg-white/5"
            )}>
              <Upload className={cn(
                "h-7 w-7 transition-colors",
                isDragOver ? "text-emerald-400" : "text-white/30"
              )} />
            </div>
            
            <p className="text-[13px] font-medium text-white/70 mb-1">
              {isDragOver ? 'Drop file here' : 'Drop files to scan'}
            </p>
            <p className="text-[11px] text-white/30 mb-5">
              or choose from workspace
            </p>
            
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
                  <span className="text-[10px] text-white/40 uppercase tracking-wider">Workspace Files</span>
                  <button 
                    onClick={selectAllFiles}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300"
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
                    className="w-full h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] pl-8 pr-3 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500/50 placeholder:text-white/20"
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
                            ? "bg-emerald-500/10 hover:bg-emerald-500/15" 
                            : "hover:bg-white/[0.03]"
                        )}
                      >
                        <File className={cn(
                          "h-3.5 w-3.5 flex-shrink-0",
                          isSelected ? "text-emerald-400" : "text-white/30"
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className={cn(
                            "text-[11px] truncate",
                            isSelected ? "text-emerald-300" : "text-white/60"
                          )}>
                            {file.name}
                          </div>
                          <div className="text-[9px] text-white/25 truncate">{file.relativePath}</div>
                        </div>
                        {isSelected && <Check className="h-3 w-3 text-emerald-400 flex-shrink-0" />}
                      </div>
                    )
                  })}
                </div>
                
                {selectedFiles.size > 0 && (
                  <button
                    onClick={loadSelectedFiles}
                    disabled={isScanning}
                    className="w-full mt-3 h-9 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[11px] font-medium text-black transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isScanning ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Scanning...
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" />
                        Scan {selectedFiles.size} file{selectedFiles.size > 1 ? 's' : ''}
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
                    <span className="text-[10px] text-emerald-400">{totalMatches} matches</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {results.length > 0 && (
                    <>
                      <button
                        onClick={copyAllResults}
                        className="h-6 px-2 rounded text-[10px] text-white/50 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1"
                      >
                        {copiedItem === 'all' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
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
                    onClick={() => { setFilename(null); setInputText(''); setSelectedFiles(new Set()); setSelectedResult(null); }}
                    className="h-6 w-6 rounded text-white/30 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {filename && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Globe className="h-3 w-3 text-white/30" />
                  <span className="text-[10px] text-white/40">{filename}</span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {results.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-6">
                  <Search className="h-8 w-8 text-white/20 mb-3" />
                  <p className="text-[11px] text-white/40">No patterns found</p>
                </div>
              ) : (
                <div className="p-2 space-y-0.5">
                  {results.map((result) => {
                    const config = CATEGORY_CONFIG[result.category]
                    const Icon = config?.icon || Shield
                    const allMatches = result.matches.flatMap(m => m.matches)
                    const isSelected = selectedResult?.patternName === result.patternName
                    
                    return (
                      <div
                        key={result.patternName}
                        onClick={() => setSelectedResult(isSelected ? null : result)}
                        className={cn(
                          "group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all",
                          "border border-transparent hover:border-white/[0.08] hover:bg-white/[0.03]",
                          isSelected && "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/10"
                        )}
                      >
                        <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", config?.color || "text-white/40")} />
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] font-medium text-white/80 truncate block">{result.patternName}</span>
                        </div>
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded tabular-nums",
                          isSelected ? "bg-emerald-500/20 text-emerald-400" : "bg-white/[0.06] text-white/50"
                        )}>
                          {allMatches.length}
                        </span>
                        <ChevronRight className={cn(
                          "h-3 w-3 text-white/20 transition-transform",
                          isSelected && "rotate-90 text-emerald-400"
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
        className="w-1 cursor-col-resize hover:bg-emerald-500/30 active:bg-emerald-500/50 transition-colors flex-shrink-0"
        onMouseDown={startResizeCenter}
      />

      <div className="flex-1 flex flex-col bg-gradient-to-b from-[#0f0f0f] to-[#0a0a0a]">
        {selectedResult ? (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-black/20">
              <div className="flex items-center gap-3">
                {(() => {
                  const config = CATEGORY_CONFIG[selectedResult.category]
                  const Icon = config?.icon || Shield
                  return <Icon className={cn("h-4 w-4", config?.color || "text-white/40")} />
                })()}
                <span className="text-[12px] font-medium text-white/80">{selectedResult.patternName}</span>
                <span className="text-[10px] text-emerald-400">
                  {selectedResult.matches.flatMap(m => m.matches).length} matches
                </span>
              </div>
              <button
                onClick={() => setSelectedResult(null)}
                className="h-7 w-7 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 flex items-center justify-center"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-4">
              <div className="space-y-1">
                {selectedResult.matches.map((match, idx) => (
                  <div key={idx}>
                    {match.matches.map((m, mIdx) => (
                      <div
                        key={mIdx}
                        className="group flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-white/[0.03] transition-colors"
                      >
                        <code className="flex-1 text-[11px] font-mono text-white/70 break-all">{m}</code>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            copyToClipboard(m, `${selectedResult.patternName}-${idx}-${mIdx}`)
                          }}
                          className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-white/10 text-white/30 hover:text-white/60 transition-all"
                        >
                          {copiedItem === `${selectedResult.patternName}-${idx}-${mIdx}` ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-shrink-0 p-3 border-t border-white/[0.06] bg-black/20">
              <button
                onClick={() => {
                  const allMatches = selectedResult.matches.flatMap(m => m.matches)
                  copyToClipboard(allMatches.join('\n'), `copy-${selectedResult.patternName}`)
                }}
                className="w-full h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-[11px] text-white/70 hover:text-white flex items-center justify-center gap-2 transition-colors"
              >
                {copiedItem === `copy-${selectedResult.patternName}` ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                Copy all matches
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-white/30">
            <Crosshair className="h-12 w-12 mb-3 text-white/10" />
            <p className="text-[12px] font-medium text-white/40">Pattern Extractor</p>
            <p className="text-[10px] text-white/20 mt-1">Select a result to view matches</p>
          </div>
        )}
      </div>
    </div>
  )
}
