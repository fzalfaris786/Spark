import test from "node:test";
import assert from "node:assert/strict";
import {containsInvite, hasUrl, wordViolation, isSafeText} from "../src/modules/automod/services/index.js";
import {toSafeChannelName, parseTicket} from "../src/modules/tickets/services/index.js";
import {parseEmojiInput, safeSelfRole} from "../src/modules/autorole/services/index.js";

test("AutoMod identifies invite links and web links", () => {
  assert.equal(containsInvite("join us at https://discord.gg/abc123"), true);
  assert.equal(containsInvite("hello everyone"), false);
  assert.equal(hasUrl("visit www.example.com"), true);
  assert.equal(hasUrl("no links here"), false);
});

test("AutoMod blocked words are case-insensitive and boundary aware", () => {
  assert.equal(wordViolation("This is BAD!", ["bad"]), "bad");
  assert.equal(wordViolation("badminton is a sport", ["bad"]), null);
  assert.equal(wordViolation("please join my secret phrase", ["secret phrase"]), "secret phrase");
  assert.equal(isSafeText("   "), false);
  assert.equal(isSafeText("something blocked"), true);
});

test("ticket channel names are safe and ticket topics parse correctly", () => {
  assert.equal(toSafeChannelName("Hello There!! Cuty"), "hello-there-cuty");
  assert.equal(toSafeChannelName("🎟️"), "ticket");
  assert.deepEqual(parseTicket({topic:"origin-ticket:123456789012345678:open:none"}), {ownerId:"123456789012345678",status:"open",claimedBy:null});
  assert.deepEqual(parseTicket({topic:"origin-ticket:123456789012345678:closed:223456789012345678"}), {ownerId:"123456789012345678",status:"closed",claimedBy:"223456789012345678"});
  assert.equal(parseTicket({topic:"ordinary channel"}), null);
});

test("reaction role emoji input rejects empty/multiword values and recognizes Unicode/custom emoji", () => {
  assert.deepEqual(parseEmojiInput("🎟️"), {react:"🎟️",key:"unicode:🎟️"});
  assert.deepEqual(parseEmojiInput("<:support:123456789012345678>"), {react:"<:support:123456789012345678>",key:"custom:123456789012345678"});
  assert.equal(parseEmojiInput(""), null);
  assert.equal(parseEmojiInput("not an emoji"), null);
});

import {buildMemberEmbed, WELCOME_DEFAULTS, imageUrl} from "../src/modules/welcome-goodbye/services/index.js";
import {getConfig, saveConfig} from "../src/modules/shared.js";

test("welcome template renders member and count details into a branded preview embed", () => {
  const user = {id:"123456789012345678",username:"Cuty",createdTimestamp:1_600_000_000_000,displayAvatarURL:()=>"https://cdn.example/avatar.png"};
  const guild = {id:"987654321098765432",name:"Origin Test",memberCount:42};
  const member = {id:user.id,user,guild};
  const embed = buildMemberEmbed("welcome",member,{...WELCOME_DEFAULTS,message:"Welcome {user} to {server}; member #{memberCount} (ID {userId}).",bannerUrl:null,showAvatar:true,color:"3B82F6"},true);
  assert.match(embed.data.title,/Origin Test/);
  assert.match(embed.data.description,/42/);
  assert.match(embed.data.description,/123456789012345678/);
  assert.equal(embed.data.thumbnail.url,"https://cdn.example/avatar.png");
  assert.equal(imageUrl("https://image.example/welcome?members={memberCount}"),"https://image.example/welcome?members={memberCount}");
  assert.equal(imageUrl("javascript:alert(1)"),null);
});

test("module configuration merges saved fields while preserving defaults", async () => {
  const guildId="test-guild-config-logic";
  await saveConfig("welcome",guildId,{enabled:true,channelId:"test-channel"});
  const saved=await getConfig("welcome",guildId);
  assert.equal(saved.enabled,true);
  assert.equal(saved.channelId,"test-channel");
  assert.equal(saved.guildId,guildId);
});
