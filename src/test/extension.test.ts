import * as assert from 'assert';
import * as vscode from 'vscode';

suite('GFactor Extension Test Suite', () => {
    vscode.window.showInformationMessage('Starting GFactor tests');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('cainus.gfactor'));
    });

    test('Extension should activate', async () => {
        const extension = vscode.extensions.getExtension('cainus.gfactor');
        if (!extension) {
            assert.fail('Extension not found');
            return;
        }
        
        await extension.activate();
        assert.strictEqual(extension.isActive, true);
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands();
        assert.ok(commands.includes('gfactor.startRefactor'));
        assert.ok(commands.includes('gfactor.configureApiKeys'));
        assert.ok(commands.includes('gfactor.showBurndownChart'));
    });
});