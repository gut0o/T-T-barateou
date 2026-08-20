// T&T Barateou — Etapa 6.18Y
// Cursor persistente de cada consulta contínua no Supabase.

import {
  continuousQueriesForGroup
} from "./tt-continuous-discovery-queries.js";

const STATE_KEY = "continuous_discovery_v1";
const DEFAULT_PAGE_SIZE = 3;

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Variável ${name} não configurada.`);
  return value;
}

function supabaseConfig() {
  return {
    url: requiredEnv("SUPABASE_URL").replace(/\/+$/, ""),
    secret: requiredEnv("SUPABASE_SECRET_KEY")
  };
}

async function request(path, { method = "GET", body = null, prefer = null } = {}) {
  const { url, secret } = supabaseConfig();
  const headers = {
    Accept: "application/json",
    apikey: secret,
    Authorization: `Bearer ${secret}`
  };
  if (body !== null) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;

  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers,
    body: body === null ? undefined : JSON.stringify(body)
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }

  if (!response.ok) {
    throw new Error(
      payload?.message || payload?.details || `Supabase HTTP ${response.status}`
    );
  }
  return payload;
}

function emptyGroup() {
  return {
    queryIndex: 0,
    offsets: {},
    sequence: 0,
    rounds: 0,
    last: null
  };
}

function normalizeGroupState(value) {
  const group = emptyGroup();
  if (!value || typeof value !== "object") return group;
  group.queryIndex = Math.max(0, Math.floor(Number(value.queryIndex) || 0));
  group.sequence = Math.max(0, Math.floor(Number(value.sequence) || 0));
  group.rounds = Math.max(0, Math.floor(Number(value.rounds) || 0));
  group.offsets = value.offsets && typeof value.offsets === "object"
    ? { ...value.offsets }
    : {};
  group.last = value.last && typeof value.last === "object" ? value.last : null;
  return group;
}

function normalizeState(value) {
  return {
    version: 1,
    groups: {
      eletronicos: normalizeGroupState(value?.groups?.eletronicos),
      fitness: normalizeGroupState(value?.groups?.fitness),
      perfumes: normalizeGroupState(value?.groups?.perfumes)
    }
  };
}

async function readState() {
  const payload = await request(
    `tt_app_state?state_key=eq.${encodeURIComponent(STATE_KEY)}&select=state_value&limit=1`
  );
  if (!Array.isArray(payload) || !payload.length) return normalizeState(null);
  return normalizeState(payload[0]?.state_value);
}

async function writeState(state) {
  const normalized = normalizeState(state);
  await request("tt_app_state?on_conflict=state_key", {
    method: "POST",
    body: {
      state_key: STATE_KEY,
      state_value: normalized
    },
    prefer: "resolution=merge-duplicates,return=minimal"
  });
  return normalized;
}

export async function takeContinuousDiscoveryPage({
  group,
  pageSize = DEFAULT_PAGE_SIZE
}) {
  const normalizedGroup = String(group || "").trim().toLowerCase();
  const queries = continuousQueriesForGroup(normalizedGroup);
  if (!queries.length) {
    const error = new Error(`Grupo contínuo inválido: ${normalizedGroup || "(vazio)"}`);
    error.statusCode = 400;
    throw error;
  }

  const state = await readState();
  const groupState = state.groups[normalizedGroup];
  const queryIndex = groupState.queryIndex % queries.length;
  const query = queries[queryIndex];
  const rawOffset = Number(groupState.offsets?.[query.key] || 0);
  const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.floor(rawOffset)) : 0;
  const safePageSize = Math.min(Math.max(Math.floor(Number(pageSize) || 3), 1), 10);

  return {
    state,
    group: normalizedGroup,
    query,
    queryIndex,
    queryCount: queries.length,
    offset,
    pageSize: safePageSize,
    sequence: groupState.sequence,
    rounds: groupState.rounds
  };
}

export async function commitContinuousDiscoveryPage(selection, result) {
  const state = selection.state;
  const groupState = state.groups[selection.group];
  const total = Number(result?.paging?.total);
  const resultCount = Number(result?.resultCount ?? result?.paging?.resultCount ?? 0);
  const successful = result?.ok === true;

  let nextOffset = selection.offset;
  let exhausted = false;

  if (successful) {
    nextOffset = selection.offset + selection.pageSize;
    exhausted = resultCount === 0 || (Number.isFinite(total) && nextOffset >= total);
  } else if (result?.resetSuggested === true) {
    exhausted = true;
  }

  groupState.offsets[selection.query.key] = exhausted ? 0 : nextOffset;

  const nextQueryIndex = (selection.queryIndex + 1) % selection.queryCount;
  groupState.queryIndex = nextQueryIndex;
  groupState.sequence += 1;
  if (nextQueryIndex === 0) groupState.rounds += 1;

  groupState.last = {
    queryKey: selection.query.key,
    query: selection.query.q,
    offset: selection.offset,
    nextOffset: groupState.offsets[selection.query.key],
    total: Number.isFinite(total) ? total : null,
    resultCount: Number.isFinite(resultCount) ? resultCount : 0,
    exhausted,
    ok: successful,
    at: new Date().toISOString()
  };

  await writeState(state);

  return {
    nextQueryIndex,
    nextOffset: groupState.offsets[selection.query.key],
    exhausted,
    sequence: groupState.sequence,
    rounds: groupState.rounds
  };
}
