module.exports = {
  apps: [
    {
      name: "tt-barateou",
      script: "whatsapp/publish-queue.js",
      cwd: __dirname,

      autorestart: true,
      restart_delay: 5000,
      min_uptime: "10s",
      max_restarts: 20,

      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      env: {
        NODE_ENV: "production",

        TT_SEND_START_HOUR: "9",
        TT_SEND_END_HOUR: "22",
        TT_SEND_TIMEZONE: "America/Sao_Paulo"
      }
    }
  ]
};
