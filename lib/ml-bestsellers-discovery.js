// T&T Barateou — Etapa 6.8B
//
// Descoberta por "Mais vendidos" do Mercado Livre.
// Usa o endpoint oficial /highlights.
//
// Nesta etapa apenas obtemos os IDs ranqueados.
// Ainda não:
// - resolvemos preço;
// - geramos link de afiliado;
// - pontuamos;
// - enviamos ao WhatsApp.

const SITE_ID = "MLB";

// Categoria folha já validada no projeto:
// MLB108704 = Vestidos
const DEFAULT_CATEGORY_ID =
  "MLB108704";

function normalizeCategoryId(value) {
  const categoryId =
    String(
      value ||
      DEFAULT_CATEGORY_ID
    )
      .trim()
      .toUpperCase();

  if (
    !/^MLB\d+$/.test(
      categoryId
    )
  ) {
    throw new Error(
      "categoryId inválido. Exemplo esperado: MLB108704."
    );
  }

  return categoryId;
}

async function readError(
  response
) {
  try {
    const data =
      await response.json();

    return {
      message:
        data?.message ||
        data?.error ||
        null,

      error:
        data?.error ||
        null,

      cause:
        Array.isArray(
          data?.cause
        )
          ? data.cause
          : []
    };
  } catch {
    return {
      message: null,
      error: null,
      cause: []
    };
  }
}

export async function discoverBestSellers({
  accessToken,
  categoryId = null,
  attribute = null,
  attributeValue = null
}) {
  if (!accessToken) {
    throw new Error(
      "Access token do Mercado Livre não está disponível."
    );
  }

  const normalizedCategoryId =
    normalizeCategoryId(
      categoryId
    );

  const url =
    new URL(
      `https://api.mercadolibre.com/highlights/${SITE_ID}/category/${normalizedCategoryId}`
    );

  const normalizedAttribute =
    String(
      attribute ||
      ""
    )
      .trim()
      .toUpperCase();

  const normalizedAttributeValue =
    String(
      attributeValue ||
      ""
    )
      .trim();

  if (
    normalizedAttribute &&
    normalizedAttributeValue
  ) {
    url.searchParams.set(
      "attribute",
      normalizedAttribute
    );

    url.searchParams.set(
      "attributeValue",
      normalizedAttributeValue
    );
  }

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      12000
    );

  let response;

  try {
    response =
      await fetch(
        url,
        {
          method:
            "GET",

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            Accept:
              "application/json"
          },

          signal:
            controller.signal
        }
      );
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        "A consulta de mais vendidos excedeu 12 segundos."
      );
    }

    throw error;
  } finally {
    clearTimeout(
      timeout
    );
  }

  if (!response.ok) {
    const detail =
      await readError(
        response
      );

    return {
      ok: false,

      source:
        "mercadolivre_highlights",

      categoryId:
        normalizedCategoryId,

      attributeFilter:
        normalizedAttribute &&
        normalizedAttributeValue
          ? {
              attribute:
                normalizedAttribute,

              attributeValue:
                normalizedAttributeValue
            }
          : null,

      httpStatus:
        response.status,

      mlError:
        detail,

      note:
        response.status === 404
          ? (
              "Essa categoria não possui ranking de mais vendidos disponível. " +
              "O Mercado Livre recomenda consultar uma categoria folha."
            )
          : (
              "O Mercado Livre recusou ou não conseguiu concluir a consulta de mais vendidos."
            ),

      accessTokenExposed:
        false,

      refreshTokenExposed:
        false
    };
  }

  const data =
    await response.json();

  const content =
    Array.isArray(
      data?.content
    )
      ? data.content
      : [];

  const candidates =
    content
      .map(
        (entry) => ({
          id:
            entry?.id ||
            null,

          position:
            typeof entry?.position === "number"
              ? entry.position
              : null,

          type:
            entry?.type ||
            null
        })
      )
      .filter(
        (entry) =>
          entry.id
      );

  return {
    ok: true,

    source:
      "mercadolivre_highlights",

    highlightType:
      data?.query_data
        ?.highlight_type ||
      null,

    criteria:
      data?.query_data
        ?.criteria ||
      null,

    categoryId:
      data?.query_data
        ?.id ||
      normalizedCategoryId,

    attributeFilter:
      normalizedAttribute &&
      normalizedAttributeValue
        ? {
            attribute:
              normalizedAttribute,

            attributeValue:
              normalizedAttributeValue
          }
        : null,

    candidateCount:
      candidates.length,

    candidates,

    typeCounts:
      candidates.reduce(
        (
          counts,
          candidate
        ) => {
          const type =
            candidate.type ||
            "UNKNOWN";

          counts[type] =
            (
              counts[type] ||
              0
            ) + 1;

          return counts;
        },
        {}
      ),

    discoveryStatus:
      candidates.length
        ? "bestsellers_found"
        : "no_bestsellers",

    note:
      "Nesta etapa os resultados são apenas sementes de descoberta. Ainda vamos resolver detalhes, preço e elegibilidade antes de qualquer publicação.",

    accessTokenExposed:
      false,

    refreshTokenExposed:
      false
  };
}
