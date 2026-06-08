import { App, PluginSettingTab, Setting } from "obsidian";
import MarkuppPlugin from "./main";

export type NoteMeta = {
	id: string;
	path: string;
	serverUpdatedAt: string;
	localMtimeAtSync: number;
	tombstone?: boolean;
};

export type RemoteEntry = {
	id: string;
	path: string;
	updatedAt: string;
};

export type LastFetch = {
	at: string;
	remote: Record<string, RemoteEntry>;
};

export interface MarkuppSettings {
	serverUrl: string;
	notes: Record<string, NoteMeta>;
	lastFetch?: LastFetch;
}

export const DEFAULT_SETTINGS: MarkuppSettings = {
	serverUrl: "http://localhost:8080",
	notes: {},
};

export function migrateSettings(settings: MarkuppSettings): MarkuppSettings {
	for (const [key, meta] of Object.entries(settings.notes)) {
		if (!meta.path) {
			meta.path = key;
		}
	}
	return settings;
}

export class MarkuppSettingTab extends PluginSettingTab {
	plugin: MarkuppPlugin;

	constructor(app: App, plugin: MarkuppPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("URL do servidor")
			.setDesc("Endereço do servidor Markupp para onde as notas serão enviadas.")
			.addText((text) =>
				text
					.setPlaceholder("http://localhost:8080")
					.setValue(this.plugin.settings.serverUrl)
					.onChange(async (value) => {
						this.plugin.settings.serverUrl = value.trim();
						await this.plugin.saveSettings();
					}),
			);
	}
}
