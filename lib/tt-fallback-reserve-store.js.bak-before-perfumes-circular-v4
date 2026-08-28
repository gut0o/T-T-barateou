// T&T Barateou — Etapa 6.18Z
// Banco de Reserva persistente no Supabase.
//
// O banco guarda links escolhidos manualmente pelo usuário e só é consumido
// quando a descoberta automática não consegue atingir o mínimo do lote.

const TABLE = "tt_fallback_links";

const VALID_GROUPS = new Set([
  "eletronicos",
  "fitness",
  "perfumes"
]);

const VALID_STATUSES = new Set([
  "available",
  "claimed",
  "queued",
  "used",
  "rejected",
  "expired",
  "duplicate",
  "removed"
]);

function requireSupabaseConfiguration() {
  const url = String(process.env.SUPABASE_URL || "")
    .trim()
    .replace(/\/+$/, "");

  const secretKey = String(process.env.SUPABASE_SECRET_KEY || "").trim();

  if (!url || !secretKey) {
    throw new Error("Faltam SUPABASE_URL e/ou SUPABASE_SECRET_KEY no Vercel.");
  }

  return { url, secretKey };
}

async function supabaseRequest(
  path,
  {
    method = "GET",
    body = null,
    prefer = null,
    allowConflict = false
  } = {}
) {
  const { url, secretKey } = requireSupabaseConfiguration();

  const headers = {
    Accept: "application/json",
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`
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
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    if (allowConflict && response.status === 409) {
      return { status: response.status, conflict: true, payload };
    }

    const detail =
      payload?.message ||
      payload?.details ||
      payload?.hint ||
      (typeof payload === "string" ? payload : null) ||
      `HTTP ${response.status}`;

    const error = new Error(`Supabase reserva: ${detail}`);
    error.statusCode = response.status;
    error.supabase = payload;
    throw error;
  }

  return { status: response.status, conflict: false, payload };
}

function normalizeGroup(value) {
  const group = String(value || "").trim().toLowerCase();
  if (!VALID_GROUPS.has(group)) return null;
  return group;
}

function normalizeStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (!VALID_STATUSES.has(status)) return null;
  return status;
}

function safeItemId(value) {
  const id = String(value || "").trim().toUpperCase();
  return /^MLB\d+$/.test(id) ? id : null;
}

function safeProductId(value) {
  const id = String(value || "").trim().toUpperCase();
  return /^MLB\d+$/.test(id) ? id : null;
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function rowToReserve(row) {
  if (!row) return null;

  return {
    id: Number(row.id),
    group: row.group_name || null,
    originalUrl: row.original_url || null,
    productId: row.product_id || null,
    itemId: row.item_id || null,
    currentItemId: row.current_item_id || null,
    title: row.title || null,
    price: finiteNumber(row.price),
    status: row.status || null,
    failureReason: row.failure_reason || null,
    metadata: row.metadata || {},
    addedAt: row.added_at || null,
    claimedAt: row.claimed_at || null,
    queuedAt: row.queued_at || null,
    usedAt: row.used_at || null,
    lastCheckedAt: row.last_checked_at || null,
    updatedAt: row.updated_at || null
  };
}

async function findActiveDuplicate({ group, originalUrl, productId, itemId }) {
  const filters = [
    `group_name=eq.${encodeURIComponent(group)}`,
    "status=in.(available,claimed,queued)",
    "select=*",
    "order=added_at.asc",
    "limit=1"
  ];

  const lookups = [];
  if (productId) lookups.push(`product_id=eq.${encodeURIComponent(productId)}`);
  if (!productId && itemId) lookups.push(`item_id=eq.${encodeURIComponent(itemId)}`);
  lookups.push(`original_url=eq.${encodeURIComponent(originalUrl)}`);

  for (const lookup of lookups) {
    const { payload } = await supabaseRequest(
      `${TABLE}?${[filters[0], lookup, ...filters.slice(1)].join("&")}`
    );

    if (Array.isArray(payload) && payload.length) {
      return rowToReserve(payload[0]);
    }
  }

  return null;
}

export async function addFallbackReserveEntry({
  group,
  originalUrl,
  offer
}) {
  const safeGroup = normalizeGroup(group);
  const safeUrl = String(originalUrl || "").trim();

  if (!safeGroup) throw new Error("Grupo de reserva inválido.");
  if (!/^https?:\/\//i.test(safeUrl)) throw new Error("URL de reserva inválida.");

  const productId = safeProductId(offer?.productId);
  const itemId = safeItemId(offer?.itemId);

  const existing = await findActiveDuplicate({
    group: safeGroup,
    originalUrl: safeUrl,
    productId,
    itemId
  });

  if (existing) {
    return { added: false, duplicate: true, reserve: existing };
  }

  const now = new Date().toISOString();
  const row = {
    group_name: safeGroup,
    original_url: safeUrl,
    product_id: productId,
    item_id: itemId,
    current_item_id: null,
    title: offer?.title || null,
    price: finiteNumber(offer?.price),
    status: "available",
    failure_reason: null,
    metadata: {
      productId,
      itemId,
      title: offer?.title || null,
      price: finiteNumber(offer?.price),
      originalPrice: finiteNumber(offer?.originalPrice),
      discount: finiteNumber(offer?.discount),
      sellerId: offer?.sellerId ?? offer?.seller_id ?? null,
      image: offer?.image || null,
      ttCategoryId: offer?.ttCategoryId || null,
      ttCategoryName: offer?.ttCategoryName || null,
      capturedAt: now
    },
    added_at: now,
    updated_at: now
  };

  const inserted = await supabaseRequest(TABLE, {
    method: "POST",
    body: row,
    prefer: "return=representation",
    allowConflict: true
  });

  if (inserted.conflict) {
    const winner = await findActiveDuplicate({
      group: safeGroup,
      originalUrl: safeUrl,
      productId,
      itemId
    });

    if (winner) {
      return { added: false, duplicate: true, reserve: winner };
    }

    throw new Error("Conflito ao inserir a reserva, mas o registro existente não foi localizado.");
  }

  const created = Array.isArray(inserted.payload) ? inserted.payload[0] : null;
  return { added: true, duplicate: false, reserve: rowToReserve(created) };
}

export async function listFallbackReserve({
  group = null,
  status = "available",
  limit = 50
} = {}) {
  const safeGroup = group ? normalizeGroup(group) : null;
  if (group && !safeGroup) throw new Error("Grupo de reserva inválido.");

  const safeStatus = status ? normalizeStatus(status) : null;
  if (status && !safeStatus) throw new Error("Status de reserva inválido.");

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const filters = [];

  if (safeGroup) filters.push(`group_name=eq.${encodeURIComponent(safeGroup)}`);
  if (safeStatus) filters.push(`status=eq.${encodeURIComponent(safeStatus)}`);

  filters.push("select=*");
  filters.push("order=added_at.asc");
  filters.push(`limit=${safeLimit}`);

  const { payload } = await supabaseRequest(`${TABLE}?${filters.join("&")}`);
  const rows = Array.isArray(payload) ? payload : [];

  return {
    count: rows.length,
    group: safeGroup,
    status: safeStatus,
    entries: rows.map(rowToReserve)
  };
}

export async function summarizeFallbackReserve() {
  const { payload } = await supabaseRequest(
    `${TABLE}?status=in.(available,claimed,queued)&select=id,group_name,status&order=added_at.asc&limit=5000`
  );

  const rows = Array.isArray(payload) ? payload : [];
  const groups = {
    eletronicos: { available: 0, claimed: 0, queued: 0, used: 0, rejected: 0, expired: 0, duplicate: 0, removed: 0 },
    fitness: { available: 0, claimed: 0, queued: 0, used: 0, rejected: 0, expired: 0, duplicate: 0, removed: 0 },
    perfumes: { available: 0, claimed: 0, queued: 0, used: 0, rejected: 0, expired: 0, duplicate: 0, removed: 0 }
  };

  for (const row of rows) {
    const group = normalizeGroup(row.group_name);
    const status = normalizeStatus(row.status);
    if (group && status && Object.prototype.hasOwnProperty.call(groups[group], status)) {
      groups[group][status] += 1;
    }
  }

  const totalAvailable = Object.values(groups).reduce(
    (sum, entry) => sum + entry.available,
    0
  );

  return {
    totalRows: rows.length,
    totalAvailable,
    groups
  };
}

export async function recoverStaleFallbackClaims({ maxAgeMinutes = 10 } = {}) {
  const minutes = Math.max(Number(maxAgeMinutes) || 10, 1);
  const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const { payload } = await supabaseRequest(
    `${TABLE}?status=eq.claimed&claimed_at=lt.${encodeURIComponent(cutoff)}`,
    {
      method: "PATCH",
      body: {
        status: "available",
        claimed_at: null,
        failure_reason: "stale_claim_recovered",
        updated_at: now
      },
      prefer: "return=representation"
    }
  );

  return {
    recovered: Array.isArray(payload) ? payload.length : 0
  };
}

export async function claimNextFallbackReserve(group) {
  const safeGroup = normalizeGroup(group);
  if (!safeGroup) throw new Error("Grupo de reserva inválido.");

  await recoverStaleFallbackClaims();

  // Uma única instância é o caso normal, mas o PATCH condicional evita
  // que duas instâncias consumam o mesmo link se houver corrida.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const listed = await listFallbackReserve({
      group: safeGroup,
      status: "available",
      limit: 10
    });

    if (!listed.entries.length) return null;

    for (const entry of listed.entries) {
      const now = new Date().toISOString();
      const { payload } = await supabaseRequest(
        `${TABLE}?id=eq.${encodeURIComponent(entry.id)}&status=eq.available`,
        {
          method: "PATCH",
          body: {
            status: "claimed",
            claimed_at: now,
            last_checked_at: now,
            updated_at: now,
            failure_reason: null
          },
          prefer: "return=representation"
        }
      );

      if (Array.isArray(payload) && payload.length) {
        return rowToReserve(payload[0]);
      }
    }
  }

  return null;
}

export async function updateFallbackReserveEntry({
  id,
  status,
  currentItemId = undefined,
  title = undefined,
  price = undefined,
  failureReason = undefined,
  metadata = undefined
}) {
  const numericId = Number(id);
  const safeStatus = normalizeStatus(status);

  if (!Number.isInteger(numericId) || numericId <= 0) throw new Error("ID de reserva inválido.");
  if (!safeStatus) throw new Error("Status de reserva inválido.");

  const now = new Date().toISOString();
  const patch = {
    status: safeStatus,
    updated_at: now,
    last_checked_at: now
  };

  if (currentItemId !== undefined) patch.current_item_id = safeItemId(currentItemId);
  if (title !== undefined) patch.title = title || null;
  if (price !== undefined) patch.price = finiteNumber(price);
  if (failureReason !== undefined) patch.failure_reason = failureReason || null;
  if (metadata !== undefined) patch.metadata = metadata || {};

  if (safeStatus === "queued") patch.queued_at = now;
  if (safeStatus === "used") patch.used_at = now;

  const { payload } = await supabaseRequest(
    `${TABLE}?id=eq.${encodeURIComponent(numericId)}`,
    {
      method: "PATCH",
      body: patch,
      prefer: "return=representation"
    }
  );

  if (!Array.isArray(payload) || !payload.length) return null;
  return rowToReserve(payload[0]);
}

export async function removeFallbackReserveEntry(id) {
  return updateFallbackReserveEntry({
    id,
    status: "removed",
    failureReason: "removido_manualmente"
  });
}

export async function completeFallbackReserveByItemId({
  itemId,
  status,
  failureReason = null
}) {
  const safeItem = safeItemId(itemId);
  const safeStatus = normalizeStatus(status);

  if (!safeItem || !safeStatus) {
    return { updated: false, reserve: null };
  }

  const { payload } = await supabaseRequest(
    `${TABLE}?current_item_id=eq.${encodeURIComponent(safeItem)}` +
      `&status=eq.queued&select=*&order=queued_at.desc&limit=1`
  );

  const row = Array.isArray(payload) && payload.length ? payload[0] : null;
  if (!row) return { updated: false, reserve: null };

  const reserve = await updateFallbackReserveEntry({
    id: row.id,
    status: safeStatus,
    failureReason
  });

  return { updated: Boolean(reserve), reserve };
}
