// T&T Barateou — pontuação interna de ofertas.
//
// Esta pontuação NÃO aparece na mensagem enviada ao cliente.
// Ela serve apenas para priorização futura.
//
// Escala: 0 a 100.
//
// Componentes:
// 1. Desconto: até 40 pontos.
// 2. Percentual de comissão direta: até 30 pontos.
// 3. Ganho direto estimado: até 30 pontos.

function clamp(
  value,
  min,
  max
) {
  return Math.min(
    Math.max(value, min),
    max
  );
}

function round2(value) {
  return Number(
    value.toFixed(2)
  );
}

function scoreDiscount(
  discount
) {
  if (
    typeof discount !== "number" ||
    !Number.isFinite(discount) ||
    discount <= 0
  ) {
    return 0;
  }

  // 40% OFF ou mais = nota máxima neste componente.
  return round2(
    clamp(
      discount,
      0,
      40
    )
  );
}

function scoreCommissionRate(
  directCommissionPercent
) {
  if (
    typeof directCommissionPercent !== "number" ||
    !Number.isFinite(
      directCommissionPercent
    ) ||
    directCommissionPercent <= 0
  ) {
    return 0;
  }

  // 16% é a maior faixa confirmada nesta versão.
  return round2(
    clamp(
      (
        directCommissionPercent /
        16
      ) * 30,
      0,
      30
    )
  );
}

function scoreEstimatedEarning(
  estimatedDirectCommission
) {
  if (
    typeof estimatedDirectCommission !== "number" ||
    !Number.isFinite(
      estimatedDirectCommission
    ) ||
    estimatedDirectCommission <= 0
  ) {
    return 0;
  }

  // R$ 100 de ganho estimado ou mais = nota máxima.
  return round2(
    clamp(
      (
        estimatedDirectCommission /
        100
      ) * 30,
      0,
      30
    )
  );
}

function priorityFromScore(
  score
) {
  if (score >= 60) {
    return "high";
  }

  if (score >= 35) {
    return "medium";
  }

  return "low";
}

export function calculateOfferScore({
  discount = null,
  directCommissionPercent = null,
  estimatedDirectCommission = null
}) {
  const discountScore =
    scoreDiscount(
      discount
    );

  const commissionRateScore =
    scoreCommissionRate(
      directCommissionPercent
    );

  const estimatedEarningScore =
    scoreEstimatedEarning(
      estimatedDirectCommission
    );

  const offerScore =
    round2(
      clamp(
        discountScore +
        commissionRateScore +
        estimatedEarningScore,
        0,
        100
      )
    );

  return {
    offerScore,

    priority:
      priorityFromScore(
        offerScore
      ),

    scoreBreakdown: {
      discountScore,
      commissionRateScore,
      estimatedEarningScore
    },

    scoreVersion:
      "TT-1.0"
  };
}
