import { MarkdownView, Notice, Plugin } from "obsidian";
import { getNote, MarkuppApiError, updateNote } from "../api/client";
import { MarkuppSettings } from "../settings";
import {
	getNoteMeta,
	removeNoteMeta,
	setNoteMeta,
} from "../storage/note-index";
import { uploadActiveNote } from "./upload";

export async function syncActiveNote(
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
		return uploadActiveNote(plugin, settings);
	}

	try {
		const serverNote = await getNote(settings.backendUrl, meta.id);

		const serverChanged = serverNote.updated_at !== meta.serverUpdatedAt;
		const localChanged = file.stat.mtime !== meta.localMtimeAtSync;

		if (!serverChanged && !localChanged) {
			new Notice("Já sincronizado.");
			return;
		}

		if (serverChanged && !localChanged) {
			await plugin.app.vault.modify(file, serverNote.content);
			setNoteMeta(settings, path, {
				id: serverNote.id,
				serverUpdatedAt: serverNote.updated_at,
				localMtimeAtSync: file.stat.mtime,
			});
			await plugin.saveData(settings);
			new Notice(`Atualização do servidor baixada: ${path}`);
			return;
		}

		if (!serverChanged && localChanged) {
			const content = await plugin.app.vault.read(file);
			const note = await updateNote(
				settings.backendUrl,
				meta.id,
				path,
				content,
			);
			setNoteMeta(settings, path, {
				id: note.id,
				serverUpdatedAt: note.updated_at,
				localMtimeAtSync: file.stat.mtime,
			});
			await plugin.saveData(settings);
			new Notice(`Alterações locais enviadas: ${path}`);
			return;
		}

		new Notice(
			"Conflito: nota mudou nos dois lados desde a última sync. Use 'Subir' ou 'Baixar' para escolher.",
		);
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
				return "Servidor não tem mais essa nota — referência local removida. Use Subir para recriar.";
			case "invalid_id":
				return "Id inválido no servidor — referência local removida.";
			case "invalid_path":
				return `Caminho inválido: ${err.message}`;
			case "invalid_content":
				return `Conteúdo inválido: ${err.message}`;
			default:
				return `Erro do servidor (${err.status}): ${err.message}`;
		}
	}
	return `Não foi possível conectar a ${backendUrl}. Verifique se o backend está rodando.`;
}
