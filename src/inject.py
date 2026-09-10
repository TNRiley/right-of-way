#!/usr/bin/env python
"""
Splice payload.json and the js*.js blocks into template.html -> ../index.html,
then run the two catalog tools that turn an Artifact-shaped fragment into a
page GitHub Pages can serve. Skipping those two is how a rebuild silently drops
the doctype and the breadcrumb, so they run here rather than by hand.
"""
import glob, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "index.html")


def workspace_root(start):
    """Walk up to the directory holding projects/. dirname() on a Windows drive
    root returns itself, so stop when it stops changing rather than at '/'."""
    p = os.path.abspath(start)
    while True:
        if os.path.isdir(os.path.join(p, "projects")):
            return p
        nxt = os.path.dirname(p)
        if nxt == p:
            raise SystemExit("could not find the workspace root")
        p = nxt


def main():
    with open(os.path.join(HERE, "template.html"), encoding="utf-8") as f:
        tpl = f.read()
    with open(os.path.join(HERE, "payload.json"), encoding="utf-8") as f:
        payload = f.read().strip()

    # The payload rides inside <script type="application/json">, so the only
    # sequence that can break out of it is a literal </script>. Nothing else
    # needs escaping, and escaping more would corrupt species names.
    payload = payload.replace("</", "<\\/")

    js = "\n".join(
        open(p, encoding="utf-8").read()
        for p in sorted(glob.glob(os.path.join(HERE, "js*.js")),
                        key=lambda p: int(re.search(r"js(\d+)", p).group(1))))

    html = tpl.replace("__PAYLOAD__", payload) + "\n" + js
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)
    print("wrote %s  %.2f MB  (payload %.2f MB)"
          % (OUT, len(html) / 1e6, len(payload) / 1e6))

    root = workspace_root(HERE)
    tools = os.path.join(root, "catalog", "tools")
    for t in ("wrap_for_pages.py", "add_catalog_link.py"):
        subprocess.run([sys.executable, os.path.join(tools, t), os.path.abspath(OUT)], check=True)


if __name__ == "__main__":
    main()
