import { ItemView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import MarkuppPlugin from "../../main";
import {
	currentStatus,
	fetchRemote,
	forcePull,
	forcePush,
	notifyResult,
	pull,
	push,
	sync,
} from "../../core/operations";
import { StatusEntry, StatusKind } from "../../core/status";

export const VIEW_TYPE_MARKUPP_SCV = "markupp-source-control";

const GROUPS: { title: string; kinds: StatusKind[] }[] = [
	{ title: "Conflitos", kinds: ["conflict"] },
	{
		title: "Modificadas",
		kinds: ["modified_local", "modified_remote"],
	},
	{ title: "Novas", kinds: ["new_local", "new_remote"] },
	{ title: "Deletadas", kinds: ["deleted_local", "deleted_remote"] },
];

const ICON_BY_KIND: Record<StatusKind, string> = {
	new_local: "?",
	new_remote: "A",
	modified_local: "M",
	modified_remote: "M↓",
	deleted_local: "D",
	deleted_remote: "D↓",
	conflict: "C",
};

const LABEL_BY_KIND: Record<StatusKind, string> = {
	new_local: "nova local",
	new_remote: "nova remota",
	modified_local: "modificada local",
	modified_remote: "modificada remota",
	deleted_local: "deletada local",
	deleted_remote: "deletada remota",
	conflict: "conflito",
};

export class SourceControlView extends ItemView {
	private plugin: MarkuppPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: MarkuppPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_MARKUPP_SCV;
	}

	getDisplayText(): string {
		return "Markupp";
	}

	getIcon(): string {
		return "git-branch";
	}

	async onOpen(): Promise<void> {
		this.render();
		this.registerEvent(this.app.vault.on("create", () => this.render()));
		this.registerEvent(this.app.vault.on("modify", () => this.render()));
		this.registerEvent(this.app.vault.on("delete", () => this.render()));
		this.registerEvent(this.app.vault.on("rename", () => this.render()));
	}

	async onClose(): Promise<void> {
		// nothing
	}

	render(): void {
		const root = this.containerEl.children[1] ?? this.containerEl;
		root.empty();
		root.addClass("markupp-scv");

		const header = root.createDiv({ cls: "markupp-scv-header" });
		header.createEl("h4", { text: "Painel de Controle Markupp" });

		const toolbar = root.createDiv({ cls: "markupp-scv-toolbar" });
		this.makeButton(toolbar, "Fetch", async () => {
			await fetchRemote(this.plugin, this.plugin.settings);
			notifyResult("fetch", {});
			this.render();
		});
		this.makeButton(toolbar, "Pull", async () => {
			const r = await pull(this.plugin, this.plugin.settings);
			notifyResult("pull", r);
			this.render();
		});
		this.makeButton(toolbar, "Push", async () => {
			const r = await push(this.plugin, this.plugin.settings);
			notifyResult("push", r);
			this.render();
		});
		this.makeButton(toolbar, "Sync", async () => {
			const r = await sync(this.plugin, this.plugin.settings);
			notifyResult("sync", r);
			this.render();
		});

		const lastFetch = this.plugin.settings.lastFetch;
		const meta = root.createDiv({ cls: "markupp-scv-meta" });
		meta.setText(
			lastFetch ? `Último fetch: ${lastFetch.at}` : "Sem fetch ainda.",
		);

		let entries: StatusEntry[];
		try {
			entries = currentStatus(this.plugin, this.plugin.settings);
		} catch (err) {
			root.createDiv({
				text: `Erro ao calcular status: ${(err as Error).message}`,
			});
			return;
		}

		if (entries.length === 0) {
			root.createDiv({
				cls: "markupp-scv-empty",
				text: "Tudo sincronizado.",
			});
			return;
		}

		for (const group of GROUPS) {
			const items = entries.filter((e) => group.kinds.includes(e.kind));
			if (items.length === 0) continue;

			const section = root.createDiv({ cls: "markupp-scv-group" });
			section.createEl("h4", { text: `${group.title} (${items.length})` });
			const ul = section.createEl("ul");
			for (const entry of items) {
				this.renderEntry(ul, entry);
			}
		}
	}

	private renderEntry(parent: HTMLElement, entry: StatusEntry): void {
		const li = parent.createEl("li", { cls: "markupp-scv-item" });
		const badge = li.createSpan({ cls: "markupp-scv-badge" });
		badge.setText(ICON_BY_KIND[entry.kind]);
		badge.setAttr("title", LABEL_BY_KIND[entry.kind]);

		const pathSpan = li.createSpan({ cls: "markupp-scv-path" });
		pathSpan.setText(entry.path);
		pathSpan.onclick = () => this.openFile(entry.path);

		const actions = li.createSpan({ cls: "markupp-scv-actions" });

		if (entry.kind === "conflict") {
			this.makeButton(actions, "↓ force", async () => {
				await forcePull(this.plugin, this.plugin.settings, entry.path);
				new Notice(`Force pull: ${entry.path}`);
				this.render();
			});
			this.makeButton(actions, "↑ force", async () => {
				await forcePush(this.plugin, this.plugin.settings, entry.path);
				new Notice(`Force push: ${entry.path}`);
				this.render();
			});
			return;
		}

		const pullable = entry.kind === "new_remote" ||
			entry.kind === "modified_remote" ||
			entry.kind === "deleted_remote" ||
			entry.kind === "deleted_local";
		const pushable = entry.kind === "new_local" ||
			entry.kind === "modified_local" ||
			entry.kind === "deleted_local";

		if (pullable) {
			const btn = this.makeButton(actions, "↓", async () => {
				const r = await pull(this.plugin, this.plugin.settings, [entry]);
				notifyResult("pull", r);
				this.render();
			});
			btn.setAttr(
				"title",
				entry.kind === "deleted_local"
					? "Restaurar do servidor"
					: "Trazer do servidor (pull)",
			);
		}
		if (pushable) {
			const btn = this.makeButton(actions, "↑", async () => {
				const r = await push(this.plugin, this.plugin.settings, [entry]);
				notifyResult("push", r);
				this.render();
			});
			btn.setAttr(
				"title",
				entry.kind === "deleted_local"
					? "Confirmar exclusão no servidor (push)"
					: "Enviar ao servidor (push)",
			);
		}
	}

	private makeButton(
		parent: HTMLElement,
		label: string,
		onClick: () => Promise<void> | void,
	): HTMLButtonElement {
		const btn = parent.createEl("button", { text: label });
		btn.addEventListener("click", () => {
			btn.disabled = true;
			void (async () => {
				try {
					await onClick();
				} catch (err) {
					new Notice(`Markupp: ${(err as Error).message}`);
				} finally {
					btn.disabled = false;
				}
			})();
		});
		return btn;
	}

	private openFile(path: string): void {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			void this.app.workspace.getLeaf(false).openFile(file);
		}
	}
}
