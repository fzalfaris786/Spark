import {createModuleCommand, fail, infoEmbed, safeReply} from "../commandFactory.js";
import {LOG_CATEGORIES, getLoggingConfig} from "./services/index.js";

export default createModuleCommand("logging-status","View logging status and enabled event categories.",[],async i=>{if(!i.guild)return fail(i,"Server only","Run this command in a server.");const c=await getLoggingConfig(i.guild.id);return safeReply(i,{embeds:[infoEmbed("Logging status",`Enabled: **${c.enabled}**\nChannel: ${c.channelId?`<#${c.channelId}>`:"Not configured"}\nCategories: ${c.enabledEvents.length?c.enabledEvents.join(", "):"None"}`,{fields:[{name:"Available categories",value:LOG_CATEGORIES.join(" · ")}]})]});});
