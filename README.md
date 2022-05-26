# csgoempire-skin-sniper
Script to snipe skins off of csgoempire.com

### Script will cease to work if csgoempire or pricempire updates their APIs

## Requirements
 - Node.js version 14.x or newer
 - Basic installation of MongoDB
 - A CSGOEmpire.com account
 - A pricempire.com API key

## Installation
- `git clone https://github.com/easton-s/csgoempire-skin-sniper`
- `cd csgoempire-skin-sniper`
- `npm install`
- `npm run update`
- `npm run start`

## Commands

- npm install - run this on inital download to install all dependencies
- npm run update - run this every so often to refresh database of prices
- npm run start - run this to start the sniper

## Settings

- All settings are placed in config.js

## How to get empire secrets

- UUID: ![How to get uuid](https://cdn.upload.systems/uploads/H0i5COiD.png)
- Cookie Values: ![How to get cookie values](https://cdn.upload.systems/uploads/7dD8HuoU.png)
  - The cookie values need to be placed in a string like: `PHPSESSID=VALUE HERE; do_not_share_this_with_anyone_not_even_staff=VALUE HERE`
