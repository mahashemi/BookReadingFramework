#!/usr/bin/env python3
"""Regenerate the Chapter 2 jihad-truce decision tree from one data file.

Source of truth : Library/Book 02 .../teaching_materials/figures/jihad_truce_tree.json
Outputs         : figures/jihad-truce-tree-{clean,overlay,hassan,husayn}.pdf   (Beamer deck, vector)
                  the inline <svg id="map"> block in assets/app.js, between the BEGIN/END markers (u04 page)

Usage : python scripts/build_jihad_truce_tree.py          # rewrite PDFs and the app.js block
        python scripts/build_jihad_truce_tree.py --check  # exit 1 if the app.js block is stale
Needs : Pillow, cairosvg, and the Liberation Sans/Serif fonts (metric-compatible with Arial/Times).
Notes : the diagram is a derived teaching aid. Each node lists the chunk ids it rests on (chunk_ids in the JSON).
"""
import json, re, math, os, sys, html
from PIL import ImageFont
from xml.sax.saxutils import escape as xesc

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIG = os.path.join(ROOT, 'Library/Book 02 - Survey of the Lives of the Infallible Imams/teaching_materials/figures')
APP_JS = os.path.join(ROOT, 'assets', 'app.js')
D = json.load(open(os.path.join(FIG, 'jihad_truce_tree.json')))
FD = '/usr/share/fonts/truetype/liberation/'
def font(style, size):
    f = {'r': 'LiberationSans-Regular.ttf', 'b': 'LiberationSans-Bold.ttf', 'i': 'LiberationSans-Italic.ttf',
         'sr': 'LiberationSerif-Regular.ttf', 'sb': 'LiberationSerif-Bold.ttf', 'si': 'LiberationSerif-Italic.ttf'}[style]
    return ImageFont.truetype(FD + f, size)
SAFE = float(os.environ.get('TREE_SAFE', '1.05'))

def typo(t):
    t = t.replace("Mu'awiyah", "Mu\u2018awiyah")
    t = re.sub(r"(?<![\w])'(?=\w)", "\u2018", t)
    t = t.replace("'", "\u2019")
    t = re.sub(r'(?<![\w])"(?=\w)', "\u201c", t)
    t = t.replace('"', "\u201d")
    return t

def wrap(text, fnt, maxw):
    words, lines, cur = text.split(), [], ''
    for w in words:
        trial = (cur + ' ' + w).strip()
        if fnt.getlength(trial) * SAFE <= maxw: cur = trial
        else:
            lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

W, H = 2400, 1350
BG, INK, MUTE, LINE = '#FBF9F4', '#17202B', '#5B6572', '#9AA3AF'
HAS, HAS_D, HAS_T = '#0B5D3B', '#073B25', '#E2F0E8'
HUS, HUS_D, HUS_T = '#9B111E', '#6E0C15', '#F8E3E5'
S1C, S2C = '#3B4A63', '#245B74'
SANS = "Arial, 'Liberation Sans', Helvetica, sans-serif"
SERIF = "'Times New Roman', 'Liberation Serif', Georgia, serif"

nodes = {n['id']: n for n in D['nodes']}
# ---- path membership
def path_nodes(key):
    p = D['paths'][key]
    ids = ['start'] + [s[0] for s in p['steps']] + [p['end']]
    return ids
PN = {'h': path_nodes('hasan'), 'u': path_nodes('husayn')}
def path_edges(ids): return set(zip(ids[:-1], ids[1:]))
PE = {'h': path_edges(PN['h']), 'u': path_edges(PN['u'])}
ANS = {'h': dict(D['paths']['hasan']['steps']), 'u': dict(D['paths']['husayn']['steps'])}

