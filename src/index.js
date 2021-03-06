'use strict';

const zmq = require('zmq');
const winston = require('winston');
const Price = require('wolfy-models/src/schema/price');
const Order = require('wolfy-models/src/schema/order');
const Stock = require('wolfy-models/src/schema/stock');
const NetworkOutput = require('wolfy-models/src/schema/network-output');

const ArtificialNeuralNetwork = require('./artificial-neural-network');
const boot = require('./boot');

const ZMQ_PORT = process.env.ZMQ_PORT || 9998;
const DB_NAME = process.env.DB_NAME || 'wolfy';

const neuralNetworks = {};

boot(`mongodb://localhost/${DB_NAME}`, {
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

    const order = new Order();
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
    return Order.find({
        symbol,
        type: 'BUY',
        isActive: true
    }).exec().then((orders) => {
        orders.forEach((item) => {
            winston.info(`SELL ${symbol} for ${price} each`);

            const order = new Order();
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
 * @name activate
 * @param {String} symbol
 * @param {Object} oldPrice
 * @param {Object} newPrice
 * Propagates through the network the previous values expected
 * output, so that the neural network learns
 */
const propagate = (symbol, oldPrice, newPrice) => {
    let expected = .5;

    if (newPrice.last > oldPrice.last) { expected = 1; }
    else if (newPrice.last < oldPrice.last) { expected = 0; }

    neuralNetworks[symbol].propagate(expected);
};

/**
 * @name activate
 * @param {String} symbol
 * @param {Object} oldPrice
 * @param {Object} newPrice
 * @returns {Null}
 * Calls the activate function on the neural network with the old and new
 * price, it stores the output on the DB.
 * If the value is higher then 0,7 then it predicts that the price will rise
 * if lower 0,3 then the price will fall otherwise it will be stable.
 */
const activate = (symbol, oldPrice, newPrice) => {
    const result = neuralNetworks[symbol].activate(oldPrice, newPrice);

    const output = new NetworkOutput();
    output.symbol = symbol;
    output.result = parseFloat(result);
    output.save();

    if (result > 0.7) {
        winston.info('it predicts that this stock raise');
        return buy(symbol, newPrice.last);
    }

    if (result < 0.3) {
        winston.info('it predicts that this stock fall');
        return sell(symbol, newPrice.last);
    }

    winston.info(`it predicts that this stock is stable ==> ${result}`);
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
    Price.find({ symbol }).sort({'_id': 'descending'}).limit(2).skip(1).exec().then((past) => {
        price = JSON.parse(price.toString('utf8'));

        if (!price) {
            winston.error('This price object is NULL!');
            return;
        }

        propagate(symbol, past[1], past[0]);
        activate(symbol, past[0], price);
        return neuralNetworks[symbol].store();
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
        Price.find({ symbol }).exec().then((prices) => artificialNeuralNetwork.train(prices))
    );
};

const connectSocket = () => {
    const socket = zmq.socket('sub');
    socket.identity = 'subscriber' + process.pid;

    winston.info(`connect to tcp://*:${ZMQ_PORT}`);
    socket.bindSync(`tcp://127.0.0.1:${ZMQ_PORT}`);

    winston.info('subscribe to ADD_PRICE');
    socket.subscribe('ADD_PRICE');

    socket.on('message', onMessage);
};

Stock.find().exec().then((stocks) =>
    stocks.reduce(
        (promise, stock) => promise.then(() => createNetwork(stock.symbol)),
        Promise.resolve()
    )
).then(() => connectSocket());
