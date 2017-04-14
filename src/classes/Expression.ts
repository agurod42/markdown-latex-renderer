import * as fs from 'fs';
import * as sanitizeFilename from 'sanitize-filename';
import * as vscode from 'vscode';

export class Expression {

    private text: string;
    private position: vscode.Position;

    constructor(text: string, position: vscode.Position) {
        this.text = text;
        this.position = position;   
    }

    public getImageFileName(): string {
        return sanitizeFilename(this.getText().trim()) + '.svg';
    }

    public getText(): string {
        return this.text;
    }

    public getTextWithDollarSigns(): string {
        return '$$' + this.getText() + '$$';
    }

    public getStartingPosition(): vscode.Position {
        return this.position;
    }

    public getEndingPosition(): vscode.Position {
        return this.getStartingPosition().translate(0, this.getTextWithDollarSigns().length);
    }

}