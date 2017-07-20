// This is a basic example strategy for Gekko.
// For more information on everything please refer
// to this document:
//
// https://gekko.wizb.it/docs/strategies/creating_a_strategy.html
//
// The example below is pretty bad investment advice: on every new candle there is
// a 10% chance it will recommend to change your position (to either
// long or short).

var log = require('../core/log');
var CircularBuffer = require('circular-buffer');

// configuration
var config = require('../core/util.js').getConfig();
var settings = config.stopTrailing;

// Let's create our own strat
var strat = {};


// Prepare everything our method needs
strat.init = function () {
    // this.currentTrend = 'long';
    this.positionOpen=false;

    // stats
    this.stops=0;
    this.trails=0;
    this.evens=0;

    this.stochSizes=[settings.entry.stoch1,settings.entry.stoch2,settings.entry.stoch3,settings.entry.stoch4];
    this.maxHistory=this.stochSizes.reduce((a,b)=>Math.max(a,b),0);
    this.requiredHistory = this.maxHistory+1;

    this.age=0;
    this.history=new CircularBuffer(this.maxHistory);
    this.stochastics=[{k:[0,0,0],d:0},{k:[0,0,0],d:0},{k:[0,0,0],d:0},{k:[0,0,0],d:0}];

    this.setupCompleted=false;

}


// What happens on every new candle?
strat.update = function (candle) {
    this.history.enq(candle);
    // console.log("size:",this.history.size(),this.maxHistory);
    if (this.history.size() < this.maxHistory) {
        // console.log("ret");
        return; // non funziona finchè non abbiamo tutti i dati
    }
    // console.log('update');
    this.setupCompleted=true;


    // http://stockcharts.com/school/doku.php?id=chart_school:technical_indicators:stochastic_oscillator_fast_slow_and_full

    let low = candle.low;
    let high = candle.high;
    let prevSize = 0;
    // si puo' accelerare molto l'algoritmo memorizzando gli indici dei vari low e high, e confrontando
    // di volta in volta la nuova candle con quelli. poi quando escono dalla coda si rifà la ricerca.
    for (let indicator = 0; indicator < 4; indicator++) {
        for (let i = prevSize; i < this.stochSizes[indicator]; i++) {
            let elem = this.history.get(i);
            low = Math.min(low, elem.low);
            high = Math.max(high, elem.high);
        }

        let k=100*(candle.close - low)/(high-low);
        // console.log("K:",k);
        let klist=this.stochastics[indicator].k;
        klist.push(k);
        klist.shift();
        this.stochastics[indicator].d=klist.reduce((a,b)=>a+b,0)/3;

        prevSize=this.stochSizes[indicator];
    }


};

// For debugging purposes.
strat.log = function () {
    log.debug('position open:',this.positionOpen);
    console.log("i'm here");
    // log.debug('calculated random number:');
    // log.debug('\t', this.randomNumber.toFixed(3));
}

// Based on the newly calculated
// information, check if we should
// update or not.
strat.check = function (candle) {
    if (!this.setupCompleted) return;
    // console.log("k",this.stochastics[0].k[2]);
    if (this.positionOpen) {

        if (candle.close>this.peak) {
            this.peak = candle.close;
            this.trailing=this.peak*(1.0-settings.sizing.trailing);
        }

        if (candle.close>this.breakEven) {
            this.stopLoss=this.breakEven;
            this.stopRaised=true;
        }

        let stop=candle.close<this.stopLoss;
        if (stop) {
            if (this.stopRaised) this.evens++;
            else this.stops++;
        }
        let trail=candle.close<this.trailing;
        if (trail) this.trails++;

        if ( stop || trail ) {
            this.advice('short');
            this.positionOpen=false;
            console.log('-stops:',this.stops,'trails:',this.trails,'evens:',this.evens);
        }
    } else {
        if (this.stochastics[0].k[2]<settings.entry.tresholdMin &&
            this.stochastics[1].k[2]<settings.entry.tresholdMin &&
            this.stochastics[2].k[2]<settings.entry.tresholdMin &&
            this.stochastics[3].k[2]<settings.entry.tresholdMin) {
            console.log('entry:',this.stochastics[0].k[2],this.stochastics[1].k[2],this.stochastics[2].k[2],this.stochastics[3].k[2]);
            this.advice('long');
            this.positionOpen=true;

            this.stopLoss=candle.close*(1.0-settings.sizing.r);

            this.peak=candle.close;
            this.trailing=this.peak*(1.0-settings.sizing.trailing);

            this.breakEven=candle.close*(1.0+settings.sizing.breakEven);
            this.stopRaised=false;

        }
        // else {
        //     console.log('rsi1:',this.indicators.rsi1.rsi);
        // }
    }

    // Only continue if we have a new update.
    // if(!this.toUpdate)
    //   return;
    //
    // if(this.currentTrend === 'long') {
    //
    //   // If it was long, set it to short
    //   this.currentTrend = 'short';
    //   this.advice('short');
    //
    // } else {
    //
    //   // If it was short, set it to long
    //   this.currentTrend = 'long';
    //   this.advice('long');
    //
    // }
}

module.exports = strat;