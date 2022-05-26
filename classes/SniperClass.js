const totp = require("totp-generator");
const io = require('socket.io-client');
const axios = require('axios');
const mongoose = require('mongoose');
const Items = require('./price.schema');

//db connection
mongoose.connect(`mongodb://127.0.0.1:27017/empire-sniper`, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.set('useFindAndModify', false);

const config = require('../config.js');

const cookie = config.cookie;
const secret = config.secret;
const uuid = config.uuid;
const code = config.code;

const maxBuffPercent = config.maxBuffPercent;
const minPrice = (config.minPrice / 0.614) * 100;
const maxPrice = (config.maxPrice / 0.614) * 100;

function bidValue(price, number){
    let e = Number(`0.0${number}`) * price;
    if(e < 1) e = 1;
    return Math.round(e + price);
}

const fetchUserInfo = async ()=>{
    try{
        let data = await axios({
            method: 'GET',
            url: 'https://csgoempire.com/api/v2/metadata',
            headers: {
                Cookie: cookie,
                'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36 OPR/71.0.3770.234",
                'Referer': 'https://csgoempire.com/withdraw',
                'Accept': '/',
                'Connection': 'keep-alive',
            }
        });

        if(data.data){
            return data.data;
        }
    } catch(err){
        if(err.response?.data){
            if(err.response?.data?.blocked){
                console.log(`[!!!] CSGOEmpire has blocked the country: ${err.response.data.country}.`);
            } else if(err.response?.data?.token_expired){
                console.log('[!!!] CSGOEmpire cookie is invalid.');
            } else{
                console.log(err.response.data);
            }
        } else{
            console.log(err);
        }
        
        process.exit(22);
    }
}

//fetches one time user token
const getOneTimeToken = async (customCookie)=>{
    if(customCookie == undefined) customCookie = cookie;
    let authCode = (customCookie == cookie) ? totp(secret) : "0000";

    let standardBody = {
        code: authCode,
        remember_device: true,
        type: 'standard',
        uuid: uuid
    };

    let oneTimeBody = {
        code: authCode,
        uuid: uuid
    };

    try{
        let data = await axios({
            method: 'POST',
            url: 'https://csgoempire.com/api/v2/user/security/token',
            headers: {
                Cookie: customCookie,
                'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36 OPR/71.0.3770.234",
                'Referer': 'https://csgoempire.com/withdraw',
                'Accept': '/',
                'Connection': 'keep-alive',
                'x-empire-device-identifier': uuid
            },
            data: (customCookie == cookie) ? standardBody : oneTimeBody
        });

        if(data.data){
            if(customCookie == cookie){
                if(data.headers['set-cookie'].length == 1){
                    return ((data.headers['set-cookie'][0]).split(';'))[0]
                }
                return ((data.headers['set-cookie'][1]).split(';'))[0];
            }
            return data.data.token;
        }
    } catch(err){
        console.log(err)
        return false;
    }
}

const sendBidRequest = async ({bid, deposit_id, item, name, cookie})=>{
    let token = await getOneTimeToken(cookie);
    if(!token) {
        console.log("\x1b[31m", `Error bidding on: ${name}; You can only place one bid every 30 seconds.`,"\x1b[0m");
        return false;
    }

    try{
        let data = await axios({
            method: 'POST',
            url: 'https://csgoempire.com/api/v2/trade/auction/place-bid',
            headers: {
                Cookie: cookie,
                'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36 OPR/71.0.3770.234",
                'Referer': 'https://csgoempire.com/withdraw',
                'Accept': '/',
                'Connection': 'keep-alive',
            },
            data: {
                bid_value: bid,
                deposit_id,
                item_id: item,
                security_token: token
            }
        });

        if(data.data){
            console.log("\x1b[32m", `Bid placed on: ${name}`, "\x1b[0m");
            return {...data.data, assetid: item};
        }
    } catch(err){
        if(err.response?.data?.message){
            console.log("\x1b[31m", `Error bidding on: ${name}; ${err.response.data.message}`,"\x1b[0m");
        }else{
            console.log(err);
        }
        return false;
    }
}

module.exports = function(){
    this.activeBids = [];
    this.userId;
    this.uuid;

    //authenticate csgoempire
    this.auth = ()=>{
        this.socket = io(`wss://trade.csgoempire.com/trade`, {
            path: "/s",
            transports: ['websocket'],
            secure: true,
            rejectUnauthorized: false,
            reconnect: true,
            extraHeaders: {'User-agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36 OPR/71.0.3770.234"}
        });

        this.socket.on('connect', async ()=>{
            let userData = await fetchUserInfo();
            this.userId = userData.user.id;

            this.device_auth = await getOneTimeToken();
            this.cookie = `${cookie}; ${this.device_auth}`;

            //emit to socket to basically login
            this.socket.emit('identify', {
                uid: userData.user.id,
                model: userData.user,
                authorizationToken: userData.socket_token,
                signature: userData.socket_signature
            });

            console.log(`[!] Authenticated to account ${userData.user.steam_name} (${userData.user.steam_id})\nBalance: ${userData.user.balance/100} Coins ($${((userData.user.balance*0.614)/100).toFixed(2)})\n`);

            this.socket.on('new_item', (item)=>this.checkItem(item));
            this.socket.on('auction_update', (item)=>this.checkAuction(item));

            this.socket.on('trade_status', async (data)=>{
                if(data.type !== 'withdrawal') return;

                if(data.data.status_text == 'Received'){
                    let itemPrice = await Items.findOne({name: data.data.items[0].market_name});
                    if(!itemPrice) return;
                    itemPrice = Number(itemPrice.price);

                    let buffPercent = ((data.data.items[0].market_value * 0.614) * 100) / itemPrice;

                    console.log("\x1b[32m", `[!!!] Purchased Item: ${data.data.items[0].market_name} for $${((data.data.total_value / 100) * 0.614).toFixed(2)} (${buffPercent.toFixed(2)}% Buff)`, "\x1b[0m");
                }
            })
        });
    };

    this.removeAuction = (assetid)=>{
        let auctionIndex = this.activeBids.findIndex(x => x.assetid == assetid || x.asset_id == assetid);
        this.activeBids.splice(auctionIndex, 1);

        return true;
    }

    this.confirmAuction = async (item, deposit_id, auctionLog)=>{
        let token = await getOneTimeToken(this.cookie);

        try{
            let data = await axios({
                method: 'POST',
                url: 'https://csgoempire.com/api/v2/trade/withdraw',
                headers: {
                    Cookie: cookie,
                    'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36 OPR/71.0.3770.234",
                    'Referer': 'https://csgoempire.com/withdraw',
                    'Accept': '/',
                    'Connection': 'keep-alive',
                },
                data: {
                    item_ids: [item],
                    bot_id: deposit_id,
                    security_token: token
                }
            });

            if(data){
                if(data.data.success){
                    console.log("\x1b[32m", `[!!!] Won auction for ${data.data.data.items[0].market_name}`);
                }
            }
            await this.removeAuction(auctionLog.assetid);
        } catch(err){
            if(err.response?.data?.message){
                console.log("\x1b[31m", `Error withdrawing won auction: ${err.response.data.message}`,"\x1b[0m");
            } else{
                console.log(err);
            }
            
            return false;
        }
    }

    this.checkItem = async (item)=>{
        if(item.market_value < minPrice || item.market_value > maxPrice) return false;
        //check if item meets our whitelist
        if(config.do_not_snipe.some(x => item.market_name.toLowerCase().includes(x.toLowerCase()))){
            return;
        }

        let itemPrice = await Items.findOne({name: item.market_name});
        if(!itemPrice) return;
        itemPrice = Number(itemPrice.price);

        let buffPercent = ((item.market_value * 0.614) * 100) / itemPrice;

        console.log(`Checking New Item ${item.market_name} at $${((item.market_value / 100) * 0.614).toFixed(2)} vs Buff Price at $${itemPrice / 100} (${buffPercent.toFixed(2)}% Buff)`);

        if(buffPercent <= maxBuffPercent){
            console.log(`\x1b[33m%s\x1b[0m`, `[!] Bidding New Item $${((item.market_value / 100) * 0.614).toFixed(2)} on ${item.market_name}`, "\x1b[0m");

            let bidData = await sendBidRequest({bid: item.market_value, deposit_id: item.bot_id, item: item.assetid, name: item.market_name, cookie: this.cookie});
            if(bidData){
                let bidInfo = {
                    ...bidData,
                    deposit_id: item.bot_id,
                    user_id: bidData.auction_highest_bidder,
                    market_value: item.market_value,
                    name: item.market_name,
                    price: itemPrice,
                    endsAt: item.auction_ends_at,
                    confirmTime: setTimeout(()=>this.confirmAuction(item.assetid, item.bot_id, {assetid: item.assetid}), (item.auction_ends_at * 1000) - Date.now())
                }
                this.activeBids.push(bidInfo);
            }
        }
    }

    this.checkAuction = async (auction)=>{
        let auctionLog = this.activeBids.find(x => x.assetid == auction.asset_id);
        if(!auctionLog) return false;
        if(auctionLog.endsAt !== auction.auction_ends_at && auction.auction_highest_bidder == this.userId){
            return this.confirmAuction(auctionLog.assetid, auctionLog.deposit_id, auctionLog)
        }
        if(auctionLog.assetid){
            if(auction.auction_highest_bid < minPrice || auction.auction_highest_bid > maxPrice) return false;

            let valueAfterIncrease = bidValue(auctionLog.market_value, auction.auction_number_of_bids);
            let buffPercent = ((valueAfterIncrease * 0.614) * 100) / auctionLog.price;

            console.log(`Checking Auction Item ${auctionLog.name} at $${((auctionLog.market_value / 100) * 0.614).toFixed(2)} vs Buff Price at $${auctionLog.price / 100} (${buffPercent.toFixed(2)}% Buff)`);

            if(buffPercent <= maxBuffPercent){
                console.log(`\x1b[33m%s\x1b[0m`, `[!] Bidding Auction $${(valueAfterIncrease / 100).toFixed(2)} on ${auctionLog.name}`, "\x1b[0m");

                let bidData = await sendBidRequest({bid: valueAfterIncrease, deposit_id: auctionLog.deposit_id, item: auction.asset_id, name: auctionLog.name, cookie: this.cookie});
                if(bidData){
                    await this.removeAuction(auction.assetid);
                    let bidInfo = {
                        ...bidData,
                        ...auctionLog
                    }
                    return this.activeBids.push(bidInfo);
                }
            }
            return this.removeAuction(auction.assetid);
        }
    }

    console.log('[!] Starting Empire Sniper');
    this.auth();
}