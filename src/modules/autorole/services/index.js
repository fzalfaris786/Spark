import {PermissionFlagsBits as P} from "discord.js";
import {getConfig} from "../../shared.js";
import {infoEmbed, branded} from "../../commandFactory.js";

export const DEFAULTS=Object.freeze({enabled:true,memberRoleIds:[],botRoleIds:[],selfRoleIds:[],selfRoleDescriptions:{},reactionRoles:[]});
export async function getAutoroleConfig(guildId){return {...DEFAULTS,...(await getConfig("autorole",guildId))};}
export const privilegedPermissionNames=[
  "Administrator","ManageGuild","ManageRoles","ManageChannels","ManageMessages","BanMembers","KickMembers",
  "ModerateMembers","ManageWebhooks","ManageEvents","ManageGuildScheduledEvents","ManageGuildExpressions",
  "ManageEmojisAndStickers","ManageThreads","ManageNicknames","ViewAuditLog","MentionEveryone","ManageServer",
  "ManageMessages","CreateInstantInvite","MoveMembers","MuteMembers","DeafenMembers"
];
export const privilegedBits=[...new Set(privilegedPermissionNames.map(name=>P[name]).filter(bit=>typeof bit==="bigint"||typeof bit==="number"))];
export function manageableRole(guild,role){
  const bot=guild.members.me;
  if(!role||role.id===guild.id||role.managed||!bot?.permissions.has(P.ManageRoles))return false;
  if(bot.roles.highest.comparePositionTo(role)<=0)return false;
  return true;
}
export function safeSelfRole(role){return !privilegedBits.some(bit=>role.permissions.has(bit));}
export async function handleAutoroleMemberAdd(member){
  if(!member.guild)return;
  const cfg=await getAutoroleConfig(member.guild.id);if(!cfg.enabled)return;
  const ids=member.user.bot?cfg.botRoleIds:cfg.memberRoleIds;const bot=member.guild.members.me;
  if(!bot?.permissions.has(P.ManageRoles))return;
  for(const id of ids||[]){
    const role=member.guild.roles.cache.get(id)||await member.guild.roles.fetch(id).catch(()=>null);
    if(!manageableRole(member.guild,role)||!safeSelfRole(role))continue;
    await member.roles.add(role,"Configured automatic role on member join").catch(e=>console.warn(`[autorole] Could not add role ${id}: ${e.message}`));
  }
}
export function normalizedEmoji(emoji){
  const id=String(emoji?.id||"");return id?`custom:${id}`:`unicode:${emoji?.name||emoji}`;
}
export function parseEmojiInput(input){
  const value=String(input||"").trim();
  const custom=value.match(/^(<a?:[A-Za-z0-9_]+:(\d{15,22})>)$/);
  if(custom)return {react:custom[1],key:`custom:${custom[2]}`};
  if(!value||value.length>16||/^[\w ]+$/.test(value))return null;
  return {react:value,key:`unicode:${value}`};
}
export async function handleReactionRole(reaction,user,adding){
  if(user?.bot)return;
  if(reaction.partial)reaction=await reaction.fetch().catch(()=>null);if(!reaction?.message?.guild)return;
  const message=reaction.message,guild=message.guild,cfg=await getAutoroleConfig(guild.id),key=normalizedEmoji(reaction.emoji);
  const entry=(cfg.reactionRoles||[]).find(r=>r.messageId===message.id&&r.emojiKey===key);if(!entry)return;
  const role=guild.roles.cache.get(entry.roleId)||await guild.roles.fetch(entry.roleId).catch(()=>null),member=await guild.members.fetch(user.id).catch(()=>null);
  if(!role||!member||!manageableRole(guild,role)||!safeSelfRole(role))return;
  try{if(adding&&!member.roles.cache.has(role.id))await member.roles.add(role,"Configured reaction role");else if(!adding&&member.roles.cache.has(role.id))await member.roles.remove(role,"Configured reaction role removed");}
  catch(error){console.warn(`[reaction-role] Could not ${adding?"add":"remove"} role ${entry.roleId}: ${error.message}`);}
}
export async function handleAutoroleComponent(interaction){
  if(!interaction.isButton?.()||!interaction.customId.startsWith("selfrole:"))return false;
  if(!interaction.guild||!interaction.member)return true;
  if(!interaction.deferred&&!interaction.replied)await interaction.deferReply({ephemeral:true});
  const roleId=interaction.customId.slice("selfrole:".length);const cfg=await getAutoroleConfig(interaction.guild.id);
  if(!cfg.selfRoleIds.includes(roleId)){
    await interaction.editReply({embeds:[failEmbed("Role unavailable","This self-role was removed from the server configuration.")]}).catch(()=>{});return true;
  }
  const role=interaction.guild.roles.cache.get(roleId)||await interaction.guild.roles.fetch(roleId).catch(()=>null);
  const member=await interaction.guild.members.fetch(interaction.user.id).catch(()=>null);
  const bot=interaction.guild.members.me;
  if(!role||!member||!manageableRole(interaction.guild,role)||!safeSelfRole(role)||!bot?.permissions.has(P.ManageRoles)){
    await interaction.editReply({embeds:[failEmbed("Role unavailable","The bot cannot safely manage this role. Please contact a server administrator.")]}).catch(()=>{});return true;
  }
  try{
    if(member.roles.cache.has(role.id)){await member.roles.remove(role,"Self-role button toggle");await interaction.editReply({embeds:[infoEmbed("Role removed",`Removed ${role} from your roles.`)]});}
    else{await member.roles.add(role,"Self-role button toggle");await interaction.editReply({embeds:[infoEmbed("Role added",`Added ${role} to your roles.`)]});}
  }catch(error){console.error("[selfrole:toggle]",error);await interaction.editReply({embeds:[failEmbed("Could not update role","Check the bot's Manage Roles permission and role hierarchy.")]}).catch(()=>{});}
  return true;
}
export function failEmbed(title,description){return branded(title,description,{color:0xF05D6C});}

