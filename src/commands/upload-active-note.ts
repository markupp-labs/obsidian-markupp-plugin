import { MarkdownView, Notice, Plugin } from "obsidian";
import { createNote, MarkuppApiError } from "../api/client";
import { MarkuppSettings } from "../settings";

export async function uploadActiveNote(
	plugin: Plugin,
	settings: MarkuppSettings,
): Promise<void> {
	const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
	if (!view || !view.file) {
		new Notice("Nenhuma nota ativa");
		return;
	}

	const file = view.file;
	const path = file.path;

	try {
		const content = await plugin.app.vault.read(file);
		await createNote(settings.backendUrl, path, content);
		new Notice(`Nota enviada: ${path}`);
	} catch (err) {
		new Notice(buildErrorMessage(err, settings.backendUrl));
	}
}

function buildErrorMessage(err: unknown, backendUrl: string): string {
	if (err instanceof MarkuppApiError) {
		switch (err.code) {
			case "invalid_path":
				return `Caminho inválido: ${err.message}`;
			case "invalid_content":
				return `Conteúdo inválido: ${err.message}`;
			case "duplicate_path":
				return "Nota já existe no servidor. Atualização ainda não suportada.";
			default:
				return `Erro do servidor (${err.status}): ${err.message}`;
		}
	}
	return `Não foi possível conectar a ${backendUrl}. Verifique se o backend está rodando.`;
}
