import { App, PluginSettingTab, Setting } from "obsidian";
import MarkuppPlugin from "./main";

export type NoteMeta = {
	id: string;
	serverUpdatedAt: string;
	localMtimeAtSync: number;
};

export interface MarkuppSettings {
	backendUrl: string;
	notes: Record<string, NoteMeta>;
}

export const DEFAULT_SETTINGS: MarkuppSettings = {
	backendUrl: "http://localhost:8080",
	notes: {},
};

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
			.setName("Backend URL")
			.setDesc("Endereço do servidor Markupp para onde as notas serão enviadas.")
			.addText((text) =>
				text
					.setPlaceholder("http://localhost:8080")
					.setValue(this.plugin.settings.backendUrl)
					.onChange(async (value) => {
						this.plugin.settings.backendUrl = value.trim();
						await this.plugin.saveSettings();
					}),
			);
	}
}
