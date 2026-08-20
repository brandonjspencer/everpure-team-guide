Add-Type -AssemblyName Microsoft.VisualBasic
Add-Type -AssemblyName System.Windows.Forms

[System.Windows.Forms.MessageBox]::Show(
  "This sets up Claude Desktop to connect to Everpure Intelligence.`n`nOn the next screen, paste your personal API key (starts with evp_). Get one from Brandon if you do not have it yet.",
  "Everpure MCP Setup"
) | Out-Null

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  [System.Windows.Forms.MessageBox]::Show(
    "This setup needs Node.js installed first.`n`nWe will open the download page for you. Install it, then run this file again.",
    "Node.js Required"
  ) | Out-Null
  Start-Process "https://nodejs.org"
  exit 1
}

$key = [Microsoft.VisualBasic.Interaction]::InputBox("Paste your Everpure API key:", "Everpure MCP Setup", "")
if ([string]::IsNullOrWhiteSpace($key)) {
  [System.Windows.Forms.MessageBox]::Show("No key entered — setup cancelled.", "Everpure MCP Setup") | Out-Null
  exit 1
}

$env:EVERPURE_KEY = $key
$result = node -e "
const fs=require('fs'),path=require('path');
const {execSync}=require('child_process');
const key=process.env.EVERPURE_KEY;
const dir=path.join(process.env.APPDATA,'Claude');
const file=path.join(dir,'claude_desktop_config.json');
fs.mkdirSync(dir,{recursive:true});
let npxPath;
try{ npxPath=execSync('where npx',{encoding:'utf8'}).trim().split(/\r?\n/)[0]; }
catch(e){ console.log('ERROR: npx not found - reinstall Node.js from nodejs.org, then try again.'); process.exit(1); }
let cfg={};
if(fs.existsSync(file)){
  try{ cfg=JSON.parse(fs.readFileSync(file,'utf8')); }
  catch(e){ console.log('ERROR: existing Claude config is not valid JSON - nothing was changed. Ask for help before editing it by hand.'); process.exit(1); }
}
cfg.mcpServers=cfg.mcpServers||{};
cfg.mcpServers['everpure-artifacts']={command:npxPath,args:['mcp-remote','https://everpure-artifact-mcp.onrender.com/','--header','Authorization: Bearer '+key]};
fs.writeFileSync(file,JSON.stringify(cfg,null,2)+String.fromCharCode(10));
console.log('OK');
" 2>&1 | Out-String

if ($result -match "OK") {
  [System.Windows.Forms.MessageBox]::Show(
    "All set! Claude Desktop will now restart to connect.`n`nOnce it reopens, try asking: What content do we have on ransomware protection?",
    "Everpure MCP Setup"
  ) | Out-Null
  try {
    Get-Process Claude -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
    Start-Process "Claude"
  } catch {
    [System.Windows.Forms.MessageBox]::Show("Setup finished — please reopen Claude Desktop yourself.", "Everpure MCP Setup") | Out-Null
  }
} else {
  [System.Windows.Forms.MessageBox]::Show("Setup did not finish:`n`n$result`n`nSend this message to Brandon.", "Everpure MCP Setup") | Out-Null
}
