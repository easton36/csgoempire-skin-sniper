const mongoose = require('mongoose');

module.exports = mongoose.model('items', new mongoose.Schema({
    name: { //item name
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
    },
    dateUpdated: { //date item was inserted to db, items updated every hour
        type: Number,
        default: new Date().toUTCString()
    }
}, {
    versionKey: false
}));