import { vi } from "vitest";

export const requestUrl = vi.fn();

export class Notice {
	constructor(public message: string) {}
}

export class Plugin {}

export class MarkdownView {}

export class PluginSettingTab {}

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
