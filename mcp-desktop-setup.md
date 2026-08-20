# Connecting Claude Desktop via Claude Code

For teammates whose organization has disabled Claude Desktop's built-in UI for installing
custom MCP servers. This uses Claude Code to edit `claude_desktop_config.json` directly instead
— same end result as the normal Settings → Developer → Edit Config flow, just a different door
in.

## Step 1 — Get your personal API key

Make sure you have your own personal Everpure API key first — it starts with `evp_`. If you
don't have one yet, request one from Brandon (email: bspencer@everpuredata.com, Slack:
@Brandon) — each teammate gets their own key, not a shared one. Don't continue until you have
it in hand — you'll need it in Step 3.

## Step 2 — Open a terminal, then confirm Claude Code is installed

**macOS:** press **Cmd + Space**, type `Terminal`, press **Enter**.

**Windows:** press the **Windows key**, type `PowerShell`, press **Enter**.

Keep that window open — you'll use the same one for every step below.

In it, run:

```bash
claude --version
```

If that prints a version number, skip to Step 3. If it says "command not found," install it:

```bash
npm install -g @anthropic-ai/claude-code
```

This needs Node.js — if `npm` isn't found either, install it right from this same terminal,
no website needed:

**macOS:**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```
```bash
\. "$HOME/.nvm/nvm.sh" && nvm install --lts
```

**Windows (PowerShell):**
```powershell
winget install OpenJS.NodeJS.LTS
```
Then close this window, open a new Terminal/PowerShell window, and re-run
`npm install -g @anthropic-ai/claude-code` from above. Confirm with `claude --version` again.

## Step 3 — Have Claude Code run this for you

Everything above (Step 2) you typed straight into your terminal. This step is different: you're
about to hand a job to Claude Code instead of running anything yourself, and you'll do it from
the Claude Desktop app itself — no terminal needed for this part.

Open **Claude Desktop**, and in the model/agent picker select **Claude Code**.

Now, replace `PASTE_MY_KEY_HERE` below with your personal API key from Step 1, then click the
copy icon on the box below, paste the **whole thing** into the Claude Code chat, and send it.
Claude Code reads it, runs the command on your behalf, and shows you the result; you don't run
any of this yourself:

```
Run this exact command for me, then show me the output:

node -e "
const fs=require('fs'),path=require('path'),os=require('os');
const {execSync}=require('child_process');
const dir=process.platform==='win32'?path.join(process.env.APPDATA,'Claude'):path.join(os.homedir(),'Library','Application Support','Claude');
const file=path.join(dir,'claude_desktop_config.json');
fs.mkdirSync(dir,{recursive:true});
let npxPath;
try{
  npxPath=execSync(process.platform==='win32'?'where npx':'which npx',{encoding:'utf8'}).trim().split('\n')[0];
}catch(e){
  console.error('npx not found — install Node.js from nodejs.org, then run this again.');
  process.exit(1);
}
let cfg={};
if(fs.existsSync(file)){
  try{cfg=JSON.parse(fs.readFileSync(file,'utf8'))}
  catch(e){console.error('Existing config is not valid JSON — stopping so nothing gets overwritten:',e.message);process.exit(1)}
}
cfg.mcpServers=cfg.mcpServers||{};
cfg.mcpServers['everpure-artifacts']={command:npxPath,args:['mcp-remote','https://everpure-artifact-mcp.onrender.com/','--header','Authorization: Bearer PASTE_MY_KEY_HERE']};
fs.writeFileSync(file,JSON.stringify(cfg,null,2)+'\n');
console.log('Updated:',file);
console.log(JSON.stringify(cfg.mcpServers,null,2));
"

Don't launch or restart anything afterward — I'll quit and reopen Claude Desktop myself.
```

This resolves `npx`'s real path itself rather than trusting Desktop to find it later — a common,
silent failure mode otherwise — and only ever touches the `"everpure-artifacts"` key under
`"mcpServers"`; any other MCP servers already configured stay exactly as they are. The command's
own printed output is the confirmation it worked.

## Step 4 — Verify

Fully quit (not just close the window) and reopen Claude Desktop, then ask it something like
*"what content do we have on ransomware protection?"* During weekday business hours (6am–6pm
Pacific) a scheduled ping keeps the server warm, so it should respond right away. Outside that
window, expect a ~30–60 second delay on the first call while it wakes up — if you see a
"Server disconnected" message, that's what's happening; just try again a moment later.

---

*Notes for whoever's rolling this out, not part of what you'd send a teammate: test this whole
flow with one person before rolling out further — if the admin policy blocks custom MCP servers
at a deeper level than just the UI button, Desktop might ignore the config even after a correct
edit. And keep delivering each personal key out-of-band, same as for REST API testers.*
