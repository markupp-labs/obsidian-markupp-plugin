import { App, PluginSettingTab, Setting } from "obsidian";
import MarkuppPlugin from "./main";

export interface MarkuppSettings {
	serverUrl: string;
}

export const DEFAULT_SETTINGS: MarkuppSettings = {
	serverUrl: "http://localhost:8080",
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
