'use strict';

const winston = require('winston');
const synaptic = require('synaptic');
const fs = require('fs');
const ANN_BASE_PATH = process.env.ANN_BASE_PATH || '.';

const Network = synaptic.Network;
const Architect = synaptic.Architect;
const Trainer = synaptic.Trainer;

/**
 * @name buildInputItem
 * @param {object} past
 * @param {object} current
 * It builds the following input values for the neural network:
 * 1) percentage change in open price
 * 2) percentage change in high price
 * 3) percentage change in low price
 * 4) percentage change in last
 * 5) percentage change in volume
 * @returns {array}
 */
const buildInputItem = (past, current) => {
    const items = [];
    items.push(current.open > past.open ? 1 : 0);
    items.push(current.high > past.high ? 1 : 0);
    items.push(current.low > past.low ? 1 : 0);
    items.push(current.last > past.last ? 1 : 0);
    items.push(current.volume > past.volume ? 1 : 0);
    return items;
};

/**
 * @name getInput
 * @param {array} window
 * @param {object} past
 * @returns {array}
 * Receives a window of prices and the previous price
 * for each price calls buildInputItem
 */
const getInput = (window, past) => {
    const item = [];
    window.forEach((price) => item.push(...buildInputItem(past, price)));
    return item;
};

/**
 * @name getOutput
 * @param {array} window
 * @param {object} past
 * @returns {array}
 * Builds the output, used for training the ANN
 */
const getOutput = (window, past) => window.map((price) => price.last > past.last ? 1 : 0 );


/**
 * @name getTrainingSet
 * @param {array} prices
 * @returns {array}
 * Creates trainingData iterating through all prices creating sliding windows
 * based on the configuration of `1` & `1`
 */
const getTrainingSet = (prices) => {
    const trainingData = [];

    for (let i = 1; i !== prices.length - 2; i++) {
        let past = prices[i - 1];

        //Sliding window
        let input = getInput(prices.slice(i, i + 1), past);
        let output = getOutput(
            prices.slice(i + 1, i + 2),
            past
        );

        trainingData.push({
            input,
            output
        });
    }

    return trainingData;
};

class ArtificialNeuralNetwork {
    constructor (symbol) {
        this.symbol = symbol;
        this.network = new Architect.Perceptron(5, 7, 1);
        this.network.optimize();
    }

    /**
     * @name train
     * @param {array} prices
     * Given a array of prices a training set is generated and train
     * function is called on the ANN.
     * When completed the function store is called.
     */
    train (prices) {
        if (!prices || !prices.length) {
            winston.error('no prices provided');
            return;
        }

        const trainer = new Trainer(this.network);
        const trainingSet = getTrainingSet(prices);

        const info = trainer.train(trainingSet, {
            rate: .1,
            iterations: 10000,
            error: .005,
            log: 500
        });

        winston.info(`training complete with ${info.iterations} iterations`);
        this.store();
    }

    /**
     * @name activate
     * @param {object} past
     * @param {object} current
     * @returns {array}
     * Creates a input item based on the params provided
     * and calls the activate function on the network
     */
    activate (past, current) {
        const item = buildInputItem(past, current);
        winston.info('activate item:: ', item);

        const result = this.network.activate(item);
        winston.info(`${this.symbol} ==> Activate result ${result}`);

        return result;
    }

    /**
     * @name propagate
     * @param {Number} expected
     * Progate the expected value through the network
     */
    propagate (expected) {
        winston.info(`${this.symbol} ==> Propagate ${expected}`);
        this.network.propagate(.1, [expected]);
    }

    /**
     * @name store
     * @returns {Promise} this promise is rejected if it fails to write the file
     * Writes the JSON format of the ANN into a file
     */
    store() {
        const file = `${ANN_BASE_PATH}/ann-${this.symbol}.json`;
        winston.info(`Writing ANN into ${file}`);

        const data = JSON.stringify(this.network.toJSON());
        return new Promise((resolve, reject) => {
            fs.writeFile(file, data, (err) => {
                if (err) {
                    winston.error(`Failed to write file ${file}`);
                    return reject(err);
                }

                return resolve();
            });
        });
    }

    /**
     * @name load
     * @returns {Promise} this promise is rejected if it fails to open file or parse the JSON content
     * Reads a existing ANN configuration and loads it
     */
    load() {
        const file = `${ANN_BASE_PATH}/ann-${this.symbol}.json`;
        winston.info(`Reading ANN from ${file}`);

        return new Promise((resolve, reject) => {
            fs.readFile(file, 'utf8', (err, data) => {
                if (err) {
                    winston.error(`Failed to read file ${file}`);
                    return reject(err);
                }

                try {
                    this.network = Network.fromJSON(JSON.parse(data));
                } catch (ex) {
                    console.log(ex);
                    return reject(ex);
                }

                resolve();
            });
        });
    }
}

module.exports = ArtificialNeuralNetwork;
