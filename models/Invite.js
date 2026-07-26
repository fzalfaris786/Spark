const mongoose = require('mongoose');

const InviteSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    invites: { type: Number, default: 0 }
});

module.exports = mongoose.model('Invite', InviteSchema);
