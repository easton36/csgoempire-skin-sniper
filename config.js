
/* COMMANDS
npm run update - run this every so often to refresh database of prices
npm run start - run this to start the sniper
*/

//SETTINGS:
module.exports = {
    pricempireKey: '', //pricempire api key needs to go here

    cookie: 'PHPSESSID=; do_not_share_this_with_anyone_not_even_staff=', //empire cookie
    secret: '', //empire 2fa secret
    uuid: '', //empire uuid

    CNY2USD: 0.15448612, //conversion rate between CNY and USD (buff prices are in CNY, so we need this)

    maxBuffPercent: 106, //Maximum percentage empire price is above buff price
    minPrice: 0, // minimum price to snipe IN USD
    maxPrice: 10, // max price to snipe IN USD
    
    do_not_snipe: []
    // place parts of skin names as they would appear on steam, P250 not p 250
}

//HOW TO GET EMPIRE STUFF
/*
EMPIRE UUID: https://cdn.upload.systems/uploads/H0i5COiD.png

EMPIRE COOKIE VALUES (place after the equals sign for each one): https://cdn.upload.systems/uploads/7dD8HuoU.png

EMPIRE COOKIE EXAMPLE:
PHPSESSID=dsgdsgdsgds; do_not_share_this_with_anyone_not_even_staff=dghfdsghsdhgsdhghgs

GUIDE TO EXPORTING 2FA SECRETS FROM AUTHY
https://gist.github.com/gboudreau/94bb0c11a6209c82418d01a59d958c93

*/