# ---- geometry
for n in D['nodes']:
    k = n['kind']
    if k == 'start':
        n['lines'] = wrap(typo(n['text']), font('b', 19), n['w'] - 36)
        n['h'] = 26 + 24 * len(n['lines'])
    elif k == 'decision':
        n['lines'] = wrap(typo(n['text']), font('b', 20), n['w'] - 34)
        n['sub'] = [wrap(typo(t), font('r', 16), n['w'] - 62) for t in n.get('sub', [])]
        n['h'] = 36 + 12 + 26 * len(n['lines']) + 18 + (10 + sum(21 * len(x) for x in n['sub']) if n['sub'] else 0)
    else:
        uw = n['w'] - 12 - 34 - 16
        n['tl'] = wrap(typo(n['title']), font('b', 21), uw - (46 if n['tone'] != 'grey' else 0))
        n['bl'] = wrap(typo(n['text']), font('r', 17.5), uw)
        n['el'] = wrap(typo(n['example']), font('i', 16.5), uw)
        n['h'] = 18 + 27 * len(n['tl']) + 8 + 23 * len(n['bl']) + 8 + 22 * len(n['el']) + 16
    n['L'], n['R'] = n['x'] - n['w'] / 2, n['x'] + n['w'] / 2
    n['T'], n['B'] = n['y'] - n['h'] / 2, n['y'] + n['h'] / 2
    n['P'] = [p for p in 'hu' if n['id'] in PN[p]]

def autolayout():
    gap, top = 22, 194
    col = [nodes[k] for k in ('F', 'TRUCE', 'RISE', 'W')]
    y = top
    for n in col:
        n['y'] = y + n['h'] / 2; y += n['h'] + gap
    nodes['H1']['y'] = (nodes['F']['y'] + nodes['TRUCE']['y']) / 2
    nodes['U1']['y'] = (nodes['RISE']['y'] + nodes['W']['y']) / 2
    nodes['T1']['y'] = (nodes['H1']['y'] + nodes['U1']['y']) / 2
    nodes['D1']['y'] = nodes['D2']['y'] = nodes['T1']['y']
    nodes['D3']['y'] = nodes['T1']['y'] + 125
    nodes['L0']['y'] = nodes['D3']['y'] + nodes['D3']['h'] / 2 + 32 + nodes['L0']['h'] / 2
    nodes['L1']['y'] = nodes['D2']['y'] - nodes['D2']['h'] / 2 - 50 - nodes['L1']['h'] / 2
    nodes['start']['y'] = nodes['D1']['y'] - nodes['D1']['h'] / 2 - 52 - nodes['start']['h'] / 2
    for n in D['nodes']:
        n['T'], n['B'] = n['y'] - n['h'] / 2, n['y'] + n['h'] / 2
autolayout()

def overlaps(a, b, pad=8):
    return not (a['R'] + pad < b['L'] or b['R'] + pad < a['L'] or a['B'] + pad < b['T'] or b['B'] + pad < a['T'])
ids = list(nodes)
for i in range(len(ids)):
    for j in range(i + 1, len(ids)):
        if overlaps(nodes[ids[i]], nodes[ids[j]]): print('OVERLAP', ids[i], ids[j], file=sys.stderr)
for n in D['nodes']:
    if n['B'] > 985 or n['T'] < 184: print('OUT OF TREE AREA', n['id'], round(n['T']), round(n['B']), file=sys.stderr)

# ---- primitives
def bez(x1, y1, x2, y2, off=0.0):
    xm = (x1 + x2) / 2
    return (x1, y1 + off, xm, y1 + off, xm, y2 + off, x2, y2 + off)
def bez_pt(b, t):
    x1, y1, c1x, c1y, c2x, c2y, x2, y2 = b
    u = 1 - t
    return (u**3 * x1 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t**3 * x2,
            u**3 * y1 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t**3 * y2)
def bez_d(b): return "M%.1f,%.1f C%.1f,%.1f %.1f,%.1f %.1f,%.1f" % b
def tri(x, y, c, down=False):
    if down: return '<polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="%s"/>' % (x, y, x - 8, y - 13, x + 8, y - 13, c)
    return '<polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="%s"/>' % (x, y, x - 13, y - 8, x - 13, y + 8, c)

def text(x, y, s, size, fill, weight='normal', style='normal', anchor='start', family=SANS, ls=None, extra=''):
    a = ' letter-spacing="%s"' % ls if ls else ''
    return '<text x="%.1f" y="%.1f" font-family="%s" font-size="%s" font-weight="%s" font-style="%s" fill="%s" text-anchor="%s"%s%s>%s</text>' % (
        x, y, family, size, weight, style, fill, anchor, a, extra, xesc(s))

