import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import * as path from 'path';
import * as request from 'request-light';
import * as vscode from 'vscode';
import { Expression } from '../classes/Expression';

const editor = vscode.window.activeTextEditor;
const workspace = vscode.workspace;
const window = vscode.window;

const RENDERER_SERVICE_URL = 'https://latex.codecogs.com/svg.latex?';

export class MarkdownLaTeXRenderer {

    private configuration;
    private renderFolder: string;
    private renderFolderRelative: string;

    private expressions: Array<Expression> = [];

    constructor() {

        if (!workspace.rootPath) window.showErrorMessage('Markdown LaTeX Renderer can\'t run on `undefined` workspace');
        if (editor.document.languageId != "markdown") window.showErrorMessage('Markdown LaTeX Renderer can only run on markdown files');
        
        let configurationFilePath = workspace.rootPath + '/.vscode/markdownLaTeXRenderer.json';
        if (fs.existsSync(configurationFilePath)) this.configuration = JSON.parse(fs.readFileSync(configurationFilePath, 'utf8'));

    }

    public async renderLaTeX() {

        let editorDocumentFolder = path.posix.dirname(editor.document.fileName);
        let editorDocumentRelativePath = path.posix.relative(workspace.rootPath, editorDocumentFolder);
        let imagesFolderName = this.getConfiguration('imagesFolderName', 'images');
        this.renderFolderRelative = (editorDocumentRelativePath.length ? editorDocumentRelativePath + '/' : '') + imagesFolderName + '/LaTeX';
        this.renderFolder = path.normalize(workspace.rootPath + '/' + this.renderFolderRelative);
        this.createRenderFolderIfNotExists();

        this.findExpressions();
        await this.downloadExpressions();
        this.renderExpressions();

    }

    private createRenderFolderIfNotExists() {
        if (!fs.existsSync(this.renderFolder)) {
            mkdirp(this.renderFolder, err => {
                if (err) window.showErrorMessage(err.message);
            });
        }
    }

    private findExpressions() {
        let match;
        let regExp = /\$\$([\s\S]*?)\$\$/g;
        let text = editor.document.getText();
        
        this.expressions = [];

        while (match = regExp.exec(text)) {
            let isExpressionCommented = text.substr(match.index - 4, 4) == '<!--';
            this.expressions.push(new Expression(match[1], editor.document.positionAt(match.index), !isExpressionCommented));
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
            .xhr({url: RENDERER_SERVICE_URL + expression.getText()})
            .then(res => {
                if (res.status == 200) {
                    fs.writeFile(expressionImagePath, res.responseText, err => {
                        if (err) window.showErrorMessage(err.message);
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

                let expressionImageUrlPreffix = (this.getConfiguration('imagesUrlPreffix', '') + '/').replace(/^\//, '').replace(/\/\/$/, '\/');
                let expressionImageUrl = expressionImageUrlPreffix + this.renderFolderRelative + '/' + expression.getImageFileName();
                let expressionImageEncodedUrl = expressionImageUrl.replace(/\s/g, '%20').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
                let imageHtmlCode = '<!--$$' + expression.getText() + '$$--> ![](' + expressionImageEncodedUrl + ')';
                
                if (expression.isFirstRender()) {
                    edit.replace(new vscode.Range(expression.getStartingPosition(), expression.getEndingPosition()), imageHtmlCode);
                }
                else {
                    let expressionToEditStartingPosition = expression.getStartingPosition().translate(0, -4);
                    let expressionToEditEndingIndex = editor.document.getText().indexOf('.svg)', editor.document.offsetAt(expressionToEditStartingPosition)) + 5;
                    let expressionToEditEndingPosition = editor.document.positionAt(expressionToEditEndingIndex);
                    edit.replace(new vscode.Range(expressionToEditStartingPosition, expressionToEditEndingPosition), imageHtmlCode);
                }

            });
        });
    }

    private getConfiguration(key: string, defaultValue: string = '') {
        if (this.configuration && this.configuration[key]) {
            return this.configuration[key];
        }
        else {
            return defaultValue;
        }
    }

}