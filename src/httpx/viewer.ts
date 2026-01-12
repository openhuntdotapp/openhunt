import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

let panel: vscode.WebviewPanel | undefined;

export function registerHttpxCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
    const openViewerCommand = vscode.commands.registerCommand('openhunt.httpx.openViewer', async (uri?: vscode.Uri) => {
        let fileUri = uri;
        
        if (!fileUri && vscode.window.activeTextEditor) {
            fileUri = vscode.window.activeTextEditor.document.uri;
        }
        
        if (!fileUri) {
            const files = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectMany: false,
                filters: { 'JSON Files': ['json', 'jsonl'] }
            });
            if (files && files.length > 0) {
                fileUri = files[0];
            }
        }
        
        if (fileUri) {
            openPanel(context, fileUri);
        }
    });

    const openFileCommand = vscode.commands.registerCommand('openhunt.httpx.openFile', async () => {
        const files = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectMany: false,
            filters: { 'JSON Files': ['json', 'jsonl'] }
        });
        if (files && files.length > 0) {
            openPanel(context, files[0]);
        }
    });

    return [openViewerCommand, openFileCommand];
}

function openPanel(context: vscode.ExtensionContext, fileUri: vscode.Uri) {
    const columnToShowIn = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn
        : undefined;

    if (panel) {
        panel.reveal(columnToShowIn);
    } else {
        panel = vscode.window.createWebviewPanel(
            'openhunt.httpx',
            'httpx viewer',
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
                    case 'loadFile':
                        const content = fs.readFileSync(fileUri.fsPath, 'utf-8');
                        const data = parseHttpxOutput(content);
                        panel?.webview.postMessage({ command: 'data', data, filename: path.basename(fileUri.fsPath) });
                        break;
                    case 'openFile':
                        const files = await vscode.window.showOpenDialog({
                            canSelectFiles: true,
                            canSelectMany: false,
                            filters: { 'JSON Files': ['json', 'jsonl'] }
                        });
                        if (files && files.length > 0) {
                            const newContent = fs.readFileSync(files[0].fsPath, 'utf-8');
                            const newData = parseHttpxOutput(newContent);
                            panel?.webview.postMessage({ command: 'data', data: newData, filename: path.basename(files[0].fsPath) });
                        }
                        break;
                }
            },
            undefined,
            context.subscriptions
        );
    }

    panel.webview.html = getWebviewContent(context, panel.webview);
    
    setTimeout(() => {
        const content = fs.readFileSync(fileUri.fsPath, 'utf-8');
        const data = parseHttpxOutput(content);
        panel?.webview.postMessage({ command: 'data', data, filename: path.basename(fileUri.fsPath) });
    }, 500);
}

function parseHttpxOutput(content: string): Record<string, unknown>[] {
    const lines = content.trim().split('\n').filter(line => line.trim());
    const results: Record<string, unknown>[] = [];
    
    for (const line of lines) {
        try {
            const parsed = JSON.parse(line);
            if (typeof parsed === 'object' && parsed !== null) {
                if (Array.isArray(parsed)) {
                    results.push(...parsed);
                } else {
                    results.push(parsed);
                }
            }
        } catch {
            continue;
        }
    }
    
    if (results.length === 0) {
        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                return parsed;
            }
            return [parsed];
        } catch {
            return [];
        }
    }
    
    return results;
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
    <title>httpx viewer</title>
</head>
<body>
    <div id="root"></div>
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
