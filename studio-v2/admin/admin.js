const form = document.querySelector("#providerForm");
const providerGrid = document.querySelector("#providerGrid");
const statusEl = document.querySelector("#status");
const saveState = document.querySelector("#saveState");
const refreshButton = document.querySelector("#refreshButton");
const refreshModelsButton = document.querySelector("#refreshModelsButton");

const PROVIDER_TEXT = {
  vision: { title: "商品识图", role: "商品图片分析", channel: "Gemini 通道" },
  text: { title: "广告脚本生成", role: "20 秒广告脚本生成", channel: "对话补全通道" },
  image: { title: "故事板图片生成", role: "参考图驱动的故事板生成", channel: "Draw 绘图通道" }
};
const FIELD_LABELS = {
  apiUrl: "接口地址",
  model: "模型",
  apiKey: "替换密钥"
};
const MODEL_STATUS_TEXT = {
  loading: "读取中",
  ok: "已同步",
  unsupported: "不支持自动读取",
  error: "读取失败"
};

let currentSchema = null;
let modelProviders = {};
let dirty = false;
const profileUiCache = new Map();
const draftModelSyncTokens = new Map();

function setStatus(message, tone = "") {
  statusEl.textContent = message;
  if (tone) statusEl.dataset.tone = tone;
  else delete statusEl.dataset.tone;
}

function setSaveState(message, tone = "") {
  saveState.textContent = message;
  if (tone) saveState.dataset.tone = tone;
  else delete saveState.dataset.tone;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: options.body
      ? { "Content-Type": "application/json", ...(options.headers || {}) }
      : options.headers
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("请求失败");
    error.status = response.status;
    throw error;
  }
  return data;
}

function providerText(provider) {
  return PROVIDER_TEXT[provider.id] || {
    title: provider.title || provider.id,
    role: provider.role || "供应商能力",
    channel: provider.channel || "供应商通道"
  };
}

function channelConfig(provider, channelId) {
  return provider.config?.channels?.find((channel) => channel.id === channelId) || null;
}

function fieldConfig(provider, field) {
  return field.channelId ? channelConfig(provider, field.channelId) : provider.config;
}

function findFieldByValueKey(valueKey) {
  return currentSchema?.providers
    .flatMap((provider) => provider.fields.map((field) => ({ provider, field })))
    .find(({ field }) => field.valueKey === valueKey) || null;
}

function providerFieldByName(provider, name, channelId = "") {
  return provider.fields.find((field) => field.name === name && (channelId ? field.channelId === channelId : !field.channelId)) || null;
}

function profileForSelection(provider, field, apiUrl) {
  const profiles = fieldConfig(provider, field)?.profiles || [];
  return profiles.find((item) => item.value === apiUrl) || null;
}

function profileCacheKey(valueKey, apiUrl) {
  return `${valueKey}::${apiUrl || ""}`;
}

