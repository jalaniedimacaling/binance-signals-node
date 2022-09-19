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
  const sendMessage = async (data) => {
    console.log('-----');
    console.log(JSON.stringify(data, null, 2)); // for checking data
    let template;
    let content;
    switch (data.eventType) {
      case 'ORDER_TRADE_UPDATE':
        template = 'order-trade-update-msg.ejs';
        const order = data.order;
        const positionRisks = await binance.futuresPositionRisk();
        const positionData = positionRisks.find((positionRisk) => {
          return (
            positionRisk.symbol === order.symbol &&
            positionRisk.positionSide === order.positionSide
          );
        });
        content = {
          ...order,
          leverage:
            (positionData &&
              `${
                positionData.leverage
              } ${positionData.marginType.toUpperCase()}`) ||
            '',
          margin:
            (positionData && order.bidsNotional / positionData.leverage) || 0,
          positionSide:
            order.positionSide === 'BOTH' ? '' : ` ${order.positionSide}`,
        };
        break;
      case 'ACCOUNT_UPDATE':
        const updateData = data.updateData;
        const balance = updateData.balances[0];
        content = {
          ...balance,
          type: updateData.eventReasonType,
        };
        if (updateData.eventReasonType === 'FUNDING_FEE') {
          template = 'account-update-funding-fee-msg.ejs';
          break;
        } else if (updateData.eventReasonType === 'ORDER') {
          template = 'account-update-order-msg.ejs';
          break;
        }
      default:
        template = 'general-msg.ejs';
        const prettyJsonData = prettyjson.render(data, {
          noColor: true,
        });
        content = {
          data: prettyJsonData,
        };
    }
    const message = await ejs.renderFile(`templates/${template}`, content);
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
