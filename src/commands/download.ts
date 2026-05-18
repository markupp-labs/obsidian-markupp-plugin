import { MarkdownView, Notice, Plugin } from "obsidian";
import { getNote, MarkuppApiError } from "../api/client";
import { MarkuppSettings } from "../settings";
import {
	getNoteMeta,
	removeNoteMeta,
	setNoteMeta,
} from "../storage/note-index";

export async function downloadActiveNote(
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

	if (!meta) {
		new Notice("Nota nunca sincronizada — envie ela primeiro.");
		return;
	}

	try {
		const note = await getNote(settings.backendUrl, meta.id);
		await plugin.app.vault.modify(file, note.content);

		setNoteMeta(settings, path, {
			id: note.id,
			serverUpdatedAt: note.updated_at,
			localMtimeAtSync: file.stat.mtime,
		});
		await plugin.saveData(settings);
		new Notice(`Nota baixada: ${path}`);
	} catch (err) {
		if (
			err instanceof MarkuppApiError &&
			(err.code === "not_found" || err.code === "invalid_id")
		) {
			removeNoteMeta(settings, path);
			await plugin.saveData(settings);
		}
		new Notice(buildErrorMessage(err, settings.backendUrl));
	}
}

function buildErrorMessage(err: unknown, backendUrl: string): string {
	if (err instanceof MarkuppApiError) {
		switch (err.code) {
			case "not_found":
				return "Servidor não tem mais essa nota — referência local removida.";
			case "invalid_id":
				return "Id inválido no servidor — referência local removida.";
			default:
				return `Erro do servidor (${err.status}): ${err.message}`;
		}
	}
	return `Não foi possível conectar a ${backendUrl}. Verifique se o backend está rodando.`;
}
