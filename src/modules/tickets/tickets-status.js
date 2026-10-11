import {createModuleCommand, fail, infoEmbed, safeReply} from "../commandFactory.js";
import {getTicketConfig} from "./services/index.js";

export default createModuleCommand("tickets-status","Show ticket system configuration and status.",[],async i=>{if(!i.guild)return fail(i,"Server only","Run this command in a server.");const c=await getTicketConfig(i.guild.id);const category=c.categoryId?i.guild.channels.cache.get(c.categoryId):null;return safeReply(i,{embeds:[infoEmbed("Ticket system status",`Enabled: **${c.enabled}**\nCategory: ${category||"Not set"}\nSupport role: ${c.supportRoleId?`<@&${c.supportRoleId}>`:"Not set"}\nTranscript channel: ${c.logChannelId?`<#${c.logChannelId}>`:"Not set"}\nOpen ticket limit: **${c.maxOpenPerMember} per member**`)]});});
