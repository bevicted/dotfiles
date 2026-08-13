import * as path from "node:path";
import { fileURLToPath } from "node:url";

/** Extensions explicitly loaded into isolated Research child processes. */
export function isolatedChildExtensions(): string[] {
	const directory = path.dirname(fileURLToPath(import.meta.url));
	return [
		path.join(directory, "index.ts"),
		path.join(directory, "..", "web-fetch", "index.ts"),
		path.join(directory, "..", "web-search", "index.ts"),
	];
}

export function childExtensionArgs(isResearch: boolean): string[] {
	return isResearch
		? [
				"--no-extensions",
				...isolatedChildExtensions().flatMap((extension) => [
					"--extension",
					extension,
				]),
			]
		: [];
}
