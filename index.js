const ejs = require('ejs');
const express = require('express');
const Binance = require('node-binance-api');
const cron = require('node-cron');
const fetch = require('node-fetch');
const TelegramBot = require('node-telegram-bot-api');
const prettyjson = require('prettyjson');
const app = express();

require('dotenv').config();

const binance = new Binance().options({
  APIKEY: process.env.BINANCE_API_KEY,
  APISECRET: process.env.BINANCE_API_SECRET,
});
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);
const port = process.env.PORT || 80;

async function service() {
  if (bot.isPolling()) {
    await bot.stopPolling();
  }
  await bot.startPolling();

  const sendMessage = async (data) => {
    const jsonData = prettyjson.render(data, {
      noColor: true,
    });
    const message = await ejs.renderFile('templates/message.ejs', {
      code: jsonData,
    });
    bot.sendMessage(process.env.TELEGRAM_CHAT_ID, message, {
      parse_mode: 'HTML',
    });
  };

  binance.websockets.userFutureData(
    function (data) {
      console.log('=== MARGIN CALL ===');
      sendMessage(data);
    },
    function (data) {
      console.log('=== ACCOUNT UPDATE ===');
      sendMessage(data);
    },
    function (data) {
      console.log('=== ORDER TRADE UPDATE ===');
      sendMessage(data);
    }
  );
}

async function scheduler() {
  cron.schedule('*/5 * * * *', async () => {
    try {
      await fetch(process.env.INACTIVITY_CHECK_URL);
    } catch (err) {
      console.log(err);
    }
  });
}

async function main() {
  service();
  scheduler();

  app.get('/', (req, res) => {
    res.send('Running Express');
  });

  app.get('/health', (req, res) => {
    const data = {
      uptime: process.uptime(),
      message: 'Ok',
      date: new Date(),
    };

    res.status(200).send(data);
  });

  app.listen(port, () => {
    console.log(`Binance Signals Application listening on port ${port}`);
  });
}

main();

module.exports = app;
