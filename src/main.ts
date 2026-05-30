import { Plugin, TAbstractFile } from "obsidian";
import {
	DEFAULT_SETTINGS,
	MarkuppSettings,
	MarkuppSettingTab,
	migrateSettings,
} from "./settings";
import {
	fetchRemote,
	notifyResult,
	pull,
	push,
	sync,
} from "./core/operations";
import {
	getNoteMeta,
	markTombstone,
	renameNote,
} from "./storage/note-index";

export default class MarkuppPlugin extends Plugin {
	settings!: MarkuppSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "markupp-fetch",
			name: "Fetch",
			callback: async () => {
				await fetchRemote(this, this.settings);
				notifyResult("fetch", {});
			},
		});
		this.addCommand({
			id: "markupp-pull",
			name: "Pull",
			callback: async () => {
				const r = await pull(this, this.settings);
				notifyResult("pull", r);
			},
		});
		this.addCommand({
			id: "markupp-push",
			name: "Push",
			callback: async () => {
				const r = await push(this, this.settings);
				notifyResult("push", r);
			},
		});
		this.addCommand({
			id: "markupp-sync",
			name: "Sync (fetch + pull + push)",
			callback: async () => {
				const r = await sync(this, this.settings);
				notifyResult("sync", r);
			},
		});

		this.addSettingTab(new MarkuppSettingTab(this.app, this));

		this.registerEvent(
			this.app.vault.on(
				"rename",
				async (file: TAbstractFile, oldPath: string) => {
					if (!getNoteMeta(this.settings, oldPath)) return;
					renameNote(this.settings, oldPath, file.path);
					await this.saveSettings();
				},
			),
		);

		this.registerEvent(
			this.app.vault.on("delete", async (file: TAbstractFile) => {
				if (!getNoteMeta(this.settings, file.path)) return;
				markTombstone(this.settings, file.path);
				await this.saveSettings();
			}),
		);
	}

	onunload() {}

	async loadSettings() {
		const raw = (await this.loadData()) as Partial<MarkuppSettings> | null;
		this.settings = migrateSettings(
			Object.assign({}, DEFAULT_SETTINGS, raw ?? {}),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
