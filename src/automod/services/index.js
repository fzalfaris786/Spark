import {PermissionFlagsBits as P} from "discord.js";
import {getConfig, cleanText} from "../../shared.js";
import {branded} from "../../commandFactory.js";

export const DEFAULTS=Object.freeze({enabled:false,action:"delete",blockInvites:true,blockLinks:false,antiSpamEnabled:true,maxMessages:6,spamWindowMs:8000,mentionLimit:5,capsEnabled:true,capsThreshold:0.82,capsMinLength:12,blockedWords:[],exemptRoleIds:[],exemptChannelIds:[],logChannelId:null,timeoutMinutes:10});
export async function getAutomodConfig(guildId){return {...DEFAULTS,...(await getConfig("automod",guildId))};}
export const windows=new Map(),lastAction=new Map();let lastPrune=0;
export const key=(g,u)=>`${g}:${u}`;
export function containsInvite(text){return /(?:discord\.gg\/|discord(?:app)?\.com\/invite\/|discord\.com\/invite\/)/i.test(text);}
export function hasUrl(text){return /https?:\/\/|www\./i.test(text);}
export function isExempt(message,cfg){return Boolean(message.member?.permissions?.has(P.Administrator)||message.member?.permissions?.has(P.ManageMessages)||cfg.exemptChannelIds.includes(message.channelId)||message.member?.roles?.cache?.some(r=>cfg.exemptRoleIds.includes(r.id)));}
export function spamViolation(message,cfg){
  const id=key(message.guild.id,message.author.id),now=Date.now(),entry=windows.get(id)||{times:[],lastText:"",same:0,lastAt:0};
  entry.times=entry.times.filter(t=>now-t<cfg.spamWindowMs);entry.times.push(now);
  const normalized=message.content.trim().toLowerCase().replace(/\s+/g," ");
  if(now-entry.lastAt>cfg.spamWindowMs||!normalized||normalized!==entry.lastText){entry.lastText=normalized;entry.same=normalized?1:0;}else entry.same++;
  entry.lastAt=now;
  windows.set(id,entry);
  if(cfg.antiSpamEnabled&&entry.times.length>cfg.maxMessages)return "message spam";
  if(cfg.antiSpamEnabled&&entry.same>=4)return "repeated messages";
  const mentions=(message.mentions?.users?.size||0)+(message.mentions?.roles?.size||0)+(message.mentions?.everyone?cfg.mentionLimit:0);
  if(mentions>=cfg.mentionLimit)return "mention spam";
  const alpha=message.content.replace(/[^a-z]/gi,"");
  if(cfg.capsEnabled&&alpha.length>=cfg.capsMinLength){const upper=[...alpha].filter(c=>c===c.toUpperCase()&&c!==c.toLowerCase()).length;if(upper/alpha.length>=cfg.capsThreshold)return "excessive caps";}
  return null;
}
export function wordViolation(content,words){
  const s=content.toLowerCase();
  return (words||[]).find(entry=>{
    const term=String(entry).toLowerCase().trim();if(!term)return false;
    if(term.includes(" "))return s.includes(term);
    const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`,"i").test(s);
  })||null;
}
export async function logViolation(message,cfg,reason,action){if(!cfg.logChannelId)return;const ch=await message.guild.channels.fetch(cfg.logChannelId).catch(()=>null);const bot=message.guild.members.me;if(!ch?.isTextBased?.()||!bot||!ch.permissionsFor(bot)?.has([P.ViewChannel,P.SendMessages,P.EmbedLinks]))return;await ch.send({embeds:[branded("AutoMod • Action",`A message from ${message.author} was flagged in ${message.channel}.`,{color:0xF4B740,fields:[{name:"Reason",value:reason},{name:"Action",value:action},{name:"Message",value:cleanText(message.content||"[no text]",900)}]})]}).catch(()=>{});}
export async function handleAutomodMessage(message,prefix="!",client=null){
  if(!message.guild||message.author?.bot||message.webhookId||!message.member)return;
  if(!message.content)return;
  // Ignore actual bot commands, not every message that happens to begin with the prefix.
  if(prefix && client && message.content.startsWith(prefix)){
    const invoked=message.content.slice(prefix.length).trim().split(/\s+/,1)[0]?.toLowerCase();
    if(invoked && client.prefixCommands?.has(invoked))return;
  }
  const cfg=await getAutomodConfig(message.guild.id);if(!cfg.enabled||isExempt(message,cfg))return;
  const nowForPrune=Date.now();if(nowForPrune-lastPrune>60_000&&(windows.size>1000||lastAction.size>1000)){lastPrune=nowForPrune;for(const [mapKey,value] of windows){value.times=value.times.filter(t=>nowForPrune-t<cfg.spamWindowMs);if(!value.times.length)windows.delete(mapKey);}for(const [mapKey,value] of lastAction){if(nowForPrune-value>60_000)lastAction.delete(mapKey);}}
  let reason=null;
  if(cfg.blockInvites&&containsInvite(message.content))reason="Discord invite link";
  else if(cfg.blockLinks&&hasUrl(message.content))reason="link posting";
  else{const hit=wordViolation(message.content,cfg.blockedWords);if(hit)reason=`blocked word: ${hit}`;}
  if(!reason)reason=spamViolation(message,cfg);
  if(!reason)return;
  const id=key(message.guild.id,message.author.id),now=Date.now(),recent=lastAction.get(id)||0;
  // Delete the violating message regardless of enforcement action; this prevents links/invites from spreading.
  const deleted = await message.delete().then(()=>true).catch(()=>false);
  let action=deleted ? "deleted message" : "could not delete message (check Manage Messages permission)";
  if(cfg.action==="timeout"){
    const bot=message.guild.members.me;
    if(bot?.permissions.has(P.ModerateMembers)&&message.member.moderatable){
      if(now-recent>6000){await message.member.timeout(cfg.timeoutMinutes*60_000,`AutoMod: ${reason}`).then(()=>{action=deleted?`deleted message and timed out for ${cfg.timeoutMinutes} minutes`:`could not delete message but timed out for ${cfg.timeoutMinutes} minutes`;}).catch(()=>{action=deleted?"deleted message; timeout failed due to permissions or hierarchy":"could not delete message; timeout also failed due to permissions or hierarchy";});}
      else action=deleted?"deleted message (repeat action cooldown)":"could not delete message (repeat action cooldown)";
    }else action=deleted?"deleted message; timeout unavailable due to permissions or hierarchy":"could not delete message; timeout unavailable due to permissions or hierarchy";
  }else if(cfg.action==="warn"&&now-recent>6000){
    if(deleted){action="deleted message and issued a public warning";const notice=await message.channel.send({embeds:[branded("AutoMod • Message removed",`${message.author}, your message was removed for **${reason}**. Please follow this server's rules.`,{color:0xF4B740})],allowedMentions:{parse:[]}}).catch(()=>null);if(notice)setTimeout(()=>notice.delete().catch(()=>{}),9000);}
    else action="could not delete message; public warning not sent";
  }
  if(now-recent>6000)lastAction.set(id,now);
  await logViolation(message,cfg,reason,action);
}
export function isSafeText(v){return typeof v==="string"&&v.trim().length>0&&v.trim().length<=60;}
