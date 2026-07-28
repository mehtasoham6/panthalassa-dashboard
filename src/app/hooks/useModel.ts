import { useEffect, useRef, useState } from "react";
import { runModel, DEFAULT_INPUTS, type ModelInputs, type ModelResult } from "../../model/index.js";
import type { WorkerRequest, WorkerResponse } from "../worker/modelWorker.js";

/**
 * Debounces slider input, then hands the (unmodified) calculation engine off
 * to a Web Worker. The chip-failure renewal recursion can take up to ~150ms
 * at high failure rates -- running that on the main thread would freeze
 * slider dragging itself for that long. Off-thread, the slider stays fluid
 * and the results tiles just update a beat later.
 */
export function useModel(debounceMs = 120) {
  const [inputs, setInputs] = useState<ModelInputs>(DEFAULT_INPUTS);
  const [debounced, setDebounced] = useState<ModelInputs>(DEFAULT_INPUTS);
  // Synchronous first paint (defaults are cheap) so there's no initial loading flash.
  const [result, setResult] = useState<ModelResult>(() => runModel(DEFAULT_INPUTS));
  const [isComputing, setIsComputing] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const worker = new Worker(new URL("../worker/modelWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.requestId !== requestIdRef.current) return; // superseded by a newer request; discard
      setIsComputing(false);
      if (msg.type === "result") {
        setResult(msg.result);
      } else {
        console.error("Model worker error:", msg.message);
      }
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(inputs), debounceMs);
    return () => clearTimeout(id);
  }, [inputs, debounceMs]);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    const requestId = ++requestIdRef.current;
    setIsComputing(true);
    const message: WorkerRequest = { type: "compute", requestId, inputs: debounced };
    worker.postMessage(message);
  }, [debounced]);

  const setInput = (key: keyof ModelInputs, value: number) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const resetAll = () => setInputs(DEFAULT_INPUTS);

  const isPending = inputs !== debounced || isComputing;

  return { inputs, setInput, resetAll, result, isPending };
}
