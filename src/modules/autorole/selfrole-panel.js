import {ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits as P} from "discord.js";
import {createModuleCommand, managerOnly, denyPermission, ok, fail, infoEmbed} from "../commandFactory.js";
import {getAutoroleConfig, manageableRole, safeSelfRole} from "./services/index.js";

export default createModuleCommand("selfrole-panel","Post a button panel for self-assignable roles.",[
    {type:"channel",name:"channel",description:"Text channel for the panel",required:true,channelType:"text"},
    {type:"string",name:"title",description:"Panel title",maxLength:200},
    {type:"string",name:"description",description:"Panel instructions",maxLength:1000},
  ],async i=>{
    if(!i.guild)return fail(i,"Server only","Run this command in a server.");if(!managerOnly(i,P.ManageRoles))return denyPermission(i,"Manage Roles");const ch=i.options.getChannel("channel",true),c=await getAutoroleConfig(i.guild.id);if(!ch?.isTextBased?.())return fail(i,"Invalid channel","Choose a text channel.");if(!c.selfRoleIds.length)return fail(i,"No self-roles configured","Use `/selfrole-add` first.");
    const roles=c.selfRoleIds.slice(0,25).map(id=>i.guild.roles.cache.get(id)).filter(r=>r&&manageableRole(i.guild,r)&&safeSelfRole(r));if(!roles.length)return fail(i,"No usable roles","Configured roles are deleted or the bot cannot safely assign them.");
    const rows=[];for(let idx=0;idx<roles.length;idx+=5){const row=new ActionRowBuilder().addComponents(roles.slice(idx,idx+5).map(role=>new ButtonBuilder().setCustomId(`selfrole:${role.id}`).setLabel(role.name.slice(0,80)).setStyle(ButtonStyle.Secondary)));rows.push(row);}
    const bot=i.guild.members.me;if(!bot||!ch.permissionsFor(bot)?.has([P.ViewChannel,P.SendMessages,P.EmbedLinks,P.ReadMessageHistory]))return fail(i,"Missing channel permissions","Give the bot View Channel, Send Messages, Embed Links and Read Message History.");
    await ch.send({embeds:[infoEmbed(i.options.getString("title")||"Choose your roles",i.options.getString("description")||"Click a role button to add that role. Click it again to remove it.",{fields:roles.map(r=>({name:r.name,value:(c.selfRoleDescriptions[r.id]||"Toggle this role.").slice(0,1024),inline:true}))})],components:rows});return ok(i,"Self-role panel posted",`Published a panel with ${roles.length} role button(s) in ${ch}.`);
  });
