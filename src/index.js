'use strict';

const zmq = require('zmq');
const winston = require('winston');
const WolfyModels = require('wolfy-models');

const ArtificialNeuralNetwork = require('./artificial-neural-network');
const boot = require('./boot');

const neuralNetworks = {};

boot('mongodb://localhost/stocks', {
    env: 'development'
});

/**
 * @name buy
 * @param {Object} symbol
 * @param {Number} price
 * @returns {Promise}
 * Given a symbol and a price it stores a buy order
 */
const buy = (symbol, price) => {
    winston.info(`BUY ${symbol} for ${price} each`);

    const order = new WolfyModels.Order();
    order.symbol = symbol;
    order.amount = 10;
    order.isActive = true;
    order.value = 10 * price;
    order.type = 'BUY';
    return order.save();
};

/**
 * @name sell
 * @param {Object} symbol
 * @param {Number} price
 * @returns {Promise}
 * Finds any previously open orders for the given symbol
 * and stores a sell order for each
 */
const sell = (symbol, price) => {
    return WolfyModels.Order.find({
        symbol,
        type: 'BUY',
        isActive: true
    }).exec().then((orders) => {
        orders.forEach((item) => {
            winston.info(`SELL ${symbol} for ${price} each`);

            const order = new WolfyModels.Order();
            order.symbol = item.symbol;
            order.amount = item.amount;
            order.value = item.amount * price;
            order.type = 'SELL';
            order.save();

            item.isActive = false;
            item.save();
        });
    });
};

/**
 * @name onMessage
 * @param {string} topic
 * @param {string} symbol
 * @param {string} price
 * When a message is fetch from zeromq it fetchs the past price
 * Using the current and last price the neural network is fed and based on the response
 * the function buy or sell is called
 */
const onMessage = (topic, symbol, price) => {
    WolfyModels.Price.find({ symbol }).sort({'_id': 'descending'}).limit(1).skip(1).exec().then((past) => {
        price = JSON.parse(price.toString('utf8'));

        if (!price) {
            winston.error('This price object is NULL!');
            return;
        }

        const result = neuralNetworks[symbol].activate(past[0], price);
        if (result > 0.7) {
            winston.info('it predicts that this stock raise');
            return buy(symbol, price.last);
        }

        if (result < 0.3) {
            winston.info('it predicts that this stock fall');
            return sell(symbol, price.last);
        }

        winston.info('it predicts that this stock is stable');
    });
};

/**
 * @name createNetwork
 * @param {string} symbol
 * @returns {Promise}
 * Creates a the neural network, tries to load a previously saved neural network,
 * if it fails creates a new one
 */
const createNetwork = (symbol) => {
    const artificialNeuralNetwork = new ArtificialNeuralNetwork(symbol);
    neuralNetworks[symbol] = artificialNeuralNetwork;

    return artificialNeuralNetwork.load().catch(() =>
        WolfyModels.Price.find({ symbol }).exec().then((prices) => artificialNeuralNetwork.train(prices))
    );
};

const connectSocket = () => {
    const socket = zmq.socket('sub');
    socket.identity = 'subscriber' + process.pid;

    winston.info('connect to tcp://*:9998');
    socket.bindSync('tcp://127.0.0.1:9998');

    winston.info('subscribe to ADD_PRICE');
    socket.subscribe('ADD_PRICE');

    socket.on('message', onMessage);
};

WolfyModels.Stock.find().exec().then((stocks) =>
    stocks.reduce(
        (promise, stock) => promise.then(() => createNetwork(stock.symbol)),
        Promise.resolve()
    )
).then(() => connectSocket());
