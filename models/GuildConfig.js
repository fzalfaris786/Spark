const mongoose = require('mongoose');

const GuildConfigSchema = new mongoose.Schema({
    guildId: { 
        type: String, 
        required: true, 
        unique: true 
    },
    // Welcome Panel Setup configurations
    welcomeTitle: { type: String, default: '' },
    welcomeMessage: { type: String, default: '' },
    welcomeChannel: { type: String, default: '' },
    welcomeThumbnail: { type: String, default: '' },
    welcomeDm: { type: String, default: '' },
    
    // Advanced Ticket Panel Setup configurations
    ticketDescription: { type: String, default: '' },
    ticketParent: { type: String, default: '' },
    ticketLogs: { type: String, default: '' },
    ticketRole: { type: String, default: '' },   // Staff Role ID authenticated authorization
    ticketMessage: { type: String, default: '' },
    ticketImage: { type: String, default: '' },   // Custom Panel Embed Banner URL storage

    // Server Stats System Data
    totalMembersChan: { type: String, default: null },
    onlinePlayersChan: { type: String, default: null },

    // 📺 YouTube Automation Configuration Data
    ytChannelId: { type: String, default: null },
    ytLiveChannel: { type: String, default: null },
    ytUploadChannel: { type: String, default: null },
    ytLastVideoId: { type: String, default: null }
});

module.exports = mongoose.model('GuildConfig', GuildConfigSchema);
