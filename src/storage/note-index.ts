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
	settings.notes[path] = meta;
}

export function removeNoteMeta(
	settings: MarkuppSettings,
	path: string,
): void {
	delete settings.notes[path];
}

export function renameNote(
	settings: MarkuppSettings,
	oldPath: string,
	newPath: string,
): void {
	const meta = settings.notes[oldPath];
	if (!meta) return;
	settings.notes[newPath] = meta;
	delete settings.notes[oldPath];
}