def chip(cx, cy, who, applied):
    col = HAS if who == 'h' else HUS
    o = []
    if who == 'h':
        o.append('<circle cx="%.1f" cy="%.1f" r="15" fill="%s" stroke="%s" stroke-width="3"/>' % (cx, cy, col if applied else '#fff', col))
    else:
        o.append('<rect x="%.1f" y="%.1f" width="30" height="30" rx="7" fill="%s" stroke="%s" stroke-width="3"/>' % (cx - 15, cy - 15, col if applied else '#fff', col))
    if applied:
        o.append('<polyline points="%.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>' % (cx - 6.5, cy + 0.5, cx - 2, cy + 5.5, cx + 7, cy - 5))
    else:
        o.append('<path d="M%.1f,%.1f L%.1f,%.1f M%.1f,%.1f L%.1f,%.1f" stroke="%s" stroke-width="3.4" stroke-linecap="round"/>' % (cx - 5.5, cy - 5.5, cx + 5.5, cy + 5.5, cx - 5.5, cy + 5.5, cx + 5.5, cy - 5.5, col))
    return ''.join(o)

def drop(cx, cy, s, col):
    return '<path transform="translate(%.1f,%.1f) scale(%.2f)" d="M0,-15 C7,-5 12,1 12,7 A12,12 0 1 1 -12,7 C-12,1 -7,-5 0,-15 Z" fill="%s"/>' % (cx, cy, s, col)

def badge(cx, cy, n, col):
    return ('<circle cx="%.1f" cy="%.1f" r="13" fill="#fff"/>' % (cx, cy)) + text(cx, cy + 6, str(n), 17, col, 'bold', anchor='middle')

# ---- element wrappers carrying view metadata
# data-p : which paths the element belongs to ("h","u","hu","" )
# data-ov: overlay owner ("h" or "u") - hidden unless that path is shown
def opacity_for(view, P):
    if view == 'both': return 1 if P else 0.55
    if view == 'h': return 1 if 'h' in P else 0.2
    if view == 'u': return 1 if 'u' in P else 0.2
    return 1
def show_ov(view, who): return view in ('both', who)

