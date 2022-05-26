const axios = require('axios');
const JSONStream = require('JSONStream');
const es = require('event-stream');
const request = require('request');
const mongoose = require('mongoose');
const Items = require('./classes/price.schema');

const config = require('./config.js');

//db connection
mongoose.connect(`mongodb://127.0.0.1:27017/empire-sniper`, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.set('useFindAndModify', false);

var num = 0;

(async ()=>{
    console.log('[!] Fetching prices from pricempire...');
	
	try{
		request({
			method: 'GET',
			url: `https://api.pricempire.com/v1/getAllItems?token=${config.pricempireKey}`
		})
		.pipe(JSONStream.parse('*.*'))
		.pipe(es.mapSync(async (item)=>{
			if(!item || !item.prices.buff163) return;
			num++;

			let itemObject = {
				name: item.name,
				price: Math.round(item.prices.buff163.price * config.CNY2USD),
				dateUpdated: Date.now(item.prices.buff163)
			};

			try{
				await Items.replaceOne({ name: item.name }, itemObject, {upsert: true});
			} catch(err){
				console.log(`[!!!] Please install mongodb!`);
				process.exit(22);
			}

			console.log(`[${num}] Inserted: ${item.name} ($${(itemObject.price/100).toFixed(2)})`);
		}));
	} catch(err){
		console.log(err);
	}
	
})();