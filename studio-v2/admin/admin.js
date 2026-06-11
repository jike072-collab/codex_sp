const form = document.querySelector("#providerForm");
const providerGrid = document.querySelector("#providerGrid");
const statusEl = document.querySelector("#status");
const saveState = document.querySelector("#saveState");
const refreshButton = document.querySelector("#refreshButton");

let currentSchema = null;
let dirty = false;

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
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.code || "Request failed.");
  }
  return data;
}

function inputType(field) {
  if (field.type === "secret") return "password";
  if (field.type === "url") return "url";
  return "text";
}

function fieldHelp(field, provider) {
  if (field.type === "secret") {
    return provider.config.keyPreview
      ? `Current key: ${provider.config.keyPreview}. Leave blank to keep it.`
      : "No usable key is configured. Leave blank to keep it empty.";
  }
  if (field.name === "apiUrl") return `Current value: ${provider.config.apiUrl}`;
  if (field.name === "model") return `Current value: ${provider.config.model}`;
  return "";
}

function currentFieldValue(field, provider) {
  if (field.type === "secret") return "";
  if (field.name === "apiUrl") return provider.config.apiUrl || "";
  if (field.name === "model") return provider.config.model || "";
  return "";
}

function renderField(provider, field) {
  const wrapper = document.createElement("div");
  wrapper.className = "field";

  const label = document.createElement("label");
  label.htmlFor = field.valueKey;
  label.textContent = field.label;
  wrapper.append(label);

  const input = document.createElement("input");
  input.id = field.valueKey;
  input.name = field.valueKey;
  input.type = inputType(field);
  input.value = currentFieldValue(field, provider);
  input.autocomplete = field.type === "secret" ? "new-password" : "off";
  input.dataset.fieldType = field.type;
  if (field.type !== "secret") input.required = true;
  wrapper.append(input);

  const help = document.createElement("small");
  help.textContent = fieldHelp(field, provider);
  wrapper.append(help);

  if (field.clearable) {
    const clearLabel = document.createElement("label");
    clearLabel.className = "clear-row";
    const clearInput = document.createElement("input");
    clearInput.type = "checkbox";
    clearInput.name = `${field.valueKey}__clear`;
    clearInput.dataset.clearFor = field.valueKey;
    clearLabel.append(clearInput, document.createTextNode("Clear saved key"));
    wrapper.append(clearLabel);
  }

  return wrapper;
}

function renderProvider(provider) {
  const card = document.createElement("section");
  card.className = "provider-card";

  const header = document.createElement("div");
  header.className = "card-header";

  const titleRow = document.createElement("div");
  titleRow.className = "card-title-row";
  const title = document.createElement("h2");
  title.textContent = provider.title;
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.dataset.configured = String(provider.config.configured);
  badge.textContent = provider.config.configured ? "Configured" : "Missing key";
  titleRow.append(title, badge);

  const meta = document.createElement("div");
  meta.className = "meta";
  for (const line of [
    `Provider: ${provider.provider}`,
    `Role: ${provider.role}`,
    `Channel: ${provider.channel}`
  ]) {
    const item = document.createElement("span");
    item.textContent = line;
    meta.append(item);
  }

  header.append(titleRow, meta);
  card.append(header);

  const fields = document.createElement("div");
  fields.className = "field-list";
  for (const field of provider.fields) {
    fields.append(renderField(provider, field));
  }
  card.append(fields);
  return card;
}

function render(data) {
  currentSchema = data;
  providerGrid.replaceChildren(...data.providers.map(renderProvider));
  setStatus(`Schema v${data.schemaVersion} synced from backend.`);
  setSaveState("");
  dirty = false;
}

async function loadProviders({ force = false } = {}) {
  if (dirty && !force) return;
  setStatus("Syncing provider schema...");
  try {
    render(await api("/api/admin/providers"));
  } catch (error) {
    setStatus(error.message, "error");
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
        continue;
      }
      if (field.type === "secret") {
        const value = input.value.trim();
        if (value) payload[field.valueKey] = value;
        continue;
      }
      payload[field.valueKey] = input.value.trim();
    }
  }
  return payload;
}

form.addEventListener("input", () => {
  dirty = true;
  setSaveState("Unsaved changes.");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentSchema) return;
  setSaveState("Saving...");
  try {
    await api("/api/admin/providers", {
      method: "PUT",
      body: JSON.stringify(payloadFromForm())
    });
    setSaveState("Saved. Syncing latest config...", "ok");
    dirty = false;
    await loadProviders({ force: true });
  } catch (error) {
    setSaveState(error.message, "error");
  }
});

refreshButton.addEventListener("click", () => {
  dirty = false;
  loadProviders({ force: true });
});

window.addEventListener("focus", () => loadProviders());
setInterval(() => loadProviders(), 30000);

loadProviders({ force: true });
