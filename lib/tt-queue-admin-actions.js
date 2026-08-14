import {
  findQueuedPublicationByItemId,
  listPublicationQueue,
  markPublicationAffiliateReady
} from "./tt-pending-publication-store.js";

function getAdminKey(
  req
) {
  const header =
    req.headers?.[
      "x-tt-admin-key"
    ];

  if (
    Array.isArray(header)
  ) {
    return header[0] ||
      "";
  }

  return String(
    header || ""
  );
}

export function assertQueueAdmin(
  req
) {
  const configured =
    process.env
      .TT_QUEUE_ADMIN_KEY;

  if (!configured) {
    const error =
      new Error(
        "TT_QUEUE_ADMIN_KEY ainda não foi configurada no Vercel."
      );

    error.statusCode =
      503;

    throw error;
  }

  const received =
    getAdminKey(
      req
    );

  if (
    !received ||
    received !== configured
  ) {
    const error =
      new Error(
        "Chave administrativa inválida."
      );

    error.statusCode =
      401;

    throw error;
  }
}

function currentDeploymentBaseUrl() {
  const host =
    process.env
      .VERCEL_URL ||
    process.env
      .VERCEL_PROJECT_PRODUCTION_URL;

  if (!host) {
    throw new Error(
      "Não foi possível identificar a URL do deployment para validar o link."
    );
  }

  return (
    host.startsWith("http")
      ? host
      : `https://${host}`
  );
}

async function validateAffiliateLink({
  affiliateLink,
  expectedItemId,
  expectedProductId
}) {
  const baseUrl =
    currentDeploymentBaseUrl();

  const url =
    `${baseUrl}/api/offer?link=` +
    encodeURIComponent(
      affiliateLink
    );

  const response =
    await fetch(
      url,
      {
        method:
          "GET",

        headers: {
          Accept:
            "application/json"
        }
      }
    );

  let result =
    null;

  try {
    result =
      await response.json();
  } catch {
    result =
      null;
  }

  if (
    !response.ok ||
    !result?.ok
  ) {
    return {
      valid:
        false,

      reason:
        "affiliate_link_resolution_failed",

      httpStatus:
        response.status,

      resolved:
        result
    };
  }

  const itemMatches =
    Boolean(
      expectedItemId &&
      result.itemId &&
      expectedItemId ===
        result.itemId
    );

  const productMatches =
    Boolean(
      expectedProductId &&
      result.productId &&
      expectedProductId ===
        result.productId
    );

  return {
    valid:
      itemMatches ||
      productMatches,

    itemMatches,

    productMatches,

    reason:
      itemMatches ||
      productMatches
        ? "matched_queued_offer"
        : "resolved_to_different_offer",

    resolved:
      result
  };
}

export async function handleQueueListAction(
  req
) {
  assertQueueAdmin(
    req
  );

  const status =
    req.query?.status ||
    null;

  return {
    ok:
      true,

    action:
      "queue-list",

    queue:
      await listPublicationQueue({
        status,
        limit:
          req.query?.limit ||
          50
      }),

    accessTokenExposed:
      false,

    refreshTokenExposed:
      false
  };
}

export async function handleAttachAffiliateAction(
  req
) {
  assertQueueAdmin(
    req
  );

  const body =
    typeof req.body === "string"
      ? JSON.parse(
          req.body || "{}"
        )
      : (
          req.body ||
          {}
        );

  const itemId =
    String(
      body.itemId ||
      req.query?.itemId ||
      ""
    )
      .trim()
      .toUpperCase();

  const affiliateLink =
    String(
      body.affiliateLink ||
      req.query?.affiliateLink ||
      ""
    )
      .trim();

  if (
    !/^MLB\d+$/.test(
      itemId
    )
  ) {
    const error =
      new Error(
        "itemId inválido."
      );

    error.statusCode =
      400;

    throw error;
  }

  if (
    !/^https?:\/\//i.test(
      affiliateLink
    )
  ) {
    const error =
      new Error(
        "affiliateLink inválido."
      );

    error.statusCode =
      400;

    throw error;
  }

  const queued =
    await findQueuedPublicationByItemId(
      itemId
    );

  if (!queued) {
    const error =
      new Error(
        "Oferta não encontrada na fila."
      );

    error.statusCode =
      404;

    throw error;
  }

  const expected =
    queued.envelope
      .data ||
    {};

  const validation =
    await validateAffiliateLink({
      affiliateLink,

      expectedItemId:
        expected.itemId,

      expectedProductId:
        expected.productId
    });

  if (!validation.valid) {
    return {
      ok:
        false,

      action:
        "attach-affiliate-link",

      error:
        "O link afiliado não corresponde ao produto enfileirado.",

      validation: {
        reason:
          validation.reason,

        expectedItemId:
          expected.itemId ||
          null,

        expectedProductId:
          expected.productId ||
          null,

        resolvedItemId:
          validation.resolved
            ?.itemId ||
          null,

        resolvedProductId:
          validation.resolved
            ?.productId ||
          null
      },

      queueUpdated:
        false,

      accessTokenExposed:
        false,

      refreshTokenExposed:
        false
    };
  }

  const updated =
    await markPublicationAffiliateReady({
      pathname:
        queued.pathname,

      envelope:
        queued.envelope,

      affiliateLink,

      validatedOffer:
        validation.resolved
    });

  return {
    ok:
      true,

    action:
      "attach-affiliate-link",

    validation: {
      valid:
        true,

      itemMatches:
        validation.itemMatches,

      productMatches:
        validation.productMatches,

      resolvedItemId:
        validation.resolved
          ?.itemId ||
        null,

      resolvedProductId:
        validation.resolved
          ?.productId ||
        null
    },

    queueUpdated:
      true,

    publicationStatus:
      updated.status,

    itemId,

    whatsappPayload:
      updated.data
        ?.whatsappPayload ||
      null,

    messageDraft:
      updated.data
        ?.messageDraft ||
      null,

    accessTokenExposed:
      false,

    refreshTokenExposed:
      false
  };
}
