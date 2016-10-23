# Probe Stock Market
## Goal
This project is my attempt to gather multiple sources of knowledge and make wiser decisions on when to buy/sell securities.

## How it works?
### Data collected:
At the moment this project collects the following information:
* Articles from bloomberg, cnbc, reuters, seeking-alpha, wcj and yahoo;
* Tweets
* Ratings on nasdaq.com website
* Prices

### Process Data:
* **Sentiment analysis:** From the articles and tweets is extracted the sentiment. The sentiment of a tweet also reflects the number of followers and the number of favorites (the ratio that this impacts the sentiment still needs some testing to reach more realistic values).
* **Technical Analysis:** From the price variations the engine will look for known patterns to trigger alerts of possible changes
* **Neural Network:** Taking advantage of the massive amount of available data, a neural network is fed with prices and it will try to learn to predict how normally price oscillations occur.

## Future works
* Improve sentiment analysis, comparing text against a list of words is not accurate enough;
* Apply technical analysis on the price data collected;
* Create a client website for management and consultation of graphs (price, sentiment, ratings, etc.);

## Technology
I've never made a "big" nodejs project, so this was also my opportunity to try out some stuff.

Some of the relevant libraries used:
* **cheerio** - used for webscraping
* **graphql** - instead of the traditional RESTfull services
* **graffiti & graffiti-mongoose** - wrapper around graphql which remove some boilerplate reusing the models from mongoose and offering queries and mutations out of the box
* **node-schedule** - job scheduler with DSL similar to unix cronjob
* **nodemailer** - to send out emails with the daily reports
* **sentiment** - AFINN-based sentiment analysis library
* **twit** - use twitter API
* **winston** - logging
* **zmq** - ZeroMQ, a queue library
* **synaptic** - Architecture-free neural network library
* **commander** - Command-line interfaces

## Usage

### Run appplication
* npm run start
* mongod

### Run neural network
* npm run neural

### Seed / Test commands
* ./seed/index.js price --interval 30 --period 20 --reset
* ./seed/index.js reports --since 3
* ./seed/index.js tweets --since 10
* ./seed/index.js train --symbol TSLA
* ./seed/index.js addprice
