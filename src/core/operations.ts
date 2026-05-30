import { Notice, Plugin, TFile } from "obsidian";
import {
	createNote,
	deleteNote,
	getNote,
	listNotes,
	updateNote,
} from "../api/client";
import { MarkuppSettings, RemoteEntry } from "../settings";
import {
	getNoteMeta,
	removeNoteMeta,
	setNoteMeta,
} from "../storage/note-index";
import { collectLocalFiles, computeStatus, StatusEntry } from "./status";

type PluginLike = Plugin & {
	saveData(data: MarkuppSettings): Promise<void>;
};

export async function fetchRemote(
	plugin: PluginLike,
	settings: MarkuppSettings,
): Promise<void> {
	const notes = await listNotes(settings.serverUrl);
	const remote: Record<string, RemoteEntry> = {};
	for (const n of notes) {
		remote[n.path] = { id: n.id, path: n.path, updatedAt: n.updated_at };
	}
	settings.lastFetch = { at: new Date().toISOString(), remote };
	await plugin.saveData(settings);
}

export function currentStatus(
	plugin: PluginLike,
	settings: MarkuppSettings,
): StatusEntry[] {
	return computeStatus(collectLocalFiles(plugin.app), settings);
}

export async function pull(
	plugin: PluginLike,
	settings: MarkuppSettings,
	entries?: StatusEntry[],
): Promise<{ applied: number; skipped: number }> {
	const all = entries ?? currentStatus(plugin, settings);
	let applied = 0;
	let skipped = 0;

	for (const e of all) {
		switch (e.kind) {
			case "new_remote":
				await applyNewRemote(plugin, settings, e);
				applied++;
				break;
			case "modified_remote":
				await applyModifiedRemote(plugin, settings, e);
				applied++;
				break;
			case "deleted_remote":
				await applyDeletedRemote(plugin, settings, e);
				applied++;
				break;
			case "deleted_local":
				// Nota deletada localmente mas ainda no servidor: pull traz a
				// cópia do servidor de volta (push é quem confirma a exclusão).
				await applyNewRemote(plugin, settings, e);
				applied++;
				break;
			case "conflict":
				skipped++;
				break;
			default:
				break;
		}
	}

	await plugin.saveData(settings);
	return { applied, skipped };
}

export async function push(
	plugin: PluginLike,
	settings: MarkuppSettings,
	entries?: StatusEntry[],
): Promise<{ applied: number; skipped: number }> {
	const all = entries ?? currentStatus(plugin, settings);
	let applied = 0;
	let skipped = 0;

	for (const e of all) {
		switch (e.kind) {
			case "new_local":
				await applyNewLocal(plugin, settings, e);
				applied++;
				break;
			case "modified_local":
				await applyModifiedLocal(plugin, settings, e);
				applied++;
				break;
			case "deleted_local":
				await applyDeletedLocal(plugin, settings, e);
				applied++;
				break;
			case "conflict":
				skipped++;
				break;
			default:
				break;
		}
	}

	await plugin.saveData(settings);
	return { applied, skipped };
}

export async function sync(
	plugin: PluginLike,
	settings: MarkuppSettings,
): Promise<{ pulled: number; pushed: number; conflicts: number }> {
	await fetchRemote(plugin, settings);
	const pulled = await pull(plugin, settings);
	const pushed = await push(plugin, settings);
	return {
		pulled: pulled.applied,
		pushed: pushed.applied,
		conflicts: pulled.skipped,
	};
}

export async function forcePull(
	plugin: PluginLike,
	settings: MarkuppSettings,
	path: string,
): Promise<void> {
	const remote = settings.lastFetch?.remote[path];
	if (!remote) {
		await applyDeletedRemote(plugin, settings, {
			path,
			id: getNoteMeta(settings, path)?.id,
			kind: "deleted_remote",
		});
	} else {
		const note = await getNote(settings.serverUrl, remote.id);
		await writeFile(plugin, path, note.content);
		const file = plugin.app.vault.getAbstractFileByPath(path) as TFile | null;
		setNoteMeta(settings, path, {
			id: note.id,
			path,
			serverUpdatedAt: note.updated_at,
			localMtimeAtSync: file?.stat.mtime ?? 0,
		});
	}
	await plugin.saveData(settings);
}

export async function forcePush(
	plugin: PluginLike,
	settings: MarkuppSettings,
	path: string,
): Promise<void> {
	const meta = getNoteMeta(settings, path);
	const file = plugin.app.vault.getAbstractFileByPath(path) as TFile | null;

	if (!file) {
		if (meta?.id) {
			try {
				await deleteNote(settings.serverUrl, meta.id);
			} catch {
				// ignore
			}
			removeNoteMeta(settings, path);
			if (settings.lastFetch) delete settings.lastFetch.remote[path];
		}
	} else {
		const content = await plugin.app.vault.read(file);
		if (meta?.id && !meta.tombstone) {
			const note = await updateNote(settings.serverUrl, meta.id, path, content);
			setNoteMeta(settings, path, {
				id: note.id,
				path,
				serverUpdatedAt: note.updated_at,
				localMtimeAtSync: file.stat.mtime,
			});
			syncRemoteSnapshot(settings, path, note.id, note.updated_at);
		} else {
			const note = await createNote(settings.serverUrl, path, content);
			setNoteMeta(settings, path, {
				id: note.id,
				path,
				serverUpdatedAt: note.updated_at,
				localMtimeAtSync: file.stat.mtime,
			});
			syncRemoteSnapshot(settings, path, note.id, note.updated_at);
		}
	}
	await plugin.saveData(settings);
}

