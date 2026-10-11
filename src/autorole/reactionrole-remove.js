import {PermissionFlagsBits as P} from "discord.js";
import {createModuleCommand, managerOnly, denyPermission, ok, fail} from "../commandFactory.js";
import {saveConfig} from "../shared.js";
import {getAutoroleConfig, parseEmojiInput} from "./services/index.js";

export default createModuleCommand("reactionrole-remove","Remove a configured emoji-to-role mapping.",[
    {type:"string",name:"message_id",description:"Configured message ID",required:true,minLength:15,maxLength:22},{type:"string",name:"emoji",description:"Same emoji used when configuring",required:true,maxLength:100}
  ],async i=>{
    if(!i.guild)return fail(i,"Server only","Run this command in a server.");if(!managerOnly(i,P.ManageRoles))return denyPermission(i,"Manage Roles");const id=i.options.getString("message_id",true),parsed=parseEmojiInput(i.options.getString("emoji",true));if(!parsed)return fail(i,"Invalid emoji","Use the same Unicode or custom emoji format as when adding the mapping.");const c=await getAutoroleConfig(i.guild.id),next=(c.reactionRoles||[]).filter(r=>!(r.messageId===id&&r.emojiKey===parsed.key));if(next.length===(c.reactionRoles||[]).length)return fail(i,"Mapping not found","No matching message/emoji role mapping exists.");await saveConfig("autorole",i.guild.id,{reactionRoles:next});return ok(i,"Reaction role removed","The emoji will no longer grant or remove a role. Existing roles are not automatically removed.");
  });
