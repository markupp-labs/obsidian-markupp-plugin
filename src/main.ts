import { Menu, Plugin, TAbstractFile } from "obsidian";
import { DEFAULT_SETTINGS, MarkuppSettings, MarkuppSettingTab } from "./settings";
import { downloadActiveNote } from "./commands/download";
import { importFromServer } from "./commands/import";
import { syncActiveNote } from "./commands/sync";
import { syncAllNotes } from "./commands/sync-all";
import { uploadActiveNote } from "./commands/upload";
import { getNoteMeta, removeNoteMeta, renameNote } from "./storage/note-index";

export default class MarkuppPlugin extends Plugin {
	settings!: MarkuppSettings;

	async onload() {
		await this.loadSettings();

		const sync = () => syncActiveNote(this, this.settings);
		const upload = () => uploadActiveNote(this, this.settings);
		const download = () => downloadActiveNote(this, this.settings);
		const importAll = () => importFromServer(this, this.settings);
		const syncAll = () => syncAllNotes(this, this.settings);

		this.addRibbonIcon("arrow-big-up-dash", "Markupp", (evt) => {
			const menu = new Menu();
			menu.addItem((item) =>
				item.setTitle("Sincronizar").setIcon("refresh-cw").onClick(sync),
			);
			menu.addItem((item) =>
				item.setTitle("Subir").setIcon("upload").onClick(upload),
			);
			menu.addItem((item) =>
				item.setTitle("Baixar").setIcon("download").onClick(download),
			);
			menu.addSeparator();
			menu.addItem((item) =>
				item
					.setTitle("Importar do servidor")
					.setIcon("download-cloud")
					.onClick(importAll),
			);
			menu.addItem((item) =>
				item
					.setTitle("Sincronizar tudo")
					.setIcon("refresh-ccw")
					.onClick(syncAll),
			);
			menu.showAtMouseEvent(evt);
		});

		this.addCommand({
			id: "markupp-sync",
			name: "Markupp: Sincronizar nota ativa",
			callback: sync,
		});
		this.addCommand({
			id: "markupp-upload",
			name: "Markupp: Subir nota ativa",
			callback: upload,
		});
		this.addCommand({
			id: "markupp-download",
			name: "Markupp: Baixar nota ativa",
			callback: download,
		});
		this.addCommand({
			id: "markupp-import",
			name: "Markupp: Importar do servidor",
			callback: importAll,
		});
		this.addCommand({
			id: "markupp-sync-all",
			name: "Markupp: Sincronizar tudo",
			callback: syncAll,
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
