import { Plugin, TAbstractFile } from "obsidian";
import { DEFAULT_SETTINGS, MarkuppSettings, MarkuppSettingTab } from "./settings";
import { uploadActiveNote } from "./commands/upload";
import { getNoteMeta, removeNoteMeta, renameNote } from "./storage/note-index";

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

		this.registerEvent(
			this.app.vault.on("rename", async (file: TAbstractFile, oldPath: string) => {
				if (!getNoteMeta(this.settings, oldPath)) return;
				renameNote(this.settings, oldPath, file.path);
				await this.saveSettings();
			}),
		);

		this.registerEvent(
			this.app.vault.on("delete", async (file: TAbstractFile) => {
				if (!getNoteMeta(this.settings, file.path)) return;
				removeNoteMeta(this.settings, file.path);
				await this.saveSettings();
			}),
		);
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
