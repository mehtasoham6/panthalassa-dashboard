import { runModel, type ModelInputs, type ModelResult } from "../../model/index.js";

/**
 * Runs the (unmodified) calculation engine off the main thread. The
 * chip-failure renewal recursion can take up to ~150ms at high failure
 * rates; keeping that off the main thread is what keeps slider dragging
 * itself responsive regardless of how expensive a given input combination
 * is to compute.
 */

export interface WorkerRequest {
  type: "compute";
  requestId: number;
  inputs: ModelInputs;
}

export type WorkerResponse =
  | { type: "result"; requestId: number; result: ModelResult }
  | { type: "error"; requestId: number; message: string };

// Typed structurally rather than via the "webworker" lib, so this file can
// live in the same TypeScript project as the DOM-facing app code without a
// lib-conflict (WebWorker and DOM globals both declare things like `self`).
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse) => void;
};

ctx.onmessage = (e) => {
  const { requestId, inputs } = e.data;
  try {
    const result = runModel(inputs);
    ctx.postMessage({ type: "result", requestId, result });
  } catch (err) {
    ctx.postMessage({ type: "error", requestId, message: err instanceof Error ? err.message : String(err) });
  }
};
