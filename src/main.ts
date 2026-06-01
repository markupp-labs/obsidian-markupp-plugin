import { Plugin, TAbstractFile, WorkspaceLeaf } from "obsidian";
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
	SourceControlView,
	VIEW_TYPE_MARKUPP_SCV,
} from "./ui/sourceControl/view";
import {
	getNoteMeta,
	markTombstone,
	renameNote,
} from "./storage/note-index";

export default class MarkuppPlugin extends Plugin {
	settings!: MarkuppSettings;

	async onload() {
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_MARKUPP_SCV,
			(leaf: WorkspaceLeaf) => new SourceControlView(leaf, this),
		);

		this.addRibbonIcon("square-arrow-up", "Markupp", () => this.activateView());

		this.addCommand({
			id: "markupp-status",
			name: "Abrir source control",
			callback: () => this.activateView(),
		});
		this.addCommand({
			id: "markupp-fetch",
			name: "Fetch",
			callback: async () => {
				await fetchRemote(this, this.settings);
				notifyResult("fetch", {});
				this.refreshView();
			},
		});
		this.addCommand({
			id: "markupp-pull",
			name: "Pull",
			callback: async () => {
				const r = await pull(this, this.settings);
				notifyResult("pull", r);
				this.refreshView();
			},
		});
		this.addCommand({
			id: "markupp-push",
			name: "Push",
			callback: async () => {
				const r = await push(this, this.settings);
				notifyResult("push", r);
				this.refreshView();
			},
		});
		this.addCommand({
			id: "markupp-sync",
			name: "Sync (fetch + pull + push)",
			callback: async () => {
				const r = await sync(this, this.settings);
				notifyResult("sync", r);
				this.refreshView();
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
					this.refreshView();
				},
			),
		);

		this.registerEvent(
			this.app.vault.on("delete", async (file: TAbstractFile) => {
				if (!getNoteMeta(this.settings, file.path)) return;
				markTombstone(this.settings, file.path);
				await this.saveSettings();
				this.refreshView();
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

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_MARKUPP_SCV);
		if (existing[0]) {
			await workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: VIEW_TYPE_MARKUPP_SCV, active: true });
		await workspace.revealLeaf(leaf);
	}

	private refreshView(): void {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MARKUPP_SCV);
		for (const leaf of leaves) {
			const view = leaf.view as SourceControlView | undefined;
			if (view && typeof view.render === "function") view.render();
		}
	}
}
