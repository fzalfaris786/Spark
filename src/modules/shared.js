import {getDatabase} from "../database/mongodb.js";
import {PermissionFlagsBits, ChannelType, EmbedBuilder} from "discord.js";
import {brandEmbed, successEmbed, errorEmbed, warningEmbed, infoEmbed} from "../utils/embeds.js";

const memory = new Map();
const keyOf = (module, guildId) => `${module}:${guildId}`;
const documentWithoutId = value => { const {_id, ...rest} = value || {}; return rest; };
function database(){try{return getDatabase();}catch{return null;}}
export async function getConfig(module, guildId) {
  const key=keyOf(module,guildId);
  if(memory.has(key))return memory.get(key);
  const db=database();
  if(db){
    try{
      const saved=await db.collection(`${module}_settings`).findOne({guildId});
      const value=saved?documentWithoutId(saved):{guildId};memory.set(key,value);return value;
    }catch(error){console.warn(`[settings:${module}] Read failed; using memory fallback: ${error.message}`);}
  }
  return memory.get(key)||{guildId};
}
export async function saveConfig(module, guildId, patch) {
  const current=documentWithoutId(await getConfig(module,guildId));
  const next={...current,...patch,guildId,updatedAt:new Date()};
  memory.set(keyOf(module,guildId),next);
  const db=database();
  if(db){try{await db.collection(`${module}_settings`).updateOne({guildId},{$set:documentWithoutId(next)},{upsert:true});}
    catch(error){console.warn(`[settings:${module}] Write failed; latest values remain in memory until process restart: ${error.message}`);}}
  return next;
}
export async function deleteConfig(module, guildId) {
  memory.delete(keyOf(module,guildId));
  const db=database();if(db)try{await db.collection(`${module}_settings`).deleteOne({guildId});}catch(error){console.warn(`[settings:${module}] Delete failed: ${error.message}`);}
}
export async function insertRecord(collection, record) {
  const db=database();if(!db)return false;
  try{await db.collection(collection).insertOne(record);return true;}catch(error){console.warn(`[records:${collection}] Insert failed: ${error.message}`);return false;}
}
export async function listRecords(collection, filter = {}, limit = 100) {
  const db=database();if(!db)return [];
  try{return await db.collection(collection).find(filter).sort({createdAt:-1}).limit(limit).toArray();}catch(error){console.warn(`[records:${collection}] Read failed: ${error.message}`);return [];}
}
export async function updateRecord(collection, filter, update, options = {}) {
  const db=database();if(!db)return null;
  try{return await db.collection(collection).updateOne(filter,update,options);}catch(error){console.warn(`[records:${collection}] Update failed: ${error.message}`);return null;}
}
export function guildOnly(interaction) { return interaction.inGuild(); }
export function isManager(member) { return Boolean(member?.permissions?.has(PermissionFlagsBits.ManageGuild) || member?.permissions?.has(PermissionFlagsBits.Administrator)); }
export function denyManager(interaction) { return interaction.reply({embeds: [errorEmbed("Permission required", "You need **Manage Server** or **Administrator** to change this module.")], ephemeral: true}); }
export function getTextChannel(guild, id) { const c=id&&guild.channels.cache.get(id);return c?.isTextBased()&&c.guildId===guild.id?c:null; }
export function cleanText(s, max = 1800) { return String(s ?? "").replace(/@everyone/g,"@\u200beveryone").replace(/@here/g,"@\u200bhere").slice(0,max); }
export function replaceTemplate(template, member, guild) {
  const user=member.user||member;
  return cleanText(String(template||"").replaceAll("{user}",`<@${user.id}>`).replaceAll("{username}",user.username||user.tag||"member").replaceAll("{server}",guild.name).replaceAll("{memberCount}",String(guild.memberCount??"?")).replaceAll("{userId}",user.id).replaceAll("{createdAt}",`<t:${Math.floor(user.createdTimestamp/1000)}:D>`));
}
export function parseColor(value,fallback=0x3B82F6){if(!value)return fallback;const n=Number.parseInt(String(value).replace(/^#/,""),16);return Number.isFinite(n)&&n>=0&&n<=0xFFFFFF?n:fallback;}
export function moduleEmbed(title,description,color){return new EmbedBuilder().setColor(color??0x3B82F6).setTitle(title).setDescription(description).setFooter({text:"The Origin Labs • Ideas into things that work."}).setTimestamp();}
export function option(interaction,name,type="string",required=false){const o=interaction.options;return type==="channel"?o.getChannel(name,required):type==="role"?o.getRole(name,required):type==="user"?o.getUser(name,required):type==="integer"?o.getInteger(name,required):type==="boolean"?o.getBoolean(name,required):o.getString(name,required);}
export {ChannelType,brandEmbed,successEmbed,errorEmbed,warningEmbed,infoEmbed};
