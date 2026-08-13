import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Api, ApiStreamOptions, Context, Model, Provider, SimpleStreamOptions } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const file = process.env.TASK02_CAPTURE_FILE;
const phase = process.env.TASK02_PHASE;
const CAPTURED_PROVIDER = Symbol("task02.capture.provider");
let sequence = 0;

type CaptureAPI = Pick<ExtensionAPI, "on" | "registerProvider">;
type ProviderContext = { model?: Model<Api>; modelRegistry: { getProvider(provider: string): Provider | undefined } };

function record(kind: "pre_terminal_context" | "terminal_transport_payload", value: unknown): void {
	if (!file || !phase) throw new Error("TASK02_CAPTURE_FILE and TASK02_PHASE are required");
	mkdirSync(dirname(file), { recursive: true });
	appendFileSync(file, `${JSON.stringify({ sequence: ++sequence, phase, kind, value })}\n`, "utf8");
}

/**
 * Capture is loaded before subagent. It wraps the native provider first; the
 * subagent's terminal guard then wraps this proxy. The callback records only
 * after that outer guard resolves, which is the exact transport payload.
 */
export function registerTerminalCapture(pi: CaptureAPI): void {
	const wrappers = new WeakMap<Provider, Provider>();
	const wrapProvider = (provider: Provider): Provider => {
		const existing = wrappers.get(provider);
		if (existing) return existing;
		const methods = new Map<PropertyKey, { source: unknown; bound: unknown }>();
		const captureOptions = <T extends Api>(options: ApiStreamOptions<T> | undefined): ApiStreamOptions<T> => {
			const originalOnPayload = options?.onPayload;
			return new Proxy(options ?? {}, {
				get(target, property) {
					const source = Reflect.get(target, property, target);
					if (property === "onPayload") return async (payload: unknown, model: Model<T>) => {
						const transformed = await originalOnPayload?.call(target, payload, model);
						const terminal = transformed === undefined ? payload : transformed;
						record("terminal_transport_payload", { payload: terminal });
						return terminal;
					};
					if (typeof source !== "function") return source;
					const cached = methods.get(property);
					if (cached?.source === source) return cached.bound;
					const bound = source.bind(target);
					methods.set(property, { source, bound });
					return bound;
				},
			});
		};
		const captureSimpleOptions = (options: SimpleStreamOptions | undefined): SimpleStreamOptions => captureOptions(options as ApiStreamOptions<Api> | undefined) as SimpleStreamOptions;
		const guarded = new Proxy(provider, {
			get(target, property) {
				if (property === CAPTURED_PROVIDER) return true;
				if (property === "stream") return <T extends Api>(model: Model<T>, context: Context, options?: ApiStreamOptions<T>) => target.stream(model, context, captureOptions(options));
				if (property === "streamSimple") return (model: Model<Api>, context: Context, options?: SimpleStreamOptions) => target.streamSimple(model, context, captureSimpleOptions(options));
				const value = Reflect.get(target, property, target);
				if (typeof value !== "function") return value;
				const cached = methods.get(property);
				if (cached?.source === value) return cached.bound;
				const bound = value.bind(target);
				methods.set(property, { source: value, bound });
				return bound;
			},
		});
		wrappers.set(provider, guarded);
		return guarded;
	};
	const wrapActiveProvider = (ctx: ProviderContext) => {
		const providerId = ctx.model?.provider;
		if (!providerId) return;
		const provider = ctx.modelRegistry.getProvider(providerId);
		if (!provider || (provider as Record<PropertyKey, unknown>)[CAPTURED_PROVIDER]) return;
		pi.registerProvider?.(wrapProvider(provider));
	};
	pi.on("context", (event) => record("pre_terminal_context", { messages: event.messages }));
	pi.on("session_start", (_event, ctx) => wrapActiveProvider(ctx));
	pi.on("model_select", (_event, ctx) => wrapActiveProvider(ctx));
}

export default function capture(pi: ExtensionAPI) {
	registerTerminalCapture(pi);
}