/**
 * Mantém o snapshot `lastFetch.remote` coerente com o que o servidor acabou de
 * confirmar num push, evitando que a próxima leitura de status acuse a nota
 * recém-enviada como modificada/deletada remotamente.
 */
function syncRemoteSnapshot(
	settings: MarkuppSettings,
	path: string,
	id: string,
	updatedAt: string,
): void {
	if (!settings.lastFetch) return;
	settings.lastFetch.remote[path] = { id, path, updatedAt };
}

async function applyNewLocal(
	plugin: PluginLike,
	settings: MarkuppSettings,
	e: StatusEntry,
): Promise<void> {
	const file = plugin.app.vault.getAbstractFileByPath(e.path) as TFile | null;
	if (!file) return;
	const content = await plugin.app.vault.read(file);
	const note = await createNote(settings.serverUrl, e.path, content);
	setNoteMeta(settings, e.path, {
		id: note.id,
		path: e.path,
		serverUpdatedAt: note.updated_at,
		localMtimeAtSync: file.stat.mtime,
	});
	syncRemoteSnapshot(settings, e.path, note.id, note.updated_at);
}

async function applyModifiedLocal(
	plugin: PluginLike,
	settings: MarkuppSettings,
	e: StatusEntry,
): Promise<void> {
	const meta = getNoteMeta(settings, e.path);
	if (!meta) return;
	const file = plugin.app.vault.getAbstractFileByPath(e.path) as TFile | null;
	if (!file) return;
	const content = await plugin.app.vault.read(file);
	const note = await updateNote(settings.serverUrl, meta.id, e.path, content);
	setNoteMeta(settings, e.path, {
		id: note.id,
		path: e.path,
		serverUpdatedAt: note.updated_at,
		localMtimeAtSync: file.stat.mtime,
	});
	syncRemoteSnapshot(settings, e.path, note.id, note.updated_at);
}

async function applyDeletedLocal(
	plugin: PluginLike,
	settings: MarkuppSettings,
	e: StatusEntry,
): Promise<void> {
	const meta = getNoteMeta(settings, e.path);
	if (!meta) return;
	try {
		await deleteNote(settings.serverUrl, meta.id);
	} catch (err) {
		// tolerate already-gone
		console.error("Markupp deleteNote", err);
	}
	removeNoteMeta(settings, e.path);
	if (settings.lastFetch) delete settings.lastFetch.remote[e.path];
}

async function applyNewRemote(
	plugin: PluginLike,
	settings: MarkuppSettings,
	e: StatusEntry,
): Promise<void> {
	if (!e.id) return;
	const note = await getNote(settings.serverUrl, e.id);
	await writeFile(plugin, e.path, note.content);
	const file = plugin.app.vault.getAbstractFileByPath(e.path) as TFile | null;
	setNoteMeta(settings, e.path, {
		id: note.id,
		path: e.path,
		serverUpdatedAt: note.updated_at,
		localMtimeAtSync: file?.stat.mtime ?? 0,
	});
}

async function applyModifiedRemote(
	plugin: PluginLike,
	settings: MarkuppSettings,
	e: StatusEntry,
): Promise<void> {
	if (!e.id) return;
	const note = await getNote(settings.serverUrl, e.id);
	const file = plugin.app.vault.getAbstractFileByPath(e.path) as TFile | null;
	if (file) {
		await plugin.app.vault.modify(file, note.content);
	} else {
		await writeFile(plugin, e.path, note.content);
	}
	const fresh = plugin.app.vault.getAbstractFileByPath(e.path) as TFile | null;
	setNoteMeta(settings, e.path, {
		id: note.id,
		path: e.path,
		serverUpdatedAt: note.updated_at,
		localMtimeAtSync: fresh?.stat.mtime ?? 0,
	});
}

async function applyDeletedRemote(
	plugin: PluginLike,
	settings: MarkuppSettings,
	e: StatusEntry,
): Promise<void> {
	const file = plugin.app.vault.getAbstractFileByPath(e.path) as TFile | null;
	if (file) {
		const vault = plugin.app.vault as unknown as {
			delete?: (f: TFile) => Promise<void>;
			trash?: (f: TFile, system: boolean) => Promise<void>;
		};
		if (vault.trash) {
			await vault.trash(file, false);
		} else if (vault.delete) {
			await vault.delete(file);
		}
	}
	removeNoteMeta(settings, e.path);
}

async function writeFile(
	plugin: PluginLike,
	path: string,
	content: string,
): Promise<void> {
	const slash = path.lastIndexOf("/");
	if (slash > 0) {
		const dir = path.slice(0, slash);
		try {
			await plugin.app.vault.createFolder(dir);
		} catch {
			// folder may already exist
		}
	}
	const existing = plugin.app.vault.getAbstractFileByPath(path) as TFile | null;
	if (existing) {
		await plugin.app.vault.modify(existing, content);
	} else {
		await plugin.app.vault.create(path, content);
	}
}

export function notifyResult(
	op: "fetch" | "pull" | "push" | "sync",
	result: { applied?: number; skipped?: number; pulled?: number; pushed?: number; conflicts?: number },
): void {
	if (op === "fetch") {
		new Notice("Markupp: fetch concluído.");
		return;
	}
	if (op === "sync") {
		const r = result as { pulled: number; pushed: number; conflicts: number };
		new Notice(
			`Markupp sync: ${r.pulled} baixadas, ${r.pushed} enviadas, ${r.conflicts} conflitos.`,
		);
		return;
	}
	const r = result as { applied: number; skipped: number };
	new Notice(`Markupp ${op}: ${r.applied} aplicadas, ${r.skipped} conflitos.`);
}