def render(view='both', interactive=False):
    o = []
    o.append('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" role="img" aria-labelledby="t d" id="tree">' % (W, H, W, H))
    o.append('<title id="t">%s</title>' % xesc(D['title']))
    o.append('<desc id="d">A yes/no decision tree for the jihad and truce frameworks in Mutahhari\u2019s chapter on Imam al-Hassan\u2019s pacifism. Imam al-Hassan\u2019s path (dark green) ends in truce; Imam al-Husayn\u2019s path (blood red) ends in uprising.</desc>')
    o.append('<rect width="%d" height="%d" fill="%s"/>' % (W, H, BG))
    # header
    o.append(text(50, 80, typo(D['title']), 56, INK, 'bold', family=SERIF))
    o.append(text(50, 114, typo(D['subtitle']), 21, MUTE))
    o.append(text(2350, 62, 'DEEP READING  \u00b7  BOOK 02  \u00b7  DERIVED TEACHING DIAGRAM', 15, MUTE, 'bold', anchor='end', ls='1.5'))
    o.append(text(2350, 90, 'A teaching framework drawn from Mutahhari, not a ruling for modern conflicts', 16, MUTE, anchor='end'))
    # panels
    o.append('<rect x="30" y="140" width="1105" height="850" rx="28" fill="#F3F1EA" stroke="#D8D3C6" stroke-width="2"/>')
    o.append('<rect x="1160" y="140" width="1212" height="850" rx="28" fill="#EAF1F4" stroke="#C9DAE1" stroke-width="2"/>')
    for i, (st, x) in enumerate(zip(D['stages'], (54, 1184))):
        col = S1C if i == 0 else S2C
        lab = st['label']
        o.append(text(x, 172, lab, 20, col, 'bold', ls='1'))
        o.append(text(x + len(lab) * 13.2 + 22, 172, '\u2014  ' + st['sub'], 19, MUTE))
    # ---- edges (base)
    def eport(e):
        a, b = nodes[e['from']], nodes[e['to']]
        if e.get('kind') == 'vertical':
            return None
        return (a['R'], a['y'] + e['dy_from'], b['L'], b['y'] + e['dy_to'])
    base, ovl, pills, arrows = [], [], [], []
    for e in D['edges']:
        key = (e['from'], e['to'])
        inp = [p for p in 'hu' if key in PE[p]]
        eop = opacity_for(view, inp)
        if e.get('kind') == 'vertical':
            a, b = nodes[e['from']], nodes[e['to']]
            x, y1, y2 = a['x'], a['B'], b['T']
            base.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="3.5" opacity="%s" data-p="%s"/>' % (x, y1, x, y2 - 12, LINE, eop, ''.join(inp)))
            for p in inp:
                off = (-4 if p == 'h' else 4) if len(inp) == 2 else 0
                w = 6 if len(inp) == 2 else 8
                col = HAS if p == 'h' else HUS
                disp = '' if show_ov(view, p) else ' display="none"'
                ovl.append('<g data-ov="%s"%s><line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%d" stroke-linecap="round"/>%s</g>' % (p, disp, x + off, y1, x + off, y2 - 12, col, w, tri(x + off, y2, col, True)))
            arrows.append('<g opacity="%s" data-p="%s">%s</g>' % (eop, ''.join(inp), tri(x, y2, LINE, True)))
            if e.get('label'):
                pills.append('<g opacity="%s" data-p="%s"><rect x="%.1f" y="%.1f" width="46" height="24" rx="12" fill="#2B3A4B"/>%s</g>' % (eop, ''.join(inp), x - 23, (y1 + y2) / 2 - 12, text(x, (y1 + y2) / 2 + 5, e['label'], 13.5, '#fff', 'bold', anchor='middle', ls='0.5')))
            continue
        x1, y1, x2, y2 = eport(e)
        b0 = bez(x1, y1, x2, y2)
        base.append('<path d="%s" fill="none" stroke="%s" stroke-width="3.5" stroke-linecap="round" opacity="%s" data-p="%s"/>' % (bez_d(b0), LINE, eop, ''.join(inp)))
        arrows.append('<g opacity="%s" data-p="%s">%s</g>' % (eop, ''.join(inp), tri(x2, y2, LINE)))
        for p in inp:
            off = (-3.8 if p == 'h' else 3.8) if len(inp) == 2 else 0
            w = 6 if len(inp) == 2 else 8
            col = HAS if p == 'h' else HUS
            bb = bez(x1, y1, x2, y2, off)
            disp = '' if show_ov(view, p) else ' display="none"'
            ovl.append('<g data-ov="%s"%s><path d="%s" fill="none" stroke="%s" stroke-width="%d" stroke-linecap="round"/>%s</g>' % (p, disp, bez_d(bb), col, w, tri(x2, y2 + off, col)))
        # pill
        t = 0.0
        while t < 1 and bez_pt(b0, t)[0] < x1 + 52: t += 0.01
        px, py = bez_pt(b0, t)
        pc = (HAS if inp == ['h'] else HUS if inp == ['u'] else '#2B3A4B')
        pills.append('<g opacity="%s" data-p="%s"><rect x="%.1f" y="%.1f" width="46" height="24" rx="12" fill="%s"/>%s</g>' % (eop, ''.join(inp), px - 23, py - 12, pc, text(px, py + 5, e['label'], 13.5, '#fff', 'bold', anchor='middle', ls='0.5')))
    o.append('<g id="edges-base">' + ''.join(base) + '</g>')
    o.append('<g id="edges-arrows">' + ''.join(arrows) + '</g>')
    o.append('<g id="edges-overlay">' + ''.join(ovl) + '</g>')
    # ---- nodes
    nodes_svg, chips = [], []
    for n in D['nodes']:
        P = n['P']
        nop = opacity_for(view, P)
        dash = ' stroke-dasharray="9 6"' if not P and n['id'] != 'start' else ''
        g = ['<g class="node" id="n-%s" data-p="%s" opacity="%s">' % (n['id'], ''.join(P), nop)]
        # halos
        for idx, p in enumerate(P):
            col = HAS if p == 'h' else HUS
            infl = 6 if len(P) == 1 else (6 if p == 'h' else 13)
            disp = '' if show_ov(view, p) else ' display="none"'
            if n['kind'] == 'start':
                continue
            g.append('<rect data-ov="%s"%s x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%d" fill="none" stroke="%s" stroke-width="5"/>' % (p, disp, n['L'] - infl, n['T'] - infl, n['w'] + 2 * infl, n['h'] + 2 * infl, 18 + infl, col))
        if n['kind'] == 'start':
            g.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" fill="#14212F"/>' % (n['L'], n['T'], n['w'], n['h'], n['h'] / 2))
            for i, ln in enumerate(n['lines']):
                g.append(text(n['x'], n['T'] + 33 + 24 * i, ln, 19, '#fff', 'bold', anchor='middle'))
        elif n['kind'] == 'decision':
            sc = S1C if n['stage'] == 'jihad' else S2C
            g.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="18" fill="#fff" stroke="%s" stroke-width="2.5"%s/>' % (n['L'], n['T'], n['w'], n['h'], sc, dash))
            g.append('<path d="M%.1f,%.1f V%.1f A18,18 0 0 1 %.1f,%.1f H%.1f A18,18 0 0 1 %.1f,%.1f V%.1f Z" fill="%s"/>' % (n['L'], n['T'] + 36, n['T'] + 18, n['L'] + 18, n['T'], n['R'] - 18, n['R'], n['T'] + 18, n['T'] + 36, sc))
            g.append(text(n['L'] + 16, n['T'] + 23, n['tag'], 13.5, '#fff', 'bold', ls='0.9'))
            for i, pid in enumerate(n['principles']):
                g.append(badge(n['R'] - 22 - 30 * (len(n['principles']) - 1 - i), n['T'] + 18, pid, sc))
            for i, ln in enumerate(n['lines']):
                g.append(text(n['L'] + 17, n['T'] + 36 + 12 + 21 + 26 * i, ln, 20, INK, 'bold'))
            yy = n['T'] + 36 + 12 + 26 * len(n['lines']) + 8
            for grp in n['sub']:
                g.append('<circle cx="%.1f" cy="%.1f" r="4" fill="%s"/>' % (n['L'] + 24, yy + 8, sc))
                for ln in grp:
                    g.append(text(n['L'] + 38, yy + 14, ln, 16, MUTE)); yy += 21
        else:
            tone = n['tone']
            fill = {'grey': '#F4F2EC', 'hasan': HAS_T, 'husayn': HUS_T}[tone]
            edge = {'grey': '#B8B2A2', 'hasan': HAS, 'husayn': HUS}[tone]
            tcol = {'grey': '#3A4350', 'hasan': HAS_D, 'husayn': HUS_D}[tone]
            sw = 2.5 if tone == 'grey' else 4
            g.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="18" fill="%s" stroke="%s" stroke-width="%s"%s/>' % (n['L'], n['T'], n['w'], n['h'], fill, edge, sw, dash))
            g.append('<path d="M%.1f,%.1f a18,18 0 0 0 -18,18 v%.1f a18,18 0 0 0 18,18 z" fill="%s" transform="translate(18,0)"/>' % (n['L'], n['T'], n['h'] - 36, edge) if False else '')
            g.append('<rect x="%.1f" y="%.1f" width="12" height="%.1f" rx="6" fill="%s"/>' % (n['L'] + 10, n['T'] + 14, n['h'] - 28, edge))
            tx = n['L'] + 12 + 22
            y = n['T'] + 18 + 21
            for ln in n['tl']:
                g.append(text(tx, y, ln, 21, tcol, 'bold')); y += 27
            y += 8 - 5
            for ln in n['bl']:
                g.append(text(tx, y + 3, ln, 17.5, INK)); y += 23
            y += 8
            for ln in n['el']:
                g.append(text(tx, y + 3, ln, 16.5, MUTE, style='italic')); y += 22
            if tone != 'grey':
                g.append(drop(n['R'] - 34, n['T'] + 40, 1.25, edge))
            for i, pid in enumerate(n['principles']):
                g.append(badge(n['R'] - 26, n['B'] - 24, pid, edge if tone != 'grey' else '#6B7480').replace('fill="#fff"', 'fill="#fff" stroke="%s" stroke-width="2"' % edge, 1))
        g.append('</g>')
        nodes_svg.append(''.join(g))
        # chips for decision nodes
        if n['kind'] == 'decision':
            for p in 'hu':
                if p in ANS and n['id'] in ANS[p]:
                    app = ANS[p][n['id']] == 'yes'
                    cx = n['L'] + (28 if p == 'h' else 68)
                    disp = '' if show_ov(view, p) else ' display="none"'
                    chips.append('<g data-ov="%s"%s data-node="%s">%s</g>' % (p, disp, n['id'], chip(cx, n['B'] + 2 if False else n['B'] - 0, p, app)))
    o.append('<g id="nodes">' + ''.join(nodes_svg) + '</g>')
    o.append('<g id="pills">' + ''.join(pills) + '</g>')
    o.append('<g id="chips">' + ''.join(chips) + '</g>')
    # ---- quote card
    q = D['quotes'][0]
    qx, qy, qw = 800, 215, 310
    ql = wrap(typo(q['text']), font('si', 27), qw - 56)
    qh = 62 + 34 * len(ql) + 44
    o.append('<rect x="%d" y="%d" width="%d" height="%d" rx="20" fill="#fff" stroke="#D8D3C6" stroke-width="2"/>' % (qx, qy, qw, qh))
    o.append(text(qx + 24, qy + 62, '\u201c', 72, '#C9B98F', 'bold', family=SERIF))
    for i, ln in enumerate(ql):
        o.append(text(qx + 30, qy + 82 + 34 * i, ln, 27, INK, style='italic', family=SERIF))
    o.append(text(qx + 30, qy + qh - 16, 'Mutahhari \u00b7 ' + q['source'], 15.5, MUTE, 'bold', ls='0.5'))
    # ---- legend
    lx, ly, lw, lh = 50, 700, 690, 285
    o.append('<rect x="%d" y="%d" width="%d" height="%d" rx="20" fill="#fff" stroke="#D8D3C6" stroke-width="2"/>' % (lx, ly, lw, lh))
    o.append(text(lx + 24, ly + 34, 'HOW TO READ THE TREE', 15, MUTE, 'bold', ls='1.5'))
    def lrow(i): return ly + 64 + 33 * i
    o.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="8" stroke-linecap="round"/>' % (lx + 24, lrow(0), lx + 84, lrow(0), HAS))
    o.append(drop(lx + 104, lrow(0) + 2, 0.9, HAS))
    o.append(text(lx + 126, lrow(0) + 6, 'Imam al-Hassan (a) \u00b7 dark green \u00b7 aftermath: poison', 17.5, INK, 'bold'))
    o.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="8" stroke-linecap="round"/>' % (lx + 24, lrow(1), lx + 84, lrow(1), HUS))
    o.append(drop(lx + 104, lrow(1) + 2, 0.9, HUS))
    o.append(text(lx + 126, lrow(1) + 6, 'Imam al-Husayn (a) \u00b7 blood red \u00b7 aftermath: bloodshed', 17.5, INK, 'bold'))
    o.append(chip(lx + 40, lrow(2), 'h', True) + chip(lx + 82, lrow(2), 'u', True))
    o.append(text(lx + 126, lrow(2) + 6, 'Principle applied (answer YES)', 17.5, INK))
    o.append(chip(lx + 40, lrow(3), 'h', False) + chip(lx + 82, lrow(3), 'u', False))
    o.append(text(lx + 126, lrow(3) + 6, 'Principle did not apply (answer NO)', 17.5, INK))
    o.append('<rect x="%d" y="%d" width="60" height="26" rx="8" fill="#F4F2EC" stroke="#B8B2A2" stroke-width="2.5" stroke-dasharray="9 6"/>' % (lx + 24, lrow(4) - 13))
    o.append(text(lx + 126, lrow(4) + 6, 'Not on either path: the law, but not their case', 17.5, INK))
    o.append(badge(lx + 54, lrow(5), 1, S1C).replace('fill="#fff"', 'fill="#fff" stroke="%s" stroke-width="2"' % S1C, 1))
    o.append(text(lx + 126, lrow(5) + 6, 'Numbered badges link a box to the scorecard below', 17.5, INK))
    o.append(text(lx + 24, lrow(6) + 6, 'Colours mark each route, not a causal output of the tree.', 16.5, MUTE, style='italic'))
    # ---- scorecard
    PR = D['principles']; k = len(PR)
    gap = 16; cw = (2320 - gap * (k - 1)) / k; sy, sh = 1040, 200
    o.append(text(40, 1020, 'THE SIX PRINCIPLES \u2014 HOW EACH ONE APPLIED TO EACH IMAM', 16, MUTE, 'bold', ls='1.5'))
    cond = [i for i, p in enumerate(PR) if p.get('condition')]
    if cond:
        bx1 = 40 + cond[0] * (cw + gap); bx2 = 40 + cond[-1] * (cw + gap) + cw
        o.append('<path d="M%.1f,1038 V1031 H%.1f V1038" fill="none" stroke="%s" stroke-width="3" stroke-linecap="round"/>' % (bx1, bx2, S2C))
        t = D['condition_tally']
        o.append(text(bx2, 1019, '%s:  al-Hassan %s  \u00b7  al-Husayn %s' % (t['label'], t['hasan'], t['husayn']), 15.5, S2C, 'bold', anchor='end'))
    for i, pr in enumerate(PR):
        x = 40 + i * (cw + gap)
        o.append('<rect x="%.1f" y="%d" width="%.1f" height="%d" rx="18" fill="#fff" stroke="%s" stroke-width="2"/>' % (x, sy, cw, sh, '#9DB7C4' if pr.get('condition') else '#DDD7C8'))
        o.append('<circle cx="%.1f" cy="%d" r="16" fill="%s"/>' % (x + 28, sy + 34, S1C if i < 2 else S2C))
        o.append(text(x + 28, sy + 40, str(pr['id']), 18, '#fff', 'bold', anchor='middle'))
        nl = wrap(typo(pr['name']), font('b', 19), cw - 58 - 12)
        for j, l in enumerate(nl[:2]):
            o.append(text(x + 54, sy + (40 if len(nl) == 1 else 30) + 22 * j, l, 19, INK, 'bold'))
        o.append('<line x1="%.1f" y1="%d" x2="%.1f" y2="%d" stroke="#E8E3D6" stroke-width="2"/>' % (x + 14, sy + 66, x + cw - 14, sy + 66))
        for r, who in enumerate(('hasan', 'husayn')):
            p = 'h' if who == 'hasan' else 'u'
            cy = sy + 104 + r * 58
            disp = '' if show_ov(view, p) else ' display="none"'
            applied = pr[who]['answer'] == 'yes'
            ln = wrap(typo(pr[who]['note']), font('r', 16), cw - 74)
            g = ['<g data-ov="%s"%s>' % (p, disp), chip(x + 30, cy, p, applied)]
            for q2, l in enumerate(ln[:2]):
                g.append(text(x + 56, cy - 3 + 20 * q2 + (0 if len(ln) > 1 else 5), l, 16, INK))
            g.append('</g>')
            o.append(''.join(g))
    # ---- footer
    o.append('<rect x="0" y="1252" width="%d" height="98" fill="#14212F"/>' % W)
    o.append(text(50, 1318, 'Same law. Different circumstances.', 42, '#fff', 'bold', family=SERIF))
    o.append(text(920, 1296, 'Neither Imam changed the law. The circumstances changed the answer.', 24, '#E8EEF3', 'bold'))
    q2 = D['quotes'][1]
    o.append(text(920, 1330, typo('\u201c' + q2['text'] + '\u201d') + '  \u00b7  Mutahhari, ' + q2['source'], 19.5, '#B9C7D3', style='italic'))
    o.append('</svg>')
    return '\n'.join(o)


