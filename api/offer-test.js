import { getValidMlTokenData } from "../lib/ml-token-store.js";

const PRODUCT_ID = "MLB18725310";
const AFFILIATE_LINK = "https://meli.la/2EMjkct";

async function mlGet(path, accessToken) {
  const response = await fetch(
    `https://api.mercadolibre.com${path}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 500) };
  }

  if (!response.ok) {
    throw new Error(
      `Mercado Livre respondeu HTTP ${response.status}: ` +
      `${data?.message || data?.error || "erro desconhecido"}`
    );
  }

  return data;
}

function firstImage(product) {
  const picture = product?.pictures?.[0];

  return (
    picture?.secure_url ||
    picture?.url ||
    product?.secure_thumbnail ||
    product?.thumbnail ||
    null
  );
}

async function resolveOffer(product, accessToken) {
  let offer = product?.buy_box_winner || null;
  let source = offer ? "buy_box_winner" : null;

  if (!offer?.item_id) {
    try {
      const competition = await mlGet(
        `/products/${encodeURIComponent(PRODUCT_ID)}/items`,
        accessToken
      );

      const results = Array.isArray(competition?.results)
        ? competition.results
        : [];

      const priced = results
        .filter((item) => typeof item?.price === "number")
        .sort((a, b) => a.price - b.price);

      offer = priced[0] || results[0] || null;

      if (offer) {
        source = "products_items_fallback";
      }
    } catch {
      // Para a Etapa 6.4A a imagem é o principal teste.
      // Se a competição não estiver acessível, ainda retornamos o produto.
    }
  }

  return {
    itemId: offer?.item_id || null,
    price:
      typeof offer?.price === "number"
        ? offer.price
        : typeof product?.price === "number"
          ? product.price
          : null,
    originalPrice:
      typeof offer?.original_price === "number"
        ? offer.original_price
        : typeof product?.original_price === "number"
          ? product.original_price
          : null,
    currency: offer?.currency_id || product?.currency_id || "BRL",
    priceSource: source
  };
}

export default async function handler(req, res) {
  try {
    const tokenData = await getValidMlTokenData();

    const product = await mlGet(
      `/products/${encodeURIComponent(PRODUCT_ID)}`,
      tokenData.access_token
    );

    const image = firstImage(product);

    if (!image) {
      return res.status(502).json({
        ok: false,
        error: "O produto foi encontrado, mas a API não retornou uma imagem.",
        productId: PRODUCT_ID
      });
    }

    const offer = await resolveOffer(
      product,
      tokenData.access_token
    );

    return res.status(200).json({
      ok: true,
      productId: product.id || PRODUCT_ID,
      title:
        product.title ||
        product.name ||
        product.short_description?.content ||
        null,
      image,
      price: offer.price,
      originalPrice: offer.originalPrice,
      currency: offer.currency,
      itemId: offer.itemId,
      priceSource: offer.priceSource,
      affiliateLink: AFFILIATE_LINK,

      // Segurança: nunca retornamos access_token nem refresh_token.
      accessTokenExposed: false,
      refreshTokenExposed: false
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Erro desconhecido",
      accessTokenExposed: false,
      refreshTokenExposed: false
    });
  }
}
