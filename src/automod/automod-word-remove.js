import {createModuleCommand, managerOnly, denyPermission, ok, fail} from "../commandFactory.js";
import {saveConfig} from "../shared.js";
import {getAutomodConfig} from "./services/index.js";

export default createModuleCommand("automod-word-remove","Remove a word or phrase from the blocked list.",[{type:"string",name:"word",description:"Exact word or phrase to remove",required:true,minLength:1,maxLength:60}],async i=>{if(!i.guild)return fail(i,"Server only","Run this command in a server.");if(!managerOnly(i))return denyPermission(i);const word=i.options.getString("word",true).toLowerCase().trim(),c=await getAutomodConfig(i.guild.id),next=c.blockedWords.filter(x=>x!==word);if(next.length===c.blockedWords.length)return fail(i,"Not found","That exact entry is not on the blocked list.");await saveConfig("automod",i.guild.id,{blockedWords:next});return ok(i,"Blocked word removed",`${word} was removed.`);});
