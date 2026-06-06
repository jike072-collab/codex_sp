import { api, el, showToast } from "./core.js";

const PROVIDER_KINDS = ["vision", "text", "image"];

function resetSensitiveFields() {
  el("apiSettingsForm").reset();
}

function setFormBusy(value) {
  const button = el("saveApiSettingsButton");
  button.disabled = value;
  button.textContent = value ? "正在保存..." : "保存 API 设置";
}

function renderProviderStatus(providers = {}) {
  PROVIDER_KINDS.forEach((kind) => {
    const provider = providers[kind] || {};
    const details = [provider.provider, provider.model].filter(Boolean).join(" · ");
    const stateElement = el(`${kind}ProviderState`);

    el(`${kind}ProviderDetails`).textContent = details || "状态不可用";
    stateElement.textContent = provider.configured ? "已配置" : "未配置";
    stateElement.classList.toggle("configured", Boolean(provider.configured));
    stateElement.classList.toggle("unconfigured", !provider.configured);
    stateElement.classList.remove("loading");
  });
}

function renderLoadingState() {
  PROVIDER_KINDS.forEach((kind) => {
    el(`${kind}ProviderDetails`).textContent = "正在读取...";
    const stateElement = el(`${kind}ProviderState`);
    stateElement.textContent = "读取中";
    stateElement.className = "provider-state loading";
  });
}

export async function refreshProviderSettings() {
  const data = await api("/api/settings/providers");
  renderProviderStatus(data.providers);
}

export async function openProviderSettings() {
  resetSensitiveFields();
  renderLoadingState();
  el("apiSettingsNote").textContent = "留空不会覆盖当前配置；勾选清除会删除对应的本地 Key。";
  el("apiSettingsDialog").showModal();

  try {
    await refreshProviderSettings();
  } catch (error) {
    showToast(error.message);
    el("apiSettingsNote").textContent = "无法读取当前配置，请确认本地服务正在运行。";
  }
}

export function closeProviderSettings() {
  resetSensitiveFields();
  el("apiSettingsDialog").close();
}

export function clearProviderSettingsInputs() {
  resetSensitiveFields();
}

export async function saveProviderSettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {};
  const rightCodesApiKey = form.elements.rightCodesApiKey.value.trim();
  const deepSeekApiKey = form.elements.deepSeekApiKey.value.trim();

  if (form.elements.clearRightCodesApiKey.checked) {
    payload.rightCodesApiKey = null;
  } else if (rightCodesApiKey) {
    payload.rightCodesApiKey = rightCodesApiKey;
  }

  if (form.elements.clearDeepSeekApiKey.checked) {
    payload.deepSeekApiKey = null;
  } else if (deepSeekApiKey) {
    payload.deepSeekApiKey = deepSeekApiKey;
  }

  setFormBusy(true);
  try {
    await api("/api/settings/providers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    resetSensitiveFields();
    await refreshProviderSettings();
    el("apiSettingsNote").textContent = "设置已保存。留空仍表示不修改当前配置。";
    showToast("API 设置已保存。");
  } catch (error) {
    showToast(error.message);
  } finally {
    setFormBusy(false);
  }
}
