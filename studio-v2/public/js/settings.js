import { api, el, state } from "./core.js";

const PROVIDER_KINDS = ["vision", "text", "image"];

function renderProviderStatus({ providers = {}, configuredCount = 0, total = PROVIDER_KINDS.length } = {}) {
  state.providerStatus = providers;
  const panelApiState = el("panelApiState");
  if (!panelApiState) return;
  panelApiState.textContent = configuredCount >= total
    ? "服务已连接"
    : "本地演示可用";
}

export async function refreshProviderSettings() {
  renderProviderStatus(await api("/api/settings/providers/status"));
}
