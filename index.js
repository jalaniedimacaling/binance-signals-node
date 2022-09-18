const ejs = require('ejs');
const Binance = require('node-binance-api');
const TelegramBot = require('node-telegram-bot-api');
const prettyjson = require('prettyjson');

require('dotenv').config();

const binance = new Binance().options({
  APIKEY: process.env.BINANCE_API_KEY,
  APISECRET: process.env.BINANCE_API_SECRET,
});
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

async function main() {
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

main();
console.log('Binance Signals Application Started!');
