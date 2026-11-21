"""Pure-Python MCP App server for agy-atelier."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

PLUGIN_ROOT = Path(__file__).resolve().parent.parent
APP_URI = "ui://agy-atelier/app.html"
UI_DIR = PLUGIN_ROOT / "ui"
INJECTOR = Path(__file__).resolve().parent / "injector.mjs"
DEFAULT_WALLPAPER = PLUGIN_ROOT / "assets" / "wallpaper.jpg"

TOOLS: list[dict[str, Any]] = [
    {
        "name": "atelier_open_ui",
        "title": "AGY 专属工坊壁纸",
        "description": "打开 AGY 专属工坊壁纸设置面板，自定义壁纸、磨砂玻璃与侧栏 U 形花边。",
        "inputSchema": {"type": "object", "properties": {}},
        "_meta": {
            "ui": {"resourceUri": APP_URI},
            "com.google.antigravity/ui": {
                "entrypoints": [
                    {"type": "aux_pane", "title": "专属壁纸"},
                ]
            },
        },
    },
    {
        "name": "atelier_apply",
        "title": "应用专属工坊壁纸",
        "description": "将专属壁纸与磨砂玻璃皮肤注入当前 Antigravity 窗口。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "themeMode": {"type": "string", "enum": ["dark", "light"]},
                "opacity": {"type": "number"},
                "blur": {"type": "integer"},
                "accent": {"type": "string"},
                "showLace": {"type": "boolean"},
                "wallpaperPath": {"type": "string"},
            },
        },
    },
    {
        "name": "atelier_clear",
        "title": "还原原生界面",
        "description": "从当前 Antigravity 窗口卸载全部壁纸与皮肤样式，恢复原生外观。",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "atelier_status",
        "title": "查看壁纸注入状态",
        "description": "检查当前壁纸皮肤配置与窗口注入状态。",
        "inputSchema": {"type": "object", "properties": {}},
    },
]


def _find_node() -> str:
    n = shutil.which("node")
    if n:
        return n
    cand = Path.home() / "AppData" / "Local" / "OpenAI" / "Codex" / "runtimes" / "cua_node" / "b8fa6273ef9661e1" / "bin" / "node.exe"
    if cand.is_file():
        return str(cand)
    raise RuntimeError("未找到 node.exe")


def _load_cfg(data_dir: Path) -> dict[str, Any]:
    p = data_dir / "settings.json"
    base = {
        "themeMode": "dark",
        "opacity": 0.85,
        "blur": 16,
        "accent": "#b69cf5",
        "showLace": True,
        "wallpaperPath": str(DEFAULT_WALLPAPER),
    }
    if p.is_file():
        try:
            base.update(json.loads(p.read_text(encoding="utf-8")))
        except Exception:
            pass
    if not base.get("wallpaperPath") or not Path(base["wallpaperPath"]).is_file():
        base["wallpaperPath"] = str(DEFAULT_WALLPAPER)
    return base


def _save_cfg(data_dir: Path, cfg: dict[str, Any]) -> None:
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "settings.json").write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")


def _run_injector(mode: str, data_dir: Path, cfg: dict[str, Any]) -> dict[str, Any]:
    node = _find_node()
    cfg_path = data_dir / "settings.json"
    _save_cfg(data_dir, cfg)
    res = subprocess.run([node, str(INJECTOR), mode, str(cfg_path)], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=15)
    out = (res.stdout or res.stderr).strip()
    try:
        return json.loads(out.splitlines()[-1])
    except Exception:
        return {"ok": res.returncode == 0, "raw": out}


def load_app_html() -> str:
    html = (UI_DIR / "app.html").read_text(encoding="utf-8")
    sdk = (UI_DIR / "ext-apps.js").read_text(encoding="utf-8")
    idx = sdk.rfind("export{")
    if idx != -1:
        sdk = (
            sdk[:idx]
            + "return { App: oc, applyDocumentTheme: uc, applyHostStyleVariables: tc, applyHostFonts: gc, getDocumentTheme: $c };"
        )
    wrapped = f"const {{ App, applyDocumentTheme, applyHostStyleVariables }} = (() => {{\n{sdk}\n}})();"
    return html.replace("/*__EXT_APPS_SDK__*/", wrapped, 1)


def handle_tool_call(data_dir: Path, name: str, args: dict[str, Any]) -> dict[str, Any]:
    cfg = _load_cfg(data_dir)
    if name in ("atelier_open_ui", "atelier_status"):
        st = _run_injector("status", data_dir, cfg)
        active = bool(st.get("active"))
        return {
            "content": [{"type": "text", "text": f"AGY 专属工坊壁纸：{'已注入' if active else '未注入'}（主题 {cfg['themeMode']}）"}],
            "structuredContent": {"cfg": cfg, "active": active},
        }
    if name == "atelier_apply":
        for k in ("themeMode", "opacity", "blur", "accent", "showLace", "wallpaperPath"):
            if k in args and args[k] is not None and args[k] != "":
                cfg[k] = args[k]
        res = _run_injector("apply", data_dir, cfg)
        ok = bool(res.get("ok"))
        msg = f"已应用专属壁纸（注入 {res.get('windows', 0)} 个窗口）" if ok else f"应用失败: {res.get('error', res.get('raw', ''))}"
        return {
            "content": [{"type": "text", "text": msg}],
            "structuredContent": {"cfg": cfg, "active": ok, "msg": msg},
            "isError": not ok,
        }
    if name == "atelier_clear":
        res = _run_injector("clear", data_dir, cfg)
        msg = "已还原 Antigravity 原生界面" if res.get("ok") else f"还原失败: {res.get('error', '')}"
        return {"content": [{"type": "text", "text": msg}], "structuredContent": {"cfg": cfg, "active": False, "msg": msg}}

    return {"content": [{"type": "text", "text": f"未知工具: {name}"}], "isError": True}


def write_msg(payload: dict[str, Any]) -> None:
    line = json.dumps(payload, ensure_ascii=False) + "\n"
    sys.stdout.buffer.write(line.encode("utf-8"))
    sys.stdout.buffer.flush()


def _start_local_bridge() -> None:
    ctx_server = Path.home() / ".gemini" / "config" / "plugins" / "agy-context" / "server"
    if ctx_server.is_dir() and str(ctx_server) not in sys.path:
        sys.path.insert(0, str(ctx_server))

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt: str, *args: Any) -> None:
            pass

        def _send_json(self, obj: Any, code: int = 200) -> None:
            body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:
            try:
                import analyzer  # type: ignore
                convs = analyzer.list_conversations()
                cid = convs[0]["id"] if convs else None
                if self.path.startswith("/api/context"):
                    if not cid:
                        self._send_json({"error": "no conversation"})
                        return
                    self._send_json(analyzer.analyze_conversation(cid))
                elif self.path.startswith("/api/fleet"):
                    self._send_json(analyzer.get_fleet(cid))
                else:
                    self._send_json({"ok": True})
            except Exception as exc:
                self._send_json({"error": str(exc)}, 500)

    try:
        srv = ThreadingHTTPServer(("127.0.0.1", 5399), Handler)
        t = threading.Thread(target=srv.serve_forever, daemon=True)
        t.start()
    except Exception:
        pass


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", default=str(Path.home() / ".gemini" / "antigravity" / "plugin_data" / "agy-atelier"))
    cli_args, _ = parser.parse_known_args()
    data_dir = Path(cli_args.data_dir)
    _start_local_bridge()

    def _auto_apply() -> None:
        try:
            _run_injector("apply", data_dir, _load_cfg(data_dir))
        except Exception:
            pass

    threading.Thread(target=_auto_apply, daemon=True).start()

    while True:
        raw = sys.stdin.buffer.readline()
        if not raw:
            break
        line = raw.decode("utf-8", errors="replace").strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except Exception:
            continue

        req_id = req.get("id")
        method = req.get("method", "")
        params = req.get("params") or {}
        if req_id is None:
            continue

        try:
            if method == "initialize":
                result = {
                    "protocolVersion": params.get("protocolVersion") or "2024-11-05",
                    "capabilities": {"tools": {}, "resources": {}},
                    "serverInfo": {"name": "agy-atelier", "version": "0.1.0"},
                }
            elif method == "ping":
                result = {}
            elif method == "tools/list":
                result = {"tools": TOOLS}
            elif method == "tools/call":
                result = handle_tool_call(data_dir, params.get("name", ""), params.get("arguments") or {})
            elif method == "resources/list":
                result = {
                    "resources": [
                        {
                            "uri": APP_URI,
                            "name": "AGY 专属工坊壁纸面板",
                            "mimeType": "text/html;profile=mcp-app",
                            "_meta": {"ui": {"prefersBorder": False}},
                        }
                    ]
                }
            elif method == "resources/read":
                if params.get("uri") != APP_URI:
                    write_msg({"jsonrpc": "2.0", "id": req_id, "error": {"code": -32602, "message": "Unknown resource"}})
                    continue
                result = {
                    "contents": [
                        {
                            "uri": APP_URI,
                            "mimeType": "text/html;profile=mcp-app",
                            "text": load_app_html(),
                            "_meta": {"ui": {"prefersBorder": False}},
                        }
                    ]
                }
            else:
                write_msg({"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": f"Method not found: {method}"}})
                continue
            write_msg({"jsonrpc": "2.0", "id": req_id, "result": result})
        except Exception as exc:
            write_msg({"jsonrpc": "2.0", "id": req_id, "error": {"code": -32603, "message": str(exc)}})


if __name__ == "__main__":
    main()
