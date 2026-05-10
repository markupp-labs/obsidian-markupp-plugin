import { Notice, Plugin } from "obsidian";
import { listNotes, MarkuppApiError } from "../api/client";
import { MarkuppSettings } from "../settings";
import { setNoteMeta } from "../storage/note-index";

export async function importFromServer(
	plugin: Plugin,
	settings: MarkuppSettings,
): Promise<void> {
	let serverNotes;
	try {
		serverNotes = await listNotes(settings.backendUrl);
	} catch (err) {
		new Notice(buildErrorMessage(err, settings.backendUrl));
		return;
	}

	let importadas = 0;
	let ignoradas = 0;
	let erros = 0;

	for (const nota of serverNotes) {
		try {
			if (plugin.app.vault.getAbstractFileByPath(nota.path)) {
				ignoradas++;
				continue;
			}

			const lastSlash = nota.path.lastIndexOf("/");
			if (lastSlash > 0) {
				const folder = nota.path.slice(0, lastSlash);
				if (!plugin.app.vault.getAbstractFileByPath(folder)) {
					await plugin.app.vault.createFolder(folder);
				}
			}

			const file = await plugin.app.vault.create(nota.path, nota.content);
			setNoteMeta(settings, nota.path, {
				id: nota.id,
				serverUpdatedAt: nota.updated_at,
				localMtimeAtSync: file.stat.mtime,
			});
			importadas++;
		} catch {
			erros++;
		}
	}

	if (importadas > 0) {
		await plugin.saveData(settings);
	}

	let msg = `Importadas: ${importadas}`;
	if (ignoradas > 0) msg += `. Já existiam localmente: ${ignoradas}`;
	if (erros > 0) msg += `. Erros: ${erros}`;
	new Notice(msg);
}

function buildErrorMessage(err: unknown, backendUrl: string): string {
	if (err instanceof MarkuppApiError) {
		return `Erro do servidor (${err.status}): ${err.message}`;
	}
	return `Não foi possível conectar a ${backendUrl}. Verifique se o backend está rodando.`;
}
