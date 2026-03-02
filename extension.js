const vscode = require('vscode');

/** @type {vscode.StatusBarItem} */
let statusBarItem;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Antigravity Auto-Accept extension is now active!');

    // Initialize Status Bar Item
    // We place it on the right with a relatively high priority (100)
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'antigravity-auto-accept.toggle';
    context.subscriptions.push(statusBarItem);

    // Register Toggle Command
    let toggleCommand = vscode.commands.registerCommand('antigravity-auto-accept.toggle', async () => {
        const config = vscode.workspace.getConfiguration('antigravity');
        const currentState = config.get('autoAccept.enabled', true);
        const newState = !currentState;
        
        await config.update('autoAccept.enabled', newState, vscode.ConfigurationTarget.Global);
        
        // Sync with core chat settings
        await syncCoreSettings(newState);
        
        updateStatusBarText();
        
        const message = newState ? 'Antigravity Auto-Accept is now ENABLED.' : 'Antigravity Auto-Accept is now DISABLED.';
        vscode.window.showInformationMessage(message, 'Configure').then(selection => {
            if (selection === 'Configure') {
                vscode.commands.executeCommand('antigravity-auto-accept.configure');
            }
        });
    });
    context.subscriptions.push(toggleCommand);

    // Register Configure Command
    let configureCommand = vscode.commands.registerCommand('antigravity-auto-accept.configure', () => {
        // Open the settings UI filtered to our specific extension settings
        vscode.commands.executeCommand('workbench.action.openSettings', 'antigravity.autoAccept');
    });
    context.subscriptions.push(configureCommand);

    // Watch for config changes (either from toggle or manual settings edit)
    const configWatcher = vscode.workspace.onDidChangeConfiguration(async e => {
        if (e.affectsConfiguration('antigravity.autoAccept')) {
            const config = vscode.workspace.getConfiguration('antigravity');
            updateStatusBarText();
            // Ensure core settings are in sync if the user manually changed our sub-settings
            await syncCoreSettings(config.get('autoAccept.enabled', true));
        }
    });
    context.subscriptions.push(configWatcher);

    // Initial state setup
    updateStatusBarText();
    statusBarItem.show();
}

/**
 * Syncs the extension-specific settings with the core Antigravity/VS Code chat settings.
 * @param {boolean} globalEnabled
 */
async function syncCoreSettings(globalEnabled) {
    const config = vscode.workspace.getConfiguration('antigravity.autoAccept');
    const coreChatConfig = vscode.workspace.getConfiguration('chat.tools');
    
    // User preferences for specific action types
    const autoAcceptCommands = config.get('runCommands', true);
    const autoAcceptDiffs = config.get('fileEdits', false); // Default false as per user request
    const autoAcceptBrowser = config.get('browserActions', true);

    if (globalEnabled) {
        // Only enable specific tools if both global and tool-specific settings are ON
        await coreChatConfig.update('terminal.autoApprove', autoAcceptCommands, vscode.ConfigurationTarget.Global);
        await coreChatConfig.update('terminal.enableAutoApprove', autoAcceptCommands, vscode.ConfigurationTarget.Global);
        await coreChatConfig.update('edits.autoApprove', autoAcceptDiffs, vscode.ConfigurationTarget.Global);
        await coreChatConfig.update('global.autoApprove', true, vscode.ConfigurationTarget.Global);
        
        // Handle legacy or specific agent settings if they exist
        const tfaConfig = vscode.workspace.getConfiguration('tfa.system');
        if (tfaConfig.get('autoAccept') !== undefined) {
            await tfaConfig.update('autoAccept', true, vscode.ConfigurationTarget.Global);
        }
    } else {
        // Force all auto-acceptance OFF
        await coreChatConfig.update('terminal.autoApprove', false, vscode.ConfigurationTarget.Global);
        await coreChatConfig.update('terminal.enableAutoApprove', false, vscode.ConfigurationTarget.Global);
        await coreChatConfig.update('edits.autoApprove', false, vscode.ConfigurationTarget.Global);
        await coreChatConfig.update('global.autoApprove', false, vscode.ConfigurationTarget.Global);
        
        const tfaConfig = vscode.workspace.getConfiguration('tfa.system');
        if (tfaConfig.get('autoAccept') !== undefined) {
            await tfaConfig.update('autoAccept', false, vscode.ConfigurationTarget.Global);
        }
    }
}

/**
 * Updates the Status Bar item's look and feel.
 */
function updateStatusBarText() {
    const config = vscode.workspace.getConfiguration('antigravity');
    const enabled = config.get('autoAccept.enabled', true);
    const run = config.get('autoAccept.runCommands', true);
    const diff = config.get('autoAccept.fileEdits', false);

    // Use a shield or bolt icon to signify automation/protection
    const icon = enabled ? '$(zap)' : '$(circle-slash)';
    statusBarItem.text = `${icon} Auto-Accept: ${enabled ? 'ON' : 'OFF'}`;
    
    let tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(`**Antigravity Auto-Accept**\n\n`);
    tooltip.appendMarkdown(`- Global Status: **${enabled ? 'ON' : 'OFF'}**\n`);
    tooltip.appendMarkdown(`- Run Commands: **${run ? 'ALLOWED' : 'DENIED'}**\n`);
    tooltip.appendMarkdown(`- File Diffs: **${diff ? 'ALLOWED' : 'DENIED'}** (Risk High)\n\n`);
    tooltip.appendMarkdown(`***\nClick to toggle global state.`);
    
    statusBarItem.tooltip = tooltip;
    
    // Highlight when ON to warn user about automation
    if (enabled && run) {
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
    } else {
        statusBarItem.backgroundColor = undefined;
        statusBarItem.color = undefined;
    }
}

function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}

module.exports = {
    activate,
    deactivate
};
