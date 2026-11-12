/** Minimal, versioned contract for isolated tool adapters. */
export const TOOL_ADAPTER_API_VERSION = 1;

export function defineToolAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object') throw new TypeError('Adapter must be an object');
  const {manifest, doctor, probeCapabilities, run} = adapter;
  if (!manifest?.id || !manifest?.version || !manifest?.status) throw new TypeError('Adapter manifest requires id, version, and status');
  for (const [name, fn] of Object.entries({doctor, probeCapabilities, run})) {
    if (typeof fn !== 'function') throw new TypeError(`Adapter ${manifest.id} requires ${name}()`);
  }
  return Object.freeze({...adapter, apiVersion: TOOL_ADAPTER_API_VERSION});
}
