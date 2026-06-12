import { api, el, state } from "./core.js";

const PROVIDER_KINDS = ["vision", "text", "image"];

function renderProviderStatus({ providers = {}, configuredCount = 0, total = PROVIDER_KINDS.length } = {}) {
  state.providerStatus = providers;
  const panelApiState = el("panelApiState");
  if (panelApiState) panelApiState.textContent = `${configuredCount}/${total} 已配置`;
}

export async function refreshProviderSettings() {
  renderProviderStatus(await api("/api/settings/providers/status"));
}
