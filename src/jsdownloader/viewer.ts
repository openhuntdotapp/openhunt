import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

let panel: vscode.WebviewPanel | undefined;
let isPaused = false;
let isStopped = false;

export function registerJsDownloaderCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
    const openCommand = vscode.commands.registerCommand('openhunt.jsdownloader.openViewer', async () => {
        openPanel(context);
    });

    return [openCommand];
}

interface DownloadResult {
    url: string;
    success: boolean;
    filename?: string;
    size?: number;
    error?: string;
}

async function downloadFile(url: string, outputDir: string): Promise<DownloadResult> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            return { url, success: false, error: `HTTP ${response.status}` };
        }

        const content = await response.text();
        
        let filename = url.split('/').pop() || 'unknown.js';
        filename = filename.split('?')[0];
        if (!filename.endsWith('.js')) {
            filename += '.js';
        }
        filename = filename.replace(/[<>:"/\\|?*]/g, '_');
        
        let finalPath = path.join(outputDir, filename);
        let counter = 1;
        while (fs.existsSync(finalPath)) {
            const ext = path.extname(filename);
            const base = path.basename(filename, ext);
            finalPath = path.join(outputDir, `${base}_${counter}${ext}`);
            counter++;
        }

        fs.writeFileSync(finalPath, content, 'utf-8');

        return {
            url,
            success: true,
            filename: path.basename(finalPath),
            size: content.length
        };
    } catch (e) {
        return { url, success: false, error: String(e) };
    }
}

async function downloadBatch(urls: string[], outputDir: string, concurrency: number, panel: vscode.WebviewPanel): Promise<DownloadResult[]> {
    const results: DownloadResult[] = [];
    const queue = [...urls];
    let completed = 0;
    isPaused = false;
    isStopped = false;

    const waitWhilePaused = async () => {
        while (isPaused && !isStopped) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    };

    const worker = async () => {
        while (queue.length > 0 && !isStopped) {
            await waitWhilePaused();
            if (isStopped) break;

            const url = queue.shift();
            if (!url) break;

            const result = await downloadFile(url, outputDir);
            results.push(result);
            completed++;

            panel.webview.postMessage({
                command: 'downloadProgress',
                completed,
                total: urls.length,
                result
            });
        }
    };

    const workers = Array(Math.min(concurrency, urls.length)).fill(null).map(() => worker());
    await Promise.all(workers);

    return results;
}

function openPanel(context: vscode.ExtensionContext) {
    const columnToShowIn = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn
        : undefined;

    if (panel) {
        panel.reveal(columnToShowIn);
    } else {
        panel = vscode.window.createWebviewPanel(
            'openhunt.jsdownloader',
            'js downloader',
            columnToShowIn || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'webview', 'dist')
                ]
            }
        );

        panel.onDidDispose(() => {
            panel = undefined;
        }, null, context.subscriptions);

        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'selectOutputDir':
                        const folders = await vscode.window.showOpenDialog({
                            canSelectFiles: false,
                            canSelectFolders: true,
                            canSelectMany: false,
                            openLabel: 'Select Output Directory'
                        });
                        if (folders && folders.length > 0) {
                            panel?.webview.postMessage({
                                command: 'outputDir',
                                path: folders[0].fsPath
                            });
                        }
                        break;

                    case 'selectTxtFile':
                        const files = await vscode.window.showOpenDialog({
                            canSelectFiles: true,
                            canSelectMany: false,
                            filters: { 'Text Files': ['txt'] }
                        });
                        if (files && files.length > 0) {
                            const content = await vscode.workspace.fs.readFile(files[0]);
                            const text = Buffer.from(content).toString('utf-8');
                            const urls = text.split('\n')
                                .map(line => line.trim())
                                .filter(line => line && (line.startsWith('http://') || line.startsWith('https://')));
                            panel?.webview.postMessage({
                                command: 'urlsLoaded',
                                urls,
                                filename: path.basename(files[0].fsPath)
                            });
                        }
                        break;

                    case 'startDownload':
                        const { urls, outputDir, concurrency } = message;
                        if (!urls || urls.length === 0) {
                            vscode.window.showErrorMessage('No URLs to download');
                            return;
                        }
                        if (!outputDir) {
                            vscode.window.showErrorMessage('Please select output directory');
                            return;
                        }
                        if (!fs.existsSync(outputDir)) {
                            fs.mkdirSync(outputDir, { recursive: true });
                        }

                        panel?.webview.postMessage({ command: 'downloadStarted' });
                        
                        const results = await downloadBatch(urls, outputDir, concurrency || 10, panel!);
                        
                        const successful = results.filter(r => r.success).length;
                        const failed = results.filter(r => !r.success).length;
                        
                        panel?.webview.postMessage({
                            command: 'downloadComplete',
                            results,
                            summary: { total: urls.length, successful, failed }
                        });

                        vscode.window.showInformationMessage(
                            `Download complete: ${successful}/${urls.length} successful`
                        );
                        break;

                    case 'openOutputDir':
                        if (message.path) {
                            vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(message.path));
                        }
                        break;

                    case 'pauseDownload':
                        isPaused = true;
                        panel?.webview.postMessage({ command: 'downloadPaused' });
                        break;

                    case 'resumeDownload':
                        isPaused = false;
                        panel?.webview.postMessage({ command: 'downloadResumed' });
                        break;

                    case 'stopDownload':
                        isStopped = true;
                        isPaused = false;
                        panel?.webview.postMessage({ command: 'downloadStopped' });
                        break;

                    case 'copyResults':
                        vscode.env.clipboard.writeText(message.text);
                        vscode.window.showInformationMessage('Results copied to clipboard');
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

        panel.webview.html = getWebviewContent(context, panel.webview);
    }
}

function getWebviewContent(context: vscode.ExtensionContext, webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, 'webview', 'dist', 'assets', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, 'webview', 'dist', 'assets', 'index.css')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <link rel="stylesheet" href="${styleUri}">
    <title>JS Downloader</title>
</head>
<body>
    <div id="root" data-view="jsdownloader"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
