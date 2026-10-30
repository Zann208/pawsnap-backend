"""Generate flat SVG illustrations for the PawSnap demo seed data.

Writes public/demo/avatars/*.svg and public/demo/posts/*.svg.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "public" / "demo"

PETS = {
    "mochi":   dict(kind="dog", fur="#d9893f", light="#fbeedd", ear="pointy", inner="#f2b38a", eyes="#2b1d14"),
    "pepper":  dict(kind="cat", fur="#9a8f86", light="#efe9e3", ear="pointy", inner="#f1b3b0", eyes="#3f6b3a", stripes="#6b625b"),
    "biscuit": dict(kind="dog", fur="#e2b15e", light="#fbe9c7", ear="floppy", inner="#c98f3c", eyes="#2b1d14"),
    "luna":    dict(kind="cat", fur="#2a2730", light="#3a3642", ear="pointy", inner="#7c5a73", eyes="#f2c94c"),
    "nugget":  dict(kind="dog", fur="#b8682e", light="#fff8ef", ear="big", inner="#f3c3a0", eyes="#2b1d14", blaze=True),
}


def face(p, cx, cy, s, mood="happy"):
    """Pet head centred at (cx, cy) with radius-ish size s."""
    g = []
    fur, light, inner = p["fur"], p["light"], p["inner"]
    if p["kind"] == "cat" or p["ear"] in ("pointy", "big"):
        h = 1.05 if p["ear"] == "big" else 0.85
        w = 0.55 if p["ear"] == "big" else 0.48
        for side in (-1, 1):
            bx = cx + side * s * 0.62
            g.append(f'<path d="M{bx - side*s*w*0.55:.1f} {cy - s*0.35:.1f} L{bx + side*s*0.18:.1f} {cy - s*h - s*0.25:.1f} L{bx + side*s*0.42:.1f} {cy - s*0.15:.1f} Z" fill="{fur}"/>')
            g.append(f'<path d="M{bx - side*s*w*0.25:.1f} {cy - s*0.38:.1f} L{bx + side*s*0.18:.1f} {cy - s*h - s*0.05:.1f} L{bx + side*s*0.30:.1f} {cy - s*0.28:.1f} Z" fill="{inner}"/>')
    g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{s:.1f}" ry="{s*0.88:.1f}" fill="{fur}"/>')
    if p["ear"] == "floppy":
        for side in (-1, 1):
            g.append(f'<ellipse cx="{cx + side*s*0.92:.1f}" cy="{cy + s*0.05:.1f}" rx="{s*0.30:.1f}" ry="{s*0.58:.1f}" fill="{inner}" transform="rotate({side*-14} {cx + side*s*0.92:.1f} {cy + s*0.05:.1f})"/>')
    if p["kind"] == "dog":
        g.append(f'<ellipse cx="{cx}" cy="{cy + s*0.38:.1f}" rx="{s*0.62:.1f}" ry="{s*0.44:.1f}" fill="{light}"/>')
        if p.get("blaze"):
            g.append(f'<path d="M{cx - s*0.10:.1f} {cy + s*0.05:.1f} L{cx - s*0.05:.1f} {cy - s*0.78:.1f} L{cx + s*0.05:.1f} {cy - s*0.78:.1f} L{cx + s*0.10:.1f} {cy + s*0.05:.1f} Z" fill="{light}"/>')
        if p["ear"] == "pointy":
            for side in (-1, 1):
                g.append(f'<ellipse cx="{cx + side*s*0.38:.1f}" cy="{cy - s*0.34:.1f}" rx="{s*0.13:.1f}" ry="{s*0.08:.1f}" fill="{light}"/>')
    else:
        g.append(f'<ellipse cx="{cx}" cy="{cy + s*0.40:.1f}" rx="{s*0.48:.1f}" ry="{s*0.32:.1f}" fill="{light}"/>')
        if p.get("stripes"):
            for dx in (-0.18, 0, 0.18):
                g.append(f'<path d="M{cx + dx*s:.1f} {cy - s*0.82:.1f} q{s*0.04:.1f} {s*0.18:.1f} 0 {s*0.32:.1f}" stroke="{p["stripes"]}" stroke-width="{s*0.07:.1f}" stroke-linecap="round" fill="none"/>')
    ey = cy - s * 0.05
    for side in (-1, 1):
        ex = cx + side * s * 0.36
        if mood == "sleepy":
            g.append(f'<path d="M{ex - s*0.13:.1f} {ey:.1f} q{s*0.13:.1f} {s*0.12:.1f} {s*0.26:.1f} 0" stroke="#2b1d14" stroke-width="{s*0.05:.1f}" stroke-linecap="round" fill="none"/>')
        else:
            r = s * (0.13 if p["kind"] == "cat" else 0.11)
            g.append(f'<circle cx="{ex:.1f}" cy="{ey:.1f}" r="{r:.1f}" fill="{p["eyes"]}"/>')
            if p["kind"] == "cat":
                g.append(f'<ellipse cx="{ex:.1f}" cy="{ey:.1f}" rx="{r*0.32:.1f}" ry="{r*0.85:.1f}" fill="#1b1a1f"/>')
            g.append(f'<circle cx="{ex + r*0.35:.1f}" cy="{ey - r*0.4:.1f}" r="{r*0.3:.1f}" fill="#fff"/>')
        g.append(f'<ellipse cx="{ex + side*s*0.05:.1f}" cy="{ey + s*0.24:.1f}" rx="{s*0.11:.1f}" ry="{s*0.06:.1f}" fill="#f28b82" opacity=".45"/>')
    ny = cy + s * 0.22
    if p["kind"] == "dog":
        g.append(f'<ellipse cx="{cx}" cy="{ny:.1f}" rx="{s*0.13:.1f}" ry="{s*0.09:.1f}" fill="#2b1d14"/>')
    else:
        g.append(f'<path d="M{cx - s*0.08:.1f} {ny - s*0.04:.1f} h{s*0.16:.1f} l{-s*0.08:.1f} {s*0.09:.1f} Z" fill="#e88a95"/>')
        for side in (-1, 1):
            for k, dy in enumerate((-0.02, 0.07)):
                g.append(f'<path d="M{cx + side*s*0.30:.1f} {ny + dy*s:.1f} l{side*s*0.42:.1f} {(-0.06 + k*0.1)*s:.1f}" stroke="{"#d8d2cc" if p["fur"] < "#5" else "#5b534d"}" stroke-width="{s*0.018:.1f}" stroke-linecap="round"/>')
    my = ny + s * 0.10
    g.append(f'<path d="M{cx - s*0.17:.1f} {my:.1f} q{s*0.085:.1f} {s*0.1:.1f} {s*0.17:.1f} 0 q{s*0.085:.1f} {s*0.1:.1f} {s*0.17:.1f} 0" stroke="#2b1d14" stroke-width="{s*0.035:.1f}" stroke-linecap="round" fill="none"/>')
    if mood == "tongue":
        g.append(f'<path d="M{cx - s*0.08:.1f} {my + s*0.05:.1f} q{s*0.08:.1f} {s*0.22:.1f} {s*0.16:.1f} 0 Z" fill="#ef6f86"/>')
    return "\n".join(g)


def body(p, cx, top, s):
    return (f'<ellipse cx="{cx}" cy="{top + s*0.9:.1f}" rx="{s*1.05:.1f}" ry="{s*0.95:.1f}" fill="{p["fur"]}"/>'
            f'<ellipse cx="{cx}" cy="{top + s*0.75:.1f}" rx="{s*0.55:.1f}" ry="{s*0.6:.1f}" fill="{p["light"]}"/>')


def svg(w, h, inner):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{inner}</svg>\n'


def grad(id_, a, b, vertical=True):
    xy = 'x1="0" y1="0" x2="0" y2="1"' if vertical else 'x1="0" y1="0" x2="1" y2="1"'
    return f'<linearGradient id="{id_}" {xy}><stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></linearGradient>'


AV_BG = {"mochi": "#ffe2c2", "pepper": "#dfe9e1", "biscuit": "#fff0c9", "luna": "#d9d4f0", "nugget": "#ffe0cf"}


def avatars():
    out = ROOT / "avatars"
    out.mkdir(parents=True, exist_ok=True)
    for name, p in PETS.items():
        (out / f"{name}.svg").write_text(svg(256, 256, f'<rect width="256" height="256" fill="{AV_BG[name]}"/>' + face(p, 128, 146, 74)))


def posts():
    out = ROOT / "posts"
    out.mkdir(parents=True, exist_ok=True)
    W = H = 1080
    m, pe, b, l, n = (PETS[k] for k in ("mochi", "pepper", "biscuit", "luna", "nugget"))

    rail = "".join(f'<rect x="{x}" y="640" width="22" height="440" fill="#8a5a3c" opacity=".55"/>' for x in range(40, 1080, 110))
    scenes = {
        "mochi-sun": f'<defs>{grad("g", "#ffcf8a", "#fff3dc")}</defs><rect width="{W}" height="{H}" fill="url(#g)"/>'
                     f'<circle cx="820" cy="250" r="150" fill="#ffb347"/><circle cx="820" cy="250" r="210" fill="#ffb347" opacity=".25"/>'
                     f'{rail}<rect x="0" y="620" width="{W}" height="26" fill="#8a5a3c" opacity=".7"/>'
                     f'<rect x="0" y="900" width="{W}" height="180" fill="#e9b07a"/>'
                     + body(m, 520, 640, 230) + face(m, 520, 560, 210, "sleepy"),
        "pepper-window": f'<defs>{grad("g", "#a9d4f5", "#e6f4ff")}</defs><rect width="{W}" height="{H}" fill="#f4ede4"/>'
                         f'<rect x="140" y="90" width="800" height="600" rx="18" fill="url(#g)" stroke="#c9b8a6" stroke-width="28"/>'
                         f'<rect x="526" y="90" width="28" height="600" fill="#c9b8a6"/><rect x="140" y="376" width="800" height="28" fill="#c9b8a6"/>'
                         f'<path d="M270 220 q25 -25 50 0 q25 -25 50 0" stroke="#3b4a5a" stroke-width="10" fill="none" stroke-linecap="round"/>'
                         f'<path d="M700 280 q20 -20 40 0 q20 -20 40 0" stroke="#3b4a5a" stroke-width="9" fill="none" stroke-linecap="round"/>'
                         f'<rect x="0" y="690" width="{W}" height="60" fill="#b89f86"/>'
                         + body(pe, 540, 760, 220) + face(pe, 540, 690, 200),
        "biscuit-ball": f'<defs>{grad("g", "#9fd3ff", "#e9f7ff")}</defs><rect width="{W}" height="{H}" fill="url(#g)"/>'
                        f'<ellipse cx="540" cy="1080" rx="900" ry="380" fill="#7cc576"/><ellipse cx="200" cy="1000" rx="500" ry="260" fill="#6ab565"/>'
                        f'<circle cx="230" cy="190" r="60" fill="#fff" opacity=".8"/><circle cx="300" cy="200" r="70" fill="#fff" opacity=".8"/>'
                        + body(b, 560, 640, 220) + face(b, 560, 560, 205, "tongue")
                        + '<circle cx="860" cy="860" r="85" fill="#d7e84a"/><path d="M790 820 q70 40 0 100" stroke="#fff" stroke-width="10" fill="none"/><path d="M930 800 q-70 60 0 120" stroke="#fff" stroke-width="10" fill="none"/>',
        "luna-night": f'<defs>{grad("g", "#16183a", "#3a2f5b")}</defs><rect width="{W}" height="{H}" fill="url(#g)"/>'
                      + "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff" opacity=".8"/>' for x, y, r in [(120,140,4),(260,90,3),(430,170,5),(610,80,3),(980,320,4),(880,90,3),(170,380,3),(700,260,4)])
                      + '<circle cx="840" cy="200" r="90" fill="#f6e7b0"/><circle cx="880" cy="170" r="80" fill="#22224a"/>'
                      f'<rect x="0" y="880" width="{W}" height="200" fill="#2c2548"/>'
                      + body(l, 480, 640, 220) + face(l, 480, 560, 205)
                      + '<ellipse cx="830" cy="905" rx="130" ry="42" fill="#d65a5a"/><ellipse cx="830" cy="890" rx="105" ry="22" fill="#7a3b2f"/>',
        "nugget-hike": f'<defs>{grad("g", "#ffd6a8", "#fff6e9")}</defs><rect width="{W}" height="{H}" fill="url(#g)"/>'
                       '<path d="M0 640 L260 330 L470 600 L700 260 L1080 640 Z" fill="#6f9b8e"/><path d="M0 760 L320 470 L620 760 L860 520 L1080 720 L1080 1080 L0 1080 Z" fill="#4f7d6c"/>'
                       '<path d="M640 330 L700 260 L760 330 Z" fill="#fff" opacity=".85"/>'
                       + body(n, 540, 700, 210) + face(n, 540, 620, 195),
        "mochi-bath": f'<rect width="{W}" height="{H}" fill="#dff1f7"/>'
                      + "".join(f'<rect x="{x}" y="{y}" width="132" height="132" fill="none" stroke="#c4e2ec" stroke-width="6"/>' for x in range(0, 1080, 135) for y in range(0, 560, 135))
                      + '<rect x="60" y="640" width="960" height="440" rx="60" fill="#ffffff"/><rect x="60" y="640" width="960" height="60" rx="30" fill="#e6f3f8"/>'
                      + face(m, 540, 560, 210)
                      + "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff" stroke="#bfe3f0" stroke-width="5" opacity=".95"/>' for x, y, r in [(430,360,60),(520,330,70),(620,360,58),(220,680,70),(330,650,50),(820,690,75),(920,640,48),(700,640,40),(160,560,30),(960,520,34)]),
    }
    for name, inner in scenes.items():
        (out / f"{name}.svg").write_text(svg(W, H, inner))


if __name__ == "__main__":
    avatars()
    posts()
    print("ok", sorted(p.name for p in ROOT.rglob("*.svg")))
