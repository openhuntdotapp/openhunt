declare function acquireVsCodeApi(): {
  postMessage: (message: unknown) => void
  getState: () => unknown
  setState: (state: unknown) => void
}

export const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null
