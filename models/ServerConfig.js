const mongoose = require('mongoose');

const ServerConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    inviteLogChannelId: { type: String, default: null },
    ticketCategoryChannelId: { type: String, default: null },
    storeChannelId: { type: String, default: null }
});

module.exports = mongoose.model('ServerConfig', ServerConfigSchema);
