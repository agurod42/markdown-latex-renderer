import * as fs from 'fs';
import * as request from 'request-light';
import * as vscode from 'vscode';

const editor = vscode.window.activeTextEditor;
const workspace = vscode.workspace;

const RENDERER_SERVICE_URL = 'https://latex.codecogs.com/svg.latex?';

export class MarkdownLaTeXRenderer {

    private renderFolder: string;
    private renderFolderRelative: string;

    constructor() {
    }

    public renderLaTeX() {
        
        if (!workspace.rootPath) return showErrorMessage('Markdown LaTeX Renderer can\'t run on `undefined` workspace');
        if (editor.document.languageId != "markdown") return showErrorMessage('Markdown LaTeX Renderer can only run on markdown files');

        this.renderFolderRelative = 'images/LaTeX';
        this.renderFolder = workspace.rootPath + '/' + this.renderFolderRelative;
        this.createRenderFolderIfNotExists();

        editor.edit(edit => {
            let match;
            let regExp = /\$\$([\s\S]*?)\$\$/g;
            let text = editor.document.getText();
            
            while (match = regExp.exec(text)) {
                this.renderExpression(edit, match[1], match.index, match[0].length);
            }
        });
    }

    private createRenderFolderIfNotExists() {
        if (!fs.existsSync(this.renderFolder)) {
            fs.mkdirSync(this.renderFolder);
        }
    }

    private renderExpression(edit: vscode.TextEditorEdit, expression: string, startIndex: number, length: number) {
        var expressionImagePath = this.renderFolder + '/' + expression.trim() + '.svg';

        if (fs.existsSync(expressionImagePath)) {
            this.replaceExpressionWithImage(edit, expression, startIndex, length);
        }
        else {
            this.downloadExpressionImageWithCallback(expression, () => {
                this.renderExpression(edit, expression, startIndex, length);                
            });
        }
    }

    private downloadExpressionImageWithCallback(expression: string, callback: Function) {
        let expressionImagePath = this.renderFolder + '/' + expression.trim() + '.svg';

        request
            .xhr({url: RENDERER_SERVICE_URL + expression})
            .then(res => {
                if (res.status == 200) {
                    fs.writeFile(expressionImagePath, res.responseText, err => {
                        callback();
                    });
                }
                else {
                    console.log(res);
                }
            });
    }
    
    private replaceExpressionWithImage(edit: vscode.TextEditorEdit, expression: string, startIndex: number, length: number) {
        let expressionImageRelativePath = this.renderFolderRelative + '/' + expression.trim() + '.svg';
        
        let position = editor.document.positionAt(startIndex);
        let value = '<!--$$' + expression + '$$-->' + '<img src="' + expressionImageRelativePath + '" />';

        edit.replace(new vscode.Range(position, position.translate(0, length)), value);
    }

}

function showErrorMessage(message: string) {
    vscode.window.showErrorMessage(message);
}
