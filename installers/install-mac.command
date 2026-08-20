#!/bin/bash
set -e

osascript -e 'display dialog "This sets up Claude Desktop to connect to Everpure Intelligence.\n\nOn the next screen, paste your personal API key (starts with evp_). Get one from Brandon if you do not have it yet.\n\nClick OK to continue." buttons {"Cancel", "OK"} default button "OK" with title "Everpure MCP Setup"'

if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display dialog "This setup needs Node.js installed first.\n\nClick OK and we will open the download page for you. Install it, then double-click this file again." buttons {"OK"} default button "OK" with title "Node.js Required"'
  open "https://nodejs.org"
  exit 1
fi

KEY=$(osascript -e 'text returned of (display dialog "Paste your Everpure API key:" default answer "" with title "Everpure MCP Setup")' 2>/dev/null) || {
  exit 0
}

if [ -z "$KEY" ]; then
  osascript -e 'display dialog "No key entered — setup cancelled." buttons {"OK"} default button "OK" with title "Everpure MCP Setup"'
  exit 1
fi

RESULT=$(EVERPURE_KEY="$KEY" node -e "
const fs=require('fs'),path=require('path'),os=require('os');
const {execSync}=require('child_process');
const key=process.env.EVERPURE_KEY;
const dir=path.join(os.homedir(),'Library','Application Support','Claude');
const file=path.join(dir,'claude_desktop_config.json');
fs.mkdirSync(dir,{recursive:true});
let npxPath;
try{ npxPath=execSync('which npx',{encoding:'utf8'}).trim().split('\n')[0]; }
catch(e){ console.log('ERROR: npx not found — reinstall Node.js from nodejs.org, then try again.'); process.exit(1); }
let cfg={};
if(fs.existsSync(file)){
  try{ cfg=JSON.parse(fs.readFileSync(file,'utf8')); }
  catch(e){ console.log('ERROR: existing Claude config is not valid JSON — nothing was changed. Ask for help before editing it by hand.'); process.exit(1); }
}
cfg.mcpServers=cfg.mcpServers||{};
cfg.mcpServers['everpure-artifacts']={command:npxPath,args:['mcp-remote','https://everpure-artifact-mcp.onrender.com/','--header','Authorization: Bearer '+key]};
fs.writeFileSync(file,JSON.stringify(cfg,null,2)+'\n');
console.log('OK');
" 2>&1)

if [[ "$RESULT" == *"OK"* ]]; then
  osascript -e 'display dialog "All set! Claude Desktop will now restart to connect.\n\nOnce it reopens, try asking: What content do we have on ransomware protection?" buttons {"OK"} default button "OK" with title "Everpure MCP Setup"'
  osascript -e 'tell application "Claude" to quit' >/dev/null 2>&1 || true
  sleep 2
  open -a "Claude" >/dev/null 2>&1 || true
else
  osascript -e "display dialog \"Setup did not finish:\n\n$RESULT\n\nSend this message to Brandon.\" buttons {\"OK\"} default button \"OK\" with title \"Everpure MCP Setup\""
fi
