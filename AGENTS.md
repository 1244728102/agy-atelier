# Zili Neko Atelier (agy-atelier) — Agent Architecture & Customization Guide

`agy-atelier` is a zero-intrusion full-window Rococo atelier theme and telemetry header console for Google Antigravity (AGY).

## Directory Layout

- `plugin.json`: Antigravity plugin manifest (`name`, `displayName`, `version`, `suggestedPrompts`).
- `mcp_config.json`: MCP stdio server registration running `server/mcp_server.py`.
- `server/mcp_server.py`: Pure-Python MCP App server + local HTTP telemetry bridge (`127.0.0.1:5399`) + startup auto-apply hook.
- `server/injector.mjs`: DevTools Protocol (`Page.createIsolatedWorld`) injector that mounts `#aa-style`, `#aa-backdrop`, `#aa-topbar`, `#aa-tab-panel`, and `[data-skin-chrome="composer-lace"]` without modifying any Antigravity installation files.
- `ui/app.html`: Interactive MCP App configuration panel.
- `assets/`: Wallpaper (`wallpaper.jpg`), chibi logo (`logo.png`), full-window preview (`demo-full-window.png`), and ornamental plates (`assets/ornaments/`).
- `skills/agy-atelier/SKILL.md`: Agent skill instructions for `/agy-atelier`.
