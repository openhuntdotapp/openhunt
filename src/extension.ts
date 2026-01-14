import * as vscode from 'vscode';
import { registerHttpxCommands } from './httpx/viewer';
import { registerGfCommands } from './gf/viewer';
import { registerJsExtractorCommands } from './jsextractor/viewer';
import { registerJsDownloaderCommands } from './jsdownloader/viewer';
import { FeaturesProvider } from './sidebar/featuresProvider';

export function activate(context: vscode.ExtensionContext) {
    const featuresProvider = new FeaturesProvider();
    vscode.window.registerTreeDataProvider('openhunt.featuresView', featuresProvider);
    
    const httpxCommands = registerHttpxCommands(context);
    context.subscriptions.push(...httpxCommands);
    
    const gfCommands = registerGfCommands(context);
    context.subscriptions.push(...gfCommands);
    
    const jsExtractorCommands = registerJsExtractorCommands(context);
    context.subscriptions.push(...jsExtractorCommands);
    
    const jsDownloaderCommands = registerJsDownloaderCommands(context);
    context.subscriptions.push(...jsDownloaderCommands);
}

export function deactivate() {}
