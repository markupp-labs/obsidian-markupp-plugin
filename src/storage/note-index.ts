import type { MarkuppSettings, NoteMeta } from "../settings";

export function getNoteMeta(
	settings: MarkuppSettings,
	path: string,
): NoteMeta | undefined {
	return settings.notes[path];
}

export function setNoteMeta(
	settings: MarkuppSettings,
	path: string,
	meta: NoteMeta,
): void {
	settings.notes[path] = { ...meta, path };
}

export function removeNoteMeta(
	settings: MarkuppSettings,
	path: string,
): void {
	delete settings.notes[path];
}

export function markTombstone(
	settings: MarkuppSettings,
	path: string,
): void {
	const meta = settings.notes[path];
	if (!meta) return;
	meta.tombstone = true;
}

export function renameNote(
	settings: MarkuppSettings,
	oldPath: string,
	newPath: string,
): void {
	const meta = settings.notes[oldPath];
	if (!meta) return;
	settings.notes[newPath] = { ...meta, path: newPath };
	delete settings.notes[oldPath];
}

export function listMetas(settings: MarkuppSettings): NoteMeta[] {
	return Object.values(settings.notes);
}
