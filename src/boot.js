'use strict';

const winston = require('winston');
const Promise = require('bluebird');
const mongoose = require('mongoose');

module.exports = (uri, config, cb) => {
    const db = mongoose.connection;

    if (config.env == 'development') {
        mongoose.set('debug', true);
    }

    db.on('connecting', () => winston.info(`Connecting to '${config.database }'`));

    db.on('connected', () => winston.info(`Connected to '${config.database }'`));

    db.on('open', () => winston.info('Connection opened!'));

    db.on('close', () => winston.info('Connection closed.'));

    db.on('disconnected', () => winston.info(`Disconnected from '${config.database }'`));

    db.on('reconnected', () => winston.info(`Reconnected to '${config.database }'`));

    db.on('error', () => {
        winston.error('Error connecting to database.');
    });

    db.on('fullsetup', () => winston.error('FULLSETUP!'));

    mongoose.Promise = Promise;
    mongoose.connect(uri, config, cb);

    // If the Node process ends, close the Mongoose connection
    process.on('SIGINT', () => {
        mongoose.connection.close(() => {
            winston.info('Mongoose disconnected on app termination');
            process.exit(0);
        });
    });
};
