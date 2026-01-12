import * as vscode from 'vscode';
import { registerHttpxCommands } from './httpx/viewer';
import { registerGfCommands } from './gf/viewer';
import { FeaturesProvider } from './sidebar/featuresProvider';

export function activate(context: vscode.ExtensionContext) {
    const featuresProvider = new FeaturesProvider();
    vscode.window.registerTreeDataProvider('openhunt.featuresView', featuresProvider);
    
    const httpxCommands = registerHttpxCommands(context);
    context.subscriptions.push(...httpxCommands);
    
    const gfCommands = registerGfCommands(context);
    context.subscriptions.push(...gfCommands);
}

export function deactivate() {}
