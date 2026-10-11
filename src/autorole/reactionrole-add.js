import {PermissionFlagsBits as P} from "discord.js";
import {createModuleCommand, managerOnly, denyPermission, ok, fail} from "../commandFactory.js";
import {saveConfig} from "../shared.js";
import {getAutoroleConfig, manageableRole, safeSelfRole, parseEmojiInput} from "./services/index.js";

export default createModuleCommand("reactionrole-add","Bind a Unicode or custom emoji reaction to a role on a message.",[
    {type:"string",name:"message_id",description:"Message ID in the selected channel",required:true,minLength:15,maxLength:22},
    {type:"string",name:"emoji",description:"Unicode emoji or custom emoji such as <:name:id>",required:true,maxLength:100},
    {type:"role",name:"role",description:"Role granted while reacting",required:true},
    {type:"channel",name:"channel",description:"Channel containing the message (defaults to current)",channelType:"text"},
  ],async i=>{
    if(!i.guild)return fail(i,"Server only","Run this command in a server.");if(!managerOnly(i,P.ManageRoles))return denyPermission(i,"Manage Roles");
    const id=i.options.getString("message_id",true).trim(),input=i.options.getString("emoji",true),role=i.options.getRole("role",true),channel=i.options.getChannel("channel")||i.channel,emoji=parseEmojiInput(input);
    if(!/^\d{15,22}$/.test(id))return fail(i,"Invalid message ID","Copy the full Discord message ID.");if(!emoji)return fail(i,"Invalid emoji","Use one Unicode emoji or a custom emoji in `<:name:id>` format.");if(!manageableRole(i.guild,role))return fail(i,"Role cannot be assigned","Check Manage Roles and bot role hierarchy.");if(!safeSelfRole(role))return fail(i,"Privileged role blocked","Reaction roles cannot grant administrator, moderation, channel or server-management privileges.");
    const bot=i.guild.members.me;if(!channel?.isTextBased?.()||!bot||!channel.permissionsFor(bot)?.has([P.ViewChannel,P.ReadMessageHistory,P.AddReactions,P.ManageRoles]))return fail(i,"Missing permissions","The bot needs View Channel, Read Message History and Add Reactions in that channel, plus Manage Roles.");
    const message=await channel.messages.fetch(id).catch(()=>null);if(!message||message.guildId!==i.guild.id)return fail(i,"Message not found","The message must exist in this server and selected channel.");
    const c=await getAutoroleConfig(i.guild.id),items=[...(c.reactionRoles||[])];if(items.some(x=>x.messageId===id&&x.emojiKey===emoji.key))return fail(i,"Mapping already exists","That emoji already grants a configured role on this message.");if(items.length>=100)return fail(i,"Reaction-role limit reached","Remove a mapping before adding another; the current limit is 100 mappings per server.");
    try{await message.react(emoji.react);}catch{return fail(i,"Could not add reaction","Check Add Reactions permissions and whether the emoji is available to the bot.");}
    items.push({messageId:id,channelId:channel.id,emojiKey:emoji.key,emojiInput:input,roleId:role.id});await saveConfig("autorole",i.guild.id,{reactionRoles:items});return ok(i,"Reaction role added",`${input} on [the configured message](${message.url}) will grant ${role}. Removing the reaction removes the role.`);
  });
