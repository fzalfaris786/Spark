import {createModuleCommand, managerOnly, denyPermission, ok, fail} from "../commandFactory.js";
import {saveConfig} from "../shared.js";
import {LOG_CATEGORIES, getLoggingConfig, currentCategory} from "./services/index.js";

export default createModuleCommand("logging-config","Enable or disable a category of log events.",[
  {type:"string",name:"category",description:"Event category to configure",required:true,choices:LOG_CATEGORIES.map(x=>({name:x[0].toUpperCase()+x.slice(1),value:x}))},
  {type:"boolean",name:"enabled",description:"Whether to log this category",required:true}
 ],async i=>{if(!i.guild)return fail(i,"Server only","Run this command in a server.");if(!managerOnly(i))return denyPermission(i);const cat=currentCategory(i),enabled=i.options.getBoolean("enabled",true),c=await getLoggingConfig(i.guild.id),set=new Set(c.enabledEvents);if(enabled)set.add(cat);else set.delete(cat);await saveConfig("logging",i.guild.id,{enabledEvents:[...set]});return ok(i,"Logging category updated",`${cat} logging is now **${enabled?"enabled":"disabled"}**.`);});
