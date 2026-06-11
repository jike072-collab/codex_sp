import { api, el, state } from "./core.js";

const PROVIDER_KINDS = ["vision", "text", "image"];
const PROVIDER_LABELS = {
  vision: "识图",
  text: "脚本",
  image: "图片"
};

function renderProviderStatus({ providers = {}, configuredCount = 0, total = PROVIDER_KINDS.length } = {}) {
  state.providerStatus = providers;
  const missing = PROVIDER_KINDS
    .filter((kind) => !providers[kind]?.configured)
    .map((kind) => PROVIDER_LABELS[kind]);
  const sidebarState = el("sidebarApiState");
  const sidebarDetails = el("sidebarApiDetails");
  const panelApiState = el("panelApiState");
  if (sidebarState) {
    sidebarState.textContent = `供应商就绪 ${configuredCount}/${total}`;
  }
  if (sidebarDetails) {
    sidebarDetails.textContent = missing.length
      ? `待配置：${missing.join("、")}`
      : "识图、脚本、图片供应商均已就绪";
  }
  if (panelApiState) panelApiState.textContent = `${configuredCount}/${total} 已配置`;
}

export async function refreshProviderSettings() {
  renderProviderStatus(await api("/api/settings/providers/status"));
}
