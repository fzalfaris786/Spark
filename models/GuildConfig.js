const mongoose = require('mongoose');

const GuildConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    // Welcome Panel Setup
    welcomeTitle: String,
    welcomeMessage: String,
    welcomeChannel: String,
    welcomeThumbnail: String,
    welcomeDm: String,
    // Ticket Panel Setup
    ticketDescription: String,
    ticketParent: String,
    ticketLogs: String,
    ticketMessage: String
});

module.exports = mongoose.model('GuildConfig', GuildConfigSchema);
