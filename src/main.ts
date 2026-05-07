import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, MarkuppSettings, MarkuppSettingTab } from "./settings";
import { uploadActiveNote } from "./commands/upload-active-note";

export default class MarkuppPlugin extends Plugin {
	settings!: MarkuppSettings;

	async onload() {
		await this.loadSettings();

		const upload = () => uploadActiveNote(this, this.settings);

		this.addRibbonIcon("arrow-big-up-dash", "Subir nota ativa", upload);

		this.addCommand({
			id: "upload-active-note",
			name: "Subir nota ativa",
			callback: upload,
		});

		this.addSettingTab(new MarkuppSettingTab(this.app, this));

	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<MarkuppSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
