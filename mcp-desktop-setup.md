# Connecting Claude Desktop to Everpure Intelligence

For teammates whose organization has disabled Claude Desktop's built-in UI for installing
custom MCP servers. There are two ways in — same end result either way, just pick whichever
fits you:

- **Most people:** the one-click installer (Step 2 below) — no terminal, no Claude Code needed.
- **Already use Claude Code?** skip to the [alternative method](#alternative-already-use-claude-code)
  instead — it's the same idea, just driven through Claude Code rather than a downloaded file.

## Step 1 — Get your personal API key

Make sure you have your own personal Everpure API key first — it starts with `evp_`. If you
don't have one yet, request one from Brandon (email: bspencer@everpuredata.com, Slack:
@Brandon) — each teammate gets their own key, not a shared one. Don't continue until you have
it in hand — you'll need it in the next step.

## Step 2 — Run the one-click installer

Download the file for your computer, then double-click it:

- **Mac:** [install-mac.command](./installers/install-mac.command)
- **Windows:** [install-windows.zip](./installers/install-windows.zip) — unzip it first,
  then double-click `install-windows.bat` inside

What happens next:

1. A popup explains what's about to happen — click **OK**.
2. If Node.js isn't installed yet, it says so and opens the download page for you. Install it,
   then double-click the same file again.
3. A popup asks you to paste your API key from Step 1. Paste it and click **OK**.
4. A final popup confirms you're set up, and Claude Desktop restarts on its own to connect.

If anything goes wrong, a popup will say so in plain language and ask you to send that message
to Brandon — nothing gets left in a broken state.

## Step 3 — Verify

Once Desktop reopens, ask it something like *"what content do we have on ransomware
protection?"* During weekday business hours (6am–6pm Pacific) a scheduled ping keeps the server
warm, so it should respond right away. Outside that window, expect a ~30–60 second delay on the
first call while it wakes up — if you see a "Server disconnected" message, that's what's
happening; just try again a moment later.

---

## Alternative: already use Claude Code?

This does the exact same thing as Step 2 above, just by handing Claude Code a command instead
of downloading a file. Use this if you already have Claude Code installed and would rather work
that way.

### Confirm Claude Code is installed

Open a terminal (**macOS:** Cmd + Space, type `Terminal`, Enter. **Windows:** Windows key, type
`PowerShell`, Enter) and run:

```bash
claude --version
```

If that prints a version number, you're set. If it says "command not found," install it:

```bash
npm install -g @anthropic-ai/claude-code
```

This needs Node.js — if `npm` isn't found either, install it right from this same terminal:

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

### Have Claude Code run this for you

Open **Claude Desktop**, and in the model/agent picker select **Claude Code**.

Replace `PASTE_MY_KEY_HERE` below with your personal API key from Step 1, then click the copy
icon on the box below, paste the **whole thing** into the Claude Code chat, and send it. Claude
Code reads it, runs the command on your behalf, and shows you the result; you don't run any of
this yourself:

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
own printed output is the confirmation it worked. Once it's done, follow Step 3 above to verify.

---

*Notes for whoever's rolling this out, not part of what you'd send a teammate: test both paths
— the installer and the Claude Code method — with one person each before rolling out further. If
the admin policy blocks custom MCP servers at a deeper level than just the UI button, Desktop
might ignore the config even after a correct edit. The installer's interactive dialogs and the
Windows version specifically haven't been tested end-to-end on a real machine yet — verify those
first. And keep delivering each personal key out-of-band, same as for REST API testers.*