def webify(svg):
    """Turn the baked 'both' SVG into class-driven markup for the website (matches mode-hasan / mode-husayn wiring)."""
    svg = re.sub(r'<title id="t">.*?</title>\s*<desc id="d">.*?</desc>', '', svg, flags=re.S)
    svg = re.sub(r'<svg [^>]*id="tree">',
        '<svg id="map" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" role="img" '
        'aria-label="Yes/no decision tree for the jihad and truce frameworks. Imam al-Hassan\'s path is dark green and ends in truce; '
        'Imam al-Husayn\'s path is blood red and ends in uprising.">' % (W, H), svg, count=1)
    cmap = {'h': 'p-hasan', 'u': 'p-husayn', 'hu': 'p-both', 'uh': 'p-both', '': 'off'}
    def conv(m):
        tag = m.group(0)
        mp = re.search(r' data-p="([hu]*)"', tag); mo = re.search(r' data-ov="([hu])"', tag)
        if not (mp or mo): return tag
        cls = []
        if mp: cls.append(cmap[mp.group(1)])
        if mo: cls += (['ov-hasan', 'p-hasan'] if mo.group(1) == 'h' else ['ov-husayn', 'p-husayn'])
        tag = re.sub(r' data-p="[hu]*"| data-ov="[hu]"| opacity="[^"]*"| display="none"', '', tag)
        mc = re.search(r' class="([^"]*)"', tag)
        if mc: tag = tag.replace(mc.group(0), ' class="%s"' % (mc.group(1) + ' ' + ' '.join(cls)))
        else: tag = re.sub(r'^<(\w+)', lambda x: '<%s class="%s"' % (x.group(1), ' '.join(cls)), tag)
        return tag
    svg = re.sub(r'<(?:g|path|line|rect|circle|polygon)\b[^>]*>', conv, svg)
    assert '`' not in svg and '${' not in svg and '\\' not in svg, 'unsafe for a JS template literal'
    return svg


