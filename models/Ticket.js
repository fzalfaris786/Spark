const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true, unique: true },
    claimedBy: { type: String, default: null },
    status: { type: String, default: 'open' }
});

module.exports = mongoose.model('Ticket', TicketSchema);
