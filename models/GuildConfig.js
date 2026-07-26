const mongoose = require('mongoose');

const GuildConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    welcomeTitle: { type: String, default: '' },
    welcomeMessage: { type: String, default: '' },
    welcomeChannel: { type: String, default: '' },
    welcomeThumbnail: { type: String, default: '' },
    welcomeDm: { type: String, default: '' },
    
    ticketDescription: { type: String, default: '' },
    ticketParent: { type: String, default: '' },
    ticketLogs: { type: String, default: '' },
    ticketRole: { type: String, default: '' },   
    ticketMessage: { type: String, default: '' },
    ticketImage: { type: String, default: '' },   

    totalMembersChan: { type: String, default: null },
    inviteLogChannel: { type: String, default: null },

    // Staff Application Config
    appChannelId: { type: String, default: null },
    appStaffChannelId: { type: String, default: null },
    appQuestions: { type: [String], default: ['What is your name / age?', 'Why do you want to become staff?', 'Do you have any past experience?'] },
    appStaffRoleId: { type: String, default: '' },
    appDmApproved: { type: String, default: '🎉 Congratulations! Your staff application for {{server}} has been approved.' },
    appDmRejected: { type: String, default: '❌ Unfortunately, your staff application for {{server}} was declined.' },

    ytChannelId: { type: String, default: null },
    ytLiveChannel: { type: String, default: null },
    ytUploadChannel: { type: String, default: null },
    ytLastVideoId: { type: String, default: null },

    autoResponses: [
        {
            trigger: { type: String, lowercase: true, trim: true },
            replyText: { type: String }
        }
    ]
});

// Staff Application Session Schema for tracking active questions
const StaffAppSessionSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    currentQuestionIndex: { type: Number, default: 0 },
    answers: [String]
});

module.exports = {
    GuildConfig: mongoose.model('GuildConfig', GuildConfigSchema),
    StaffAppSession: mongoose.model('StaffAppSession', StaffAppSessionSchema)
};