BEGIN = '<!-- BEGIN generated: jihad-truce-tree (scripts/build_jihad_truce_tree.py) -->'
END = '<!-- END generated: jihad-truce-tree -->'

def site_block():
    # the site uses a slightly wider text-fit factor than the deck PDFs (viewer fonts are not embedded)
    import subprocess
    r = subprocess.run([sys.executable, os.path.abspath(__file__), '--emit-site'],
                       env=dict(os.environ, TREE_SAFE='1.07'), capture_output=True, text=True, check=True)
    if r.stderr.strip(): raise SystemExit('layout warnings:\n' + r.stderr)
    return r.stdout.strip()

def splice(js, block):
    new = BEGIN + '\n' + block + '\n' + END
    if BEGIN in js:
        return re.sub(re.escape(BEGIN) + r'.*?' + re.escape(END), lambda m: new, js, count=1, flags=re.S)
    m = re.search(r'<svg id="map".*?</svg>', js, flags=re.S)
    assert m, 'no <svg id="map"> found in assets/app.js'
    return js[:m.start()] + new + js[m.end():]

if __name__ == '__main__':
    if '--emit-site' in sys.argv:
        print(webify(render('both'))); sys.exit(0)
    js = open(APP_JS, encoding='utf-8').read()
    out = splice(js, site_block())
    if '--check' in sys.argv:
        sys.exit(0 if out == js else (print('assets/app.js tree block is stale: run scripts/build_jihad_truce_tree.py') or 1))
    import cairosvg
    for v, name in (('both', 'overlay'), ('h', 'hassan'), ('u', 'husayn'), ('clean', 'clean')):
        cairosvg.svg2pdf(bytestring=render(v).encode(), write_to=os.path.join(FIG, 'jihad-truce-tree-%s.pdf' % name))
    open(APP_JS, 'w', encoding='utf-8').write(out)
    print('wrote 4 PDFs and updated assets/app.js')
