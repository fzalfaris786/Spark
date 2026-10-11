import test from "node:test";
import assert from "node:assert/strict";
import {readdir} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const moduleRoot=path.join(root,"src/modules");
const expected={
  moderation:17,
  "welcome-goodbye":12,
  autorole:12,
  automod:10,
  logging:6,
  tickets:14,
};

test("all planned modules have direct one-file-per-command entry points",async()=>{
  for(const [moduleName,count] of Object.entries(expected)){
    const folder=path.join(moduleRoot,moduleName);
    const entries=await readdir(folder,{withFileTypes:true});
    const files=entries.filter(e=>e.isFile()&&e.name.endsWith(".js"));
    const slashFiles=[];
    for(const file of files){
      const loaded=await import(pathToFileURL(path.join(folder,file.name)));
      const command=loaded.default;
      assert.ok(command,`${moduleName}/${file.name} should export a default command`);
      assert.equal(typeof command.execute,"function",`${moduleName}/${file.name} should export execute()`);
      if(command.prefixOnly){assert.equal(command.data,undefined);continue;}
      assert.ok(command.data?.toJSON,`${moduleName}/${file.name} should expose slash command metadata`);
      const json=command.data.toJSON();
      assert.equal(json.name,command.name,`${moduleName}/${file.name} slash command name must match export`);
      assert.ok(/^[a-z0-9_-]{1,32}$/.test(json.name));
      assert.ok(json.description.length>=1&&json.description.length<=100);
      assert.ok((json.options||[]).length<=25);
      let optionalSeen=false;
      for(const option of json.options||[]){
        assert.ok(/^[a-z0-9_-]{1,32}$/.test(option.name),`${moduleName}/${file.name} has an invalid option name`);
        assert.ok(option.description.length>=1&&option.description.length<=100,`${moduleName}/${file.name} option ${option.name} has an invalid description`);
        if(option.required&&optionalSeen)assert.fail(`${moduleName}/${file.name} puts a required option after an optional option`);
        if(!option.required)optionalSeen=true;
        assert.ok((option.choices||[]).length<=25);
      }
      slashFiles.push(command.name);
    }
    assert.equal(slashFiles.length,count,`${moduleName} should contain ${count} slash commands as separate files`);
    assert.equal(new Set(slashFiles).size,slashFiles.length,`${moduleName} must not duplicate command names`);
  }
});

test("new feature module slash command total is stable",async()=>{
  let count=0;
  for(const moduleName of Object.keys(expected)){
    const folder=path.join(moduleRoot,moduleName);
    for(const file of await readdir(folder,{withFileTypes:true})){
      if(!file.isFile()||!file.name.endsWith(".js"))continue;
      const command=(await import(pathToFileURL(path.join(folder,file.name)))).default;
      if(command?.data?.toJSON)count++;
    }
  }
  assert.equal(count,71);
});

test("dynamic loader discovers the module command files without duplicates",async()=>{
  const {loadAllCommands}=await import("../src/handlers/commandHandler.js");
  const client={slashCommands:new Map(),prefixCommands:new Map()};
  await loadAllCommands(client);
  assert.equal(client.slashCommands.size,74,"3 base slash commands plus 71 module commands");
  assert.equal(client.prefixCommands.size,75,"2 base prefix commands plus 71 module commands and 2 welcome/goodbye aliases");
  for(const name of ["welcome-setup","goodbye-setup","autorole-add","selfrole-panel","reactionrole-add","automod-test","logging-setup","tickets-setup","ticket-transcript","ban"]){
    assert.ok(client.slashCommands.has(name),`expected /${name} to be loaded`);
    assert.ok(client.prefixCommands.has(name),`expected prefix ${name} to be loaded`);
  }
  assert.ok(client.prefixCommands.has("welcome"));
  assert.ok(client.prefixCommands.has("goodbye"));
});
