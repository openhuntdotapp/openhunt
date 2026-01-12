import * as vscode from 'vscode';

export class FeaturesProvider implements vscode.TreeDataProvider<FeatureItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<FeatureItem | undefined | null | void> = new vscode.EventEmitter<FeatureItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<FeatureItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private features: FeatureItem[] = [
        new FeatureItem(
            'httpx viewer',
            'view and analyze httpx JSON output',
            vscode.TreeItemCollapsibleState.None,
            {
                command: 'openhunt.httpx.openFile',
                title: 'open httpx viewer',
                arguments: []
            },
            'globe'
        ),
        new FeatureItem(
            'pattern extractor',
            'extract patterns from URLs using gf patterns',
            vscode.TreeItemCollapsibleState.None,
            {
                command: 'openhunt.gf.openViewer',
                title: 'open pattern extractor',
                arguments: []
            },
            'search'
        )
    ];

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: FeatureItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: FeatureItem): Thenable<FeatureItem[]> {
        if (element) {
            return Promise.resolve([]);
        }
        return Promise.resolve(this.features);
    }
}

export class FeatureItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command,
        iconName: string = 'globe'
    ) {
        super(label, collapsibleState);
        this.tooltip = description;
        this.iconPath = new vscode.ThemeIcon(iconName);
    }
}
