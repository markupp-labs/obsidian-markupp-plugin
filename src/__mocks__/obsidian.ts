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
export class TAbstractFile {}

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
	showAtMouseEvent() {
		return this;
	}
}
