import { vi } from "vitest";

export const requestUrl = vi.fn();

export const noticeCalls: string[] = [];

export function clearNoticeCalls(): void {
	noticeCalls.length = 0;
}

export class Notice {
	constructor(public message: string) {
		noticeCalls.push(message);
	}
}

export class Plugin {}
export class MarkdownView {}
export class PluginSettingTab {}

export class TAbstractFile {
	path: string = "";
}

export class TFile extends TAbstractFile {
	stat: { mtime: number };
	constructor(path: string = "", mtime: number = 0) {
		super();
		this.path = path;
		this.stat = { mtime };
	}
}

export class TFolder extends TAbstractFile {
	constructor(path: string = "") {
		super();
		this.path = path;
	}
}

export class Setting {
	setName() {
		return this;
	}
	setDesc() {
		return this;
	}
	addText() {
		return this;
	}
}

export class Menu {
	addItem() {
		return this;
	}
	addSeparator() {
		return this;
	}
	showAtMouseEvent() {
		return this;
	}
}