function secretToggleSvg(visible) {
  return visible
    ? `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/>
      </svg>`
    : `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M3 3l18 18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
        <path d="M2.5 12s3.5-6.5 9.5-6.5c1.8 0 3.4.4 4.8 1.1l1.8-1.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8.2 8.2A4.2 4.2 0 0 0 6.5 12c0 3.1 2.5 5.5 5.5 5.5 1.3 0 2.5-.4 3.5-1.1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
}

function cacheProfilePreview(valueKey, apiUrl, profile) {
  if (!valueKey || !apiUrl || !profile) return;
  profileUiCache.set(profileCacheKey(valueKey, apiUrl), { ...profile });
}

function cachedProfileForSelection(provider, field, apiUrl) {
  const cached = profileUiCache.get(profileCacheKey(field.valueKey, apiUrl));
  if (cached) return cached;
  const profile = profileForSelection(provider, field, apiUrl);
  cacheProfilePreview(field.valueKey, apiUrl, profile);
  return profile;
}

function previewTextFromKeyPreview(keyPreview) {
  return keyPreview ? `当前密钥：${keyPreview}` : "该方案还没有保存 Key，请填写后保存";
}

function ensureOption(select, value, label = value) {
  if (!select || !value) return;
  const exists = Array.from(select.options).some((option) => option.value === value);
  if (!exists) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label || value;
    select.append(option);
  }
}

function renderSecretInput(input, wrapper) {
  const shell = document.createElement("div");
  shell.className = "secret-input-shell";
  const toggle = document.createElement("button");
  toggle.className = "secret-toggle";
  toggle.type = "button";
  toggle.dataset.secretToggleFor = input.name;
  toggle.setAttribute("aria-label", "显示 API 密钥");
  toggle.innerHTML = secretToggleSvg(false);
  shell.append(input, toggle);
  wrapper.append(shell);
}

function renderPresetSelect(field, currentValue, wrapper) {
  if (!Array.isArray(field.presets) || !field.presets.length) return;

  const preset = document.createElement("select");
  preset.className = "preset-select";
  preset.dataset.presetFor = field.valueKey;
  preset.dataset.currentPresetValue = currentValue;
  preset.setAttribute("aria-label", `${FIELD_LABELS[field.name] || field.label || field.name}方案`);

  const custom = document.createElement("option");
  custom.value = "";
  custom.textContent = "自定义 / 当前地址";
  preset.append(custom);

  for (const item of field.presets) {
    if (!item?.value) continue;
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label || item.id || item.value;
    option.selected = item.value === currentValue;
    preset.append(option);
  }
  wrapper.append(preset);

  const selected = field.presets.find((item) => item?.value === currentValue);
  const hintText = selected?.hint
    || field.presets.find((item) => String(item?.id || "").startsWith("sub2api"))?.hint
    || "";
  if (hintText) {
    const hint = document.createElement("small");
    hint.className = "preset-hint";
    hint.textContent = hintText;
    wrapper.append(hint);
  }
}

function maskedKeyPreview(provider, field) {
  const preview = String(fieldConfig(provider, field)?.keyPreview || "").trim();
  if (!preview) return "当前未保存可用密钥";
  const suffix = preview.match(/([a-z0-9]{4})\s*$/i)?.[1];
  return suffix ? `当前密钥：•••• ${suffix}` : `当前密钥：${preview}`;
}

function modelState(provider, field = {}) {
  const discovery = modelProviders[provider.id];
  if (!discovery) return { status: "loading", models: [] };
  if (field.channelId) {
    return discovery.channels?.find((channel) => channel.id === field.channelId)
      || { status: discovery.status || "error", models: [] };
  }
  return discovery;
}

function modelOptions(provider, field) {
  const discovery = modelState(provider, field);
  const current = discovery.currentModel || fieldConfig(provider, field)?.model || "";
  const options = discovery.models || [];
  const unique = new Map(options.filter((option) => option?.id).map((option) => [
    option.id,
    { id: option.id, label: option.label || option.id }
  ]));
  if (current && !unique.has(current)) unique.set(current, { id: current, label: current });
  return [...unique.values()];
}

function modelStatusText(discovery) {
  return discovery.message
    ? `模型列表：${discovery.message}`
    : `模型列表：${MODEL_STATUS_TEXT[discovery.status] || "读取失败"}`;
}

function renderModelField(provider, field, wrapper) {
  const select = document.createElement("select");
  select.id = field.valueKey;
  select.name = field.valueKey;
  select.required = true;
  select.dataset.fieldType = "select";
  const discovery = modelState(provider, field);
  const currentModel = discovery.currentModel || fieldConfig(provider, field)?.model || "";
  for (const optionData of modelOptions(provider, field)) {
    const option = document.createElement("option");
    option.value = optionData.id;
    option.textContent = optionData.label;
    option.selected = optionData.id === currentModel;
    select.append(option);
  }
  wrapper.append(select);

  const help = document.createElement("small");
  help.className = "model-status";
  help.dataset.status = discovery.status || "error";
  help.textContent = modelStatusText(discovery);
  wrapper.append(help);
}

function renderInputField(provider, field, wrapper) {
  const currentValue = field.type === "secret" ? "" : fieldConfig(provider, field)?.apiUrl || "";
  renderPresetSelect(field, currentValue, wrapper);

  const input = document.createElement("input");
  input.id = field.valueKey;
  input.name = field.valueKey;
  input.type = field.type === "secret" ? "password" : "url";
  input.value = currentValue;
  input.autocomplete = field.type === "secret" ? "new-password" : "off";
  input.dataset.fieldType = field.type;
  input.placeholder = field.type === "secret" ? "留空表示保持当前密钥" : "";
  if (field.type !== "secret") input.required = true;
  if (field.type === "secret") renderSecretInput(input, wrapper);
  else wrapper.append(input);

  const help = document.createElement("small");
  help.className = field.type === "secret" ? "key-preview" : "";
  if (field.type === "secret") help.dataset.keyPreviewFor = field.valueKey;
  help.textContent = field.type === "secret"
    ? maskedKeyPreview(provider, field)
    : "保存后将用于此供应商的请求。";
  wrapper.append(help);

  if (field.clearable) {
    const clearLabel = document.createElement("label");
    clearLabel.className = "clear-row";
    const clearInput = document.createElement("input");
    clearInput.type = "checkbox";
    clearInput.name = `${field.valueKey}__clear`;
    clearInput.dataset.clearFor = field.valueKey;
    clearLabel.append(clearInput, document.createTextNode("清除已保存密钥（保存后生效）"));
    wrapper.append(clearLabel);
  }
}

function renderField(provider, field) {
  const wrapper = document.createElement("div");
  wrapper.className = "field";
  if (field.channelId) wrapper.dataset.channelId = field.channelId;
  wrapper.dataset.providerId = provider.id;
  wrapper.dataset.valueKey = field.valueKey;
  wrapper.dataset.fieldName = field.name;

  const label = document.createElement("label");
  label.htmlFor = field.valueKey;
  label.textContent = FIELD_LABELS[field.name] || field.label || field.name;
  wrapper.append(label);

  if (field.name === "model" || field.type === "select") {
    renderModelField(provider, field, wrapper);
  } else {
    renderInputField(provider, field, wrapper);
  }
  return wrapper;
}

function syncPresetSelection(presetSelect) {
  const valueKey = presetSelect?.dataset?.presetFor;
  if (!valueKey) return;
  const match = findFieldByValueKey(valueKey);
  if (!match) return;

  const { provider, field } = match;
  const row = presetSelect.closest("tr") || presetSelect.closest(".channel-card") || presetSelect.closest(".provider-table");
  const previousValue = presetSelect.dataset.currentPresetValue || fieldConfig(provider, field)?.apiUrl || "";
  const previousProfile = cachedProfileForSelection(provider, field, previousValue);
  const keyField = providerFieldByName(provider, "apiKey", field.channelId || "");
  const modelField = providerFieldByName(provider, "model", field.channelId || "");
  const keyWrapper = keyField && row
    ? row.querySelector(`[data-value-key="${CSS.escape(keyField.valueKey)}"]`)
    : null;
  const currentKeyInput = keyWrapper?.querySelector('input[type="password"], input[type="text"]');
  const currentDraftKey = currentKeyInput?.value?.trim() || "";
  const previousKeyHelp = row?.querySelector(".key-preview")?.textContent.trim() || "";
  const previousKeyPreview = previousKeyHelp.startsWith("当前密钥：")
    ? previousKeyHelp.replace(/^当前密钥：/, "")
    : previousProfile?.keyPreview || "";
  const previousModelValue = modelField ? form.elements[modelField.valueKey]?.value || "" : "";
  cacheProfilePreview(valueKey, previousValue, {
    ...(previousProfile || {}),
    value: previousValue,
    keyPreview: previousKeyPreview,
    model: previousModelValue || previousProfile?.model || "",
    draftKey: currentDraftKey || previousProfile?.draftKey || ""
  });
  presetSelect.dataset.currentPresetValue = presetSelect.value;
  const profile = cachedProfileForSelection(provider, field, presetSelect.value);

  if (keyField && row) {
    const keyWrapper = row.querySelector(`[data-value-key="${CSS.escape(keyField.valueKey)}"]`);
    const keyInput = keyWrapper?.querySelector('input[type="password"], input[type="text"]');
    const keyHelp = keyWrapper?.querySelector(".key-preview");
    const clearInput = keyWrapper?.querySelector(`[data-clear-for="${CSS.escape(keyField.valueKey)}"]`);
    if (keyInput) keyInput.value = profile?.draftKey || "";
    if (clearInput) clearInput.checked = false;
    if (keyHelp) {
      keyHelp.textContent = profile?.draftKey
        ? "当前已输入 Key，保存后生效"
        : previewTextFromKeyPreview(profile?.keyPreview);
    }
  }

  if (modelField && row && profile?.model) {
    const modelWrapper = row.querySelector(`[data-value-key="${CSS.escape(modelField.valueKey)}"]`);
    const modelSelect = modelWrapper?.querySelector("select");
    if (modelSelect) {
      ensureOption(modelSelect, profile.model);
      modelSelect.value = profile.model;
    }
  }
}

function mergeModelPreview(providerId, channelId, previewProviders) {
  const preview = previewProviders?.[providerId];
  if (!preview) return null;
  if (providerId !== "image" || !channelId) {
    modelProviders[providerId] = preview;
    return preview;
  }
  const channelPreview = preview.channels?.find((channel) => channel.id === channelId);
  if (!channelPreview) return null;
  const current = modelProviders.image || { status: preview.status || "loading", channels: [] };
  const channels = [...(current.channels || [])];
  const index = channels.findIndex((channel) => channel.id === channelId);
  if (index >= 0) channels[index] = channelPreview;
  else channels.push(channelPreview);
  modelProviders.image = {
    ...current,
    status: preview.status || current.status || channelPreview.status,
    source: preview.source || current.source || channelPreview.source,
    channels
  };
  return channelPreview;
}

function updateModelField(row, modelField, discovery) {
  if (!row || !modelField || !discovery) return;
  const wrapper = row.querySelector(`[data-value-key="${CSS.escape(modelField.valueKey)}"]`);
  const select = wrapper?.querySelector("select");
  const help = wrapper?.querySelector(".model-status");
  if (select) {
    const selected = discovery.currentModel || select.value || "";
    select.replaceChildren();
    for (const optionData of discovery.models || []) {
      const option = document.createElement("option");
      option.value = optionData.id;
      option.textContent = optionData.label || optionData.id;
      option.selected = optionData.id === selected;
      select.append(option);
    }
    ensureOption(select, selected);
    select.value = selected;
  }
  if (help) {
    help.dataset.status = discovery.status || "error";
    help.textContent = modelStatusText(discovery);
  }
}

async function syncDraftModelsForPreset(presetSelect) {
  const valueKey = presetSelect?.dataset?.presetFor;
  if (!valueKey) return;
  const match = findFieldByValueKey(valueKey);
  if (!match) return;
  const { provider, field } = match;
  const channelId = field.channelId || "";
  const row = presetSelect.closest("tr") || presetSelect.closest(".channel-card") || presetSelect.closest(".provider-card");
  const modelField = providerFieldByName(provider, "model", channelId);
  const keyField = providerFieldByName(provider, "apiKey", channelId);
  const modelSelect = modelField ? form.elements[modelField.valueKey] : null;
  const keyInput = keyField ? form.elements[keyField.valueKey] : null;
  const tokenKey = `${provider.id}:${channelId || "default"}`;
  const token = (draftModelSyncTokens.get(tokenKey) || 0) + 1;
  draftModelSyncTokens.set(tokenKey, token);
  if (modelField) {
    updateModelField(row, modelField, {
      status: "loading",
      currentModel: modelSelect?.value || "",
      models: [],
      message: "正在同步当前接口方案的模型..."
    });
  }
  try {
    const data = await api("/api/admin/providers/models/preview", {
      method: "POST",
      body: JSON.stringify({
        providerId: provider.id,
        channelId,
        apiUrl: presetSelect.value,
        model: modelSelect?.value || "",
        apiKey: keyInput?.value?.trim() || ""
      })
    });
    if (draftModelSyncTokens.get(tokenKey) !== token) return;
    const discovery = mergeModelPreview(provider.id, channelId, data.providers);
    updateModelField(row, modelField, discovery);
  } catch {
    if (draftModelSyncTokens.get(tokenKey) !== token) return;
    updateModelField(row, modelField, {
      status: "error",
      currentModel: modelSelect?.value || "",
      models: modelSelect?.value ? [{ id: modelSelect.value, label: modelSelect.value }] : [],
      message: "模型同步失败，请检查接口地址或 Key。"
    });
  }
}

function renderImageChannel(provider, channel) {
  const config = channelConfig(provider, channel.id) || {};
  const section = document.createElement("section");
  section.className = "channel-card";
  section.dataset.channelId = channel.id;

  const header = document.createElement("div");
  header.className = "channel-header";
  const titleBlock = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = channel.title;
  const description = document.createElement("p");
  description.textContent = channel.description;
  titleBlock.append(title, description);

  const segment = document.createElement("span");
  segment.className = "channel-segment";
  segment.textContent = channel.segmentId;
  header.append(titleBlock, segment);

  const fields = document.createElement("div");
  fields.className = "field-list channel-fields";
  for (const field of provider.fields.filter((item) => item.channelId === channel.id)) {
    fields.append(renderField(provider, field));
  }

  const state = document.createElement("div");
  state.className = "channel-state";
  state.dataset.configured = String(Boolean(config.configured));
  state.textContent = config.configured ? "通道已配置" : "通道缺少密钥";

  section.append(header, fields, state);
  return section;
}

function renderProvider(provider) {
  const text = providerText(provider);
  const card = document.createElement("section");
  card.className = "provider-card";

  const header = document.createElement("div");
  header.className = "card-header";
  const titleRow = document.createElement("div");
  titleRow.className = "card-title-row";
  const title = document.createElement("h2");
  title.textContent = text.title;
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.dataset.configured = String(provider.config.configured);
  badge.textContent = provider.id === "image" && provider.config.channels?.length
    ? `${provider.config.configuredChannels || 0}/${provider.config.requiredChannels || 2} 通道已配置`
    : provider.config.configured ? "已配置" : "缺少密钥";
  titleRow.append(title, badge);

  const meta = document.createElement("div");
  meta.className = "meta";
  for (const line of [
    `供应商：${provider.provider}`,
    `用途：${text.role}`,
    `通道：${text.channel}`
  ]) {
    const item = document.createElement("span");
    item.textContent = line;
    meta.append(item);
  }
  header.append(titleRow, meta);

  if (provider.id === "image" && provider.channels?.length) {
    card.classList.add("provider-card-wide");
    const channels = document.createElement("div");
    channels.className = "channel-list";
    for (const channel of provider.channels) channels.append(renderImageChannel(provider, channel));
    card.append(header, channels);
  } else {
    const fields = document.createElement("div");
    fields.className = "field-list";
    for (const field of provider.fields) fields.append(renderField(provider, field));
    card.append(header, fields);
  }
  return card;
}

function renderProviders() {
  if (!currentSchema) return;
  providerGrid.replaceChildren(...currentSchema.providers.map(renderProvider));
}

function render(data) {
  currentSchema = data;
  profileUiCache.clear();
  renderProviders();
  setStatus(`已同步 ${data.providers.length} 个供应商配置。`, "ok");
  setSaveState("");
  dirty = false;
}

async function loadModels({ refresh = false } = {}) {
  if (!currentSchema) return;
  modelProviders = Object.fromEntries(currentSchema.providers.map((provider) => [
    provider.id,
    provider.id === "image" && provider.config.channels?.length
      ? {
          status: "loading",
          channels: provider.config.channels.map((channel) => ({
            id: channel.id,
            status: "loading",
            currentModel: channel.model,
            models: []
          }))
        }
      : { status: "loading", currentModel: provider.config.model, models: [] }
  ]));
  renderProviders();
  refreshModelsButton.disabled = true;
  refreshModelsButton.textContent = "正在读取模型...";
  try {
    const suffix = refresh ? "?refresh=1" : "";
    const data = await api(`/api/admin/providers/models${suffix}`);
    modelProviders = data.providers || {};
  } catch {
    modelProviders = Object.fromEntries(currentSchema.providers.map((provider) => [
      provider.id,
      provider.id === "image" && provider.config.channels?.length
        ? {
            status: "error",
            channels: provider.config.channels.map((channel) => ({
              id: channel.id,
              status: "error",
              currentModel: channel.model,
              models: [{ id: channel.model, label: channel.model }]
            }))
          }
        : {
            status: "error",
            currentModel: provider.config.model,
            models: [{ id: provider.config.model, label: provider.config.model }]
          }
    ]));
  } finally {
    renderProviders();
    refreshModelsButton.disabled = false;
    refreshModelsButton.textContent = "刷新模型列表";
  }
}

async function loadProviders({ force = false } = {}) {
  if (dirty && !force) return;
  setStatus("正在同步供应商配置...");
  try {
    render(await api("/api/admin/providers"));
    await loadModels();
  } catch {
    setStatus("供应商配置读取失败，请确认本地服务正在运行。", "error");
  }
}

function payloadFromForm() {
  const payload = {};
  for (const provider of currentSchema.providers) {
    for (const field of provider.fields) {
      const input = form.elements[field.valueKey];
      const clear = form.elements[`${field.valueKey}__clear`];
      if (clear?.checked) {
        payload[field.valueKey] = null;
      } else if (field.type === "secret") {
        const value = input.value.trim();
        if (value) payload[field.valueKey] = value;
      } else {
        payload[field.valueKey] = input.value.trim();
      }
    }
  }
  return payload;
}

form.addEventListener("input", () => {
  dirty = true;
  setSaveState("有尚未保存的修改。");
});

form.addEventListener("change", (event) => {
  const preset = event.target.closest("[data-preset-for]");
  if (preset) {
    const target = form.elements[preset.dataset.presetFor];
    if (target && preset.value) {
      target.value = preset.value;
      syncPresetSelection(preset);
      syncDraftModelsForPreset(preset);
      dirty = true;
      setSaveState("已切换接口地址，保存后生效。");
    }
    return;
  }

  const clearInput = event.target.closest("[data-clear-for]");
  if (!clearInput) return;
  const keyInput = form.elements[clearInput.dataset.clearFor];
  if (keyInput) {
    keyInput.disabled = clearInput.checked;
    if (clearInput.checked) keyInput.value = "";
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentSchema) return;
  setSaveState("正在保存...");
  try {
    await api("/api/admin/providers", {
      method: "PUT",
      body: JSON.stringify(payloadFromForm())
    });
    setSaveState("配置已保存，正在重新同步...", "ok");
    dirty = false;
    await loadProviders({ force: true });
  } catch {
    setSaveState("保存失败，请检查接口地址、模型和密钥输入。", "error");
  }
});

refreshButton.addEventListener("click", () => {
  dirty = false;
  loadProviders({ force: true });
});
refreshModelsButton.addEventListener("click", () => {
  if (dirty) {
    setSaveState("请先保存当前修改，再刷新模型列表。", "error");
    return;
  }
  loadModels({ refresh: true });
});
form.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-secret-toggle-for]");
  if (!toggle) return;
  const input = form.elements[toggle.dataset.secretToggleFor];
  if (!input) return;
  const visible = input.type === "text";
  input.type = visible ? "password" : "text";
  toggle.classList.toggle("active", !visible);
  toggle.setAttribute("aria-label", visible ? "显示 API 密钥" : "隐藏 API 密钥");
  toggle.innerHTML = secretToggleSvg(!visible);
});
window.addEventListener("focus", () => loadProviders());
setInterval(() => loadProviders(), 30000);

loadProviders({ force: true });
