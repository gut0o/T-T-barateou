function env(
  name
) {
  const value =
    String(
      process.env[
        name
      ] ||
      ""
    )
      .trim();

  if (!value) {
    const error =
      new Error(
        `Variável ${name} não configurada.`
      );

    error.statusCode =
      500;

    throw error;
  }

  return value;
}

function normalizeSupabaseUrl(
  value
) {
  return String(
    value
  )
    .trim()
    .replace(
      /\/+$/,
      ""
    );
}

export default async function handler(
  req,
  res
) {
  if (
    req.method !==
    "GET"
  ) {
    return res
      .status(405)
      .json({
        ok:
          false,

        error:
          "Method not allowed."
      });
  }

  try {
    const supabaseUrl =
      normalizeSupabaseUrl(
        env(
          "SUPABASE_URL"
        )
      );

    const secretKey =
      env(
        "SUPABASE_SECRET_KEY"
      );

    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/tt_app_state?select=state_key&limit=1`,
        {
          method:
            "GET",

          headers: {
            apikey:
              secretKey,

            Authorization:
              `Bearer ${secretKey}`,

            Accept:
              "application/json"
          }
        }
      );

    let payload =
      null;

    try {
      payload =
        await response.json();
    } catch {
      payload =
        null;
    }

    if (
      !response.ok
    ) {
      return res
        .status(502)
        .json({
          ok:
            false,

          connected:
            false,

          supabaseHttpStatus:
            response.status,

          error:
            payload?.message ||
            payload?.error ||
            "Supabase respondeu com erro.",

          secretExposed:
            false
        });
    }

    return res
      .status(200)
      .json({
        ok:
          true,

        connected:
          true,

        table:
          "tt_app_state",

        rowsReturned:
          Array.isArray(
            payload
          )
            ? payload.length
            : null,

        message:
          "Vercel conectado ao Supabase com sucesso.",

        secretExposed:
          false
      });
  } catch (error) {
    return res
      .status(
        error?.statusCode ||
        500
      )
      .json({
        ok:
          false,

        connected:
          false,

        error:
          error?.message ||
          "Erro inesperado.",

        secretExposed:
          false
      });
  }
}
