import { MarkdownView, Notice, Plugin } from "obsidian";
import {
	createNote,
	MarkuppApiError,
	updateNote,
} from "../api/client";
import { MarkuppSettings } from "../settings";
import {
	getNoteMeta,
	removeNoteMeta,
	setNoteMeta,
} from "../storage/note-index";

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
	const meta = getNoteMeta(settings, path);

	try {
		const content = await plugin.app.vault.read(file);
		const note = meta
			? await updateNote(settings.serverUrl, meta.id, path, content)
			: await createNote(settings.serverUrl, path, content);

		setNoteMeta(settings, path, {
			id: note.id,
			serverUpdatedAt: note.updated_at,
			localMtimeAtSync: file.stat.mtime,
		});
		await plugin.saveData(settings);
		new Notice(`Nota enviada: ${path}`);
	} catch (err) {
		if (
			err instanceof MarkuppApiError &&
			(err.code === "not_found" || err.code === "invalid_id")
		) {
			removeNoteMeta(settings, path);
			await plugin.saveData(settings);
		}
		new Notice(buildErrorMessage(err, settings.serverUrl));
	}
}

function buildErrorMessage(err: unknown, serverUrl: string): string {
	if (err instanceof MarkuppApiError) {
		switch (err.code) {
			case "not_found":
				return "Servidor não tem mais essa nota — clique Subir de novo para recriar.";
			case "invalid_id":
				return "Id inválido no servidor — referência local removida.";
			case "invalid_path":
				return `Caminho inválido: ${err.message}`;
			case "invalid_content":
				return `Conteúdo inválido: ${err.message}`;
			case "duplicate_path":
				return "Já existe nota com esse caminho no servidor.";
			default:
				return `Erro do servidor (${err.status}): ${err.message}`;
		}
	}
	return `Não foi possível conectar a ${serverUrl}. Verifique se o servidor está rodando.`;
}
