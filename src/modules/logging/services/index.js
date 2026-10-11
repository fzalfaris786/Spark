import {PermissionFlagsBits as P} from "discord.js";
import {getConfig, cleanText} from "../../shared.js";
import {branded} from "../../commandFactory.js";

export const LOG_CATEGORIES=Object.freeze(["messages","members","moderation","channels","roles","voice","server"]);
export const DEFAULTS=Object.freeze({enabled:false,channelId:null,enabledEvents:[...LOG_CATEGORIES]});
export async function getLoggingConfig(guildId){return {...DEFAULTS,...(await getConfig("logging",guildId))};}
export async function logEvent(guild,category,title,description,fields=[]){
  if(!guild?.id||!LOG_CATEGORIES.includes(category))return false;
  const cfg=await getLoggingConfig(guild.id);if(!cfg.enabled||!cfg.channelId||!cfg.enabledEvents.includes(category))return false;
  const channel=await guild.channels.fetch(cfg.channelId).catch(()=>null),bot=guild.members.me;
  if(!channel?.isTextBased?.()||!bot||!channel.permissionsFor(bot)?.has([P.ViewChannel,P.SendMessages,P.EmbedLinks]))return false;
  const safeFields=(fields||[]).slice(0,25).map(f=>({name:cleanText(f.name||"Details",256),value:cleanText(f.value||"—",1024)||"—",inline:Boolean(f.inline)}));
  await channel.send({embeds:[branded(`Server Logs • ${title}`,cleanText(description||"No details provided.",3500),{fields:safeFields})]}).catch(e=>console.warn(`[logging:${category}] ${e.message}`));return true;
}
export function currentCategory(i){return i.options.getString("category");}
