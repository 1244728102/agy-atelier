# Installing agy-atelier (Zili Neko Atelier · 紫璃猫娘)

This guide is written for both human developers and coding agents (Antigravity, Claude Code, Codex).

## 1. Quick Install into Antigravity

Clone this repository directly into your Antigravity plugins directory:

```bash
git clone https://github.com/1244728102/agy-atelier.git "$HOME/.gemini/config/plugins/agy-atelier"
```

On Windows PowerShell:

```powershell
git clone https://github.com/1244728102/agy-atelier.git "$env:USERPROFILE\.gemini\config\plugins\agy-atelier"
```

## 2. Auto-Activation & Manual Controls

Once installed in `~/.gemini/config/plugins/agy-atelier`:

- **Auto-apply on startup**: `server/mcp_server.py` automatically runs `server/injector.mjs apply` when the MCP server initializes.
- **Interactive Workbench**: Run `/agy-atelier` or ask the agent to call `atelier_open_ui` to open the side-panel configuration card.
- **Instant Restore**: Call `atelier_clear` at any time to cleanly remove all injected styles and DOM nodes without restarting Antigravity.
