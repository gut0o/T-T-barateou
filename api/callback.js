export default function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).send(`
      <h1>T&T Barateou</h1>
      <h2>Erro na autorização do Mercado Livre</h2>
      <p>${error}</p>
    `);
  }

  if (!code) {
    return res.status(200).send(`
      <h1>T&T Barateou</h1>
      <p>Callback do Mercado Livre funcionando ✅</p>
    `);
  }

  return res.status(200).send(`
    <h1>T&T Barateou</h1>
    <h2>Autorização recebida ✅</h2>
    <p>O Mercado Livre enviou o código de autorização.</p>
  `);
}