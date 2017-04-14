import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import * as path from 'path';
import * as request from 'request-light';
import * as vscode from 'vscode';
import { Expression } from '../classes/Expression';

const editor = vscode.window.activeTextEditor;
const workspace = vscode.workspace;

const RENDERER_SERVICE_URL = 'https://latex.codecogs.com/svg.latex?';

export class MarkdownLaTeXRenderer {

    private renderFolder: string;
    private renderFolderRelative: string;

    private expressions: Array<Expression> = [];

    constructor() {
    }

    public async renderLaTeX() {
        
        if (!workspace.rootPath) return showErrorMessage('Markdown LaTeX Renderer can\'t run on `undefined` workspace');
        if (editor.document.languageId != "markdown") return showErrorMessage('Markdown LaTeX Renderer can only run on markdown files');

        let editorDocumentFolder = path.posix.dirname(editor.document.fileName);
        this.renderFolderRelative = path.posix.relative(workspace.rootPath, editorDocumentFolder) + '/images/LaTeX';
        this.renderFolder = path.normalize(workspace.rootPath + '/' + this.renderFolderRelative);
        this.createRenderFolderIfNotExists();

        this.findExpressions();
        await this.downloadExpressions();
        this.renderExpressions();

    }

    private createRenderFolderIfNotExists() {
        if (!fs.existsSync(this.renderFolder)) {
            mkdirp(this.renderFolder, err => {
                if (err) showErrorMessage(err.message);
            });
        }
    }

    private findExpressions() {
        let match;
        let regExp = /\$\$([\s\S]*?)\$\$/g;
        let text = editor.document.getText();
        
        while (match = regExp.exec(text)) {
            this.expressions.push(new Expression(match[1], editor.document.positionAt(match.index)));
        }
    }

    private downloadExpressions() {
        return new Promise(resolve => {

            let cachedExpressions = 0;
            let downloadedExpressions = 0;

            this.expressions.forEach(expression => {
                let expressionImagePath = this.renderFolder + '/' + expression.getImageFileName();

                if (fs.existsSync(expressionImagePath)) {
                    cachedExpressions++;
                }
                else {
                    this.downloadExpressionImageWithCallback(expression, () => {
                        downloadedExpressions++;

                        if (cachedExpressions + downloadedExpressions == this.expressions.length) {
                            resolve();
                        }
                    })
                }
            });

            if (cachedExpressions + downloadedExpressions == this.expressions.length) {
                resolve();
            }

        });
    }

    private downloadExpressionImageWithCallback(expression: Expression, callback: Function) {
        let expressionImagePath = this.renderFolder + '/' + expression.getImageFileName();

        request
            .xhr({url: RENDERER_SERVICE_URL + expression})
            .then(res => {
                if (res.status == 200) {
                    fs.writeFile(expressionImagePath, res.responseText, err => {
                        if (err) showErrorMessage(err.message);
                        else callback(err);
                    });
                }
                else {
                    console.log(res);
                }
            });
    }

    private renderExpressions() {
        editor.edit(edit => {
            this.expressions.forEach(expression => {

                let expressionImageRelativePath = this.renderFolderRelative + '/' + expression.getImageFileName();
                let imageHtmlCode = '<!--$$' + expression.getText() + '$$-->' + '<img src="' + expressionImageRelativePath + '" />';
                
                edit.replace(new vscode.Range(expression.getStartingPosition(), expression.getEndingPosition()), imageHtmlCode);

            });
        });
    }

}

function showErrorMessage(message: string) {
    vscode.window.showErrorMessage(message);
}
