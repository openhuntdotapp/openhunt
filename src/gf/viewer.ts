import * as vscode from 'vscode';
import * as path from 'path';
import { loadPatterns, extractAllMatches, GFPattern } from './patterns';

let panel: vscode.WebviewPanel | undefined;

export function registerGfCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
    const openGfCommand = vscode.commands.registerCommand('openhunt.gf.openViewer', async (uri?: vscode.Uri) => {
        openPanel(context, uri);
    });

    return [openGfCommand];
}

async function listWorkspaceFiles(): Promise<{ name: string; path: string; relativePath: string }[]> {
    const files: { name: string; path: string; relativePath: string }[] = [];
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (!workspaceFolders) {
        return files;
    }

    const excludePatterns = [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.vscode/**',
        '**/coverage/**',
        '**/*.min.js',
        '**/*.min.css',
        '**/package-lock.json',
        '**/yarn.lock',
        '**/bun.lock'
    ];

    const includePatterns = [
        '**/*.{js,ts,jsx,tsx,json,html,css,scss,py,rb,go,rs,java,php,xml,yml,yaml,md,txt,sh,bash,zsh,env,config,conf}'
    ];

    for (const folder of workspaceFolders) {
        const foundFiles = await vscode.workspace.findFiles(
            new vscode.RelativePattern(folder, includePatterns[0]),
            `{${excludePatterns.join(',')}}`,
            500
        );

        for (const file of foundFiles) {
            const relativePath = path.relative(folder.uri.fsPath, file.fsPath);
            files.push({
                name: path.basename(file.fsPath),
                path: file.fsPath,
                relativePath
            });
        }
    }

    return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function openPanel(context: vscode.ExtensionContext, uri?: vscode.Uri) {
    const columnToShowIn = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn
        : undefined;

    const patterns = loadPatterns(context.extensionPath);

    if (panel) {
        panel.reveal(columnToShowIn);
        if (uri) {
            sendFileContent(uri);
        }
    } else {
        panel = vscode.window.createWebviewPanel(
            'openhunt.gf',
            'pattern extractor',
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
                    case 'getPatterns':
                        panel?.webview.postMessage({ 
                            command: 'patterns', 
                            data: patterns 
                        });
                        break;
                    case 'extract':
                        const { text, selectedPatterns } = message;
                        const selectedPatternObjs = selectedPatterns.map((name: string) => 
                            patterns.find(p => p.name === name)
                        ).filter(Boolean) as GFPattern[];
                        const results = extractAllMatches(text, selectedPatternObjs);
                        panel?.webview.postMessage({ 
                            command: 'results', 
                            data: results 
                        });
                        break;
                    case 'openFile':
                        const files = await vscode.window.showOpenDialog({
                            canSelectFiles: true,
                            canSelectMany: false,
                            filters: { 'All Files': ['*'] }
                        });
                        if (files && files.length > 0) {
                            const content = await vscode.workspace.fs.readFile(files[0]);
                            panel?.webview.postMessage({ 
                                command: 'fileContent', 
                                data: Buffer.from(content).toString('utf-8'),
                                filename: files[0].fsPath.split('/').pop()
                            });
                        }
                        break;
                    case 'listWorkspaceFiles':
                        const workspaceFiles = await listWorkspaceFiles();
                        panel?.webview.postMessage({
                            command: 'workspaceFiles',
                            files: workspaceFiles
                        });
                        break;
                    case 'readMultipleFiles':
                        const paths: string[] = message.paths;
                        let combinedContent = '';
                        for (const filePath of paths) {
                            try {
                                const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
                                combinedContent += `\n\n// === ${path.basename(filePath)} ===\n\n`;
                                combinedContent += Buffer.from(fileContent).toString('utf-8');
                            } catch (e) {
                                console.error(`Failed to read ${filePath}:`, e);
                            }
                        }
                        panel?.webview.postMessage({
                            command: 'multiFileContent',
                            data: combinedContent.trim(),
                            fileCount: paths.length
                        });
                        break;
                    case 'copyToClipboard':
                        vscode.env.clipboard.writeText(message.text);
                        vscode.window.showInformationMessage('Copied to clipboard');
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

        panel.webview.html = getWebviewContent(context, panel.webview);
        
        if (uri) {
            setTimeout(() => sendFileContent(uri), 100);
        }
    }
}

async function sendFileContent(uri: vscode.Uri) {
    if (!panel) return;
    try {
        const content = await vscode.workspace.fs.readFile(uri);
        panel.webview.postMessage({ 
            command: 'fileContent', 
            data: Buffer.from(content).toString('utf-8'),
            filename: path.basename(uri.fsPath)
        });
    } catch (e) {
        console.error('Failed to read file:', e);
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
    <title>Pattern Extractor</title>
</head>
<body>
    <div id="root" data-view="gf"></div>
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
