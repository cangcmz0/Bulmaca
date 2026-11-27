"""Builds the legal pages from PRIVACY.md and TERMS.md (single source of truth):
docs/privacy-policy.html, docs/terms.html (standalone pages), plus plain-text copies for
pasting into Google Sites. Usage: python3 scripts/make-legal.py [artifact_out.html]"""
import html, re, sys

def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'`(.+?)`', r'<code>\1</code>', t)
    t = re.sub(r'(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])', r'<em>\1</em>', t)
    def link(m):
        label, url = m.group(1), m.group(2)
        url = {'PRIVACY.md': 'privacy-policy.html', 'TERMS.md': 'terms.html'}.get(url, url)
        return f'<a href="{url}">{label}</a>'
    return re.sub(r'\[([^\]]+)\]\(([^)]+)\)', link, t)

def slug(t):
    return re.sub(r'[^\w-]', '', re.sub(r'\s+', '-', t.strip().lower()))

def md_to_html(md):
    out, para, lst, tbl = [], [], [], []
    def flush():
        nonlocal para, lst, tbl
        if para: out.append('<p>' + inline(' '.join(para)) + '</p>'); para = []
        if lst: out.append('<ul>' + ''.join(f'<li>{inline(x)}</li>' for x in lst) + '</ul>'); lst = []
        if tbl:
            rows = [[c.strip() for c in r.strip('|').split('|')] for r in tbl if not re.match(r'^\|[\s:|-]+\|$', r)]
            head, body = rows[0], rows[1:]
            out.append('<div class="scroll"><table><thead><tr>' + ''.join(f'<th>{inline(c)}</th>' for c in head) + '</tr></thead><tbody>'
                       + ''.join('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in r) + '</tr>' for r in body) + '</tbody></table></div>')
            tbl = []
    for line in md.splitlines():
        s = line.rstrip()
        if not s: flush(); continue
        m = re.match(r'^(#{1,3}) (.*)', s)
        if m:
            flush(); n = len(m.group(1)); out.append(f'<h{n} id="{slug(m.group(2))}">{inline(m.group(2))}</h{n}>'); continue
        if s == '---': flush(); out.append('<hr>'); continue
        if s.startswith('|'): tbl.append(s); continue
        if s.startswith('- '): lst.append(s[2:]); continue
        para.append(s)
    flush()
    return '\n'.join(out)

def md_to_text(md):
    t = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', lambda m: m.group(1) if m.group(2).endswith('.md') or m.group(2).startswith('#') else f'{m.group(1)} ({m.group(2)})', md)
    t = t.replace('**', '').replace('`', '')
    t = re.sub(r'^\*(.*)\*$', r'\1', t, flags=re.M)
    t = re.sub(r'^#{1,3} ', '', t, flags=re.M)
    t = re.sub(r'^- ', '• ', t, flags=re.M)
    t = re.sub(r'^\|[\s:|-]+\|$\n', '', t, flags=re.M)
    t = re.sub(r'^\| ?(.*?) ?\|$', lambda m: ' — '.join(c.strip() for c in m.group(1).split('|')), t, flags=re.M)
    return t.replace('\n---\n', '\n\n────────────\n\n').strip() + '\n'

CSS = """:root{color-scheme:light dark;--bg:light-dark(#ffffff,#1b1715);--ink:light-dark(#2a1f1b,#f1e8e3);--muted:light-dark(#6e5d55,#b9a69c);--accent:light-dark(#c24f22,#ff9a6b);--rule:light-dark(#eadfd8,#3a302b)}
:root[data-theme=light]{color-scheme:light}
:root[data-theme=dark]{color-scheme:dark}
*{box-sizing:border-box;min-width:0}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow-x:clip}
main{max-width:760px;margin:0 auto;padding-block:40px 64px;padding-left:max(5vw,16px,env(safe-area-inset-left,0px));padding-right:max(5vw,16px,env(safe-area-inset-right,0px))}
h1{font-size:clamp(26px,5vw,34px);line-height:1.15;letter-spacing:-.02em;margin:0 0 8px;text-wrap:balance}
h2{font-size:22px;margin:36px 0 8px}
h3{font-size:17px;color:var(--accent);margin:24px 0 6px}
p,li,td,th{overflow-wrap:anywhere}
p{margin:0 0 10px}
ul{padding-left:22px;margin:0 0 10px}
em{color:var(--muted);font-style:normal;font-size:14px}
hr{border:0;border-top:1px solid var(--rule);margin:40px 0}
a{color:var(--accent)}
.scroll{overflow-x:auto;margin:0 0 12px}
table{border-collapse:collapse;width:100%;font-size:14px}
th,td{border:1px solid var(--rule);padding:8px;text-align:left;vertical-align:top}
th{background:color-mix(in srgb,var(--accent) 10%,transparent)}
code{font-size:14px}"""

def page(md, title, standalone=True):
    body = md_to_html(md)
    if standalone:
        return f'<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>{title}</title>\n<style>{CSS}</style>\n</head>\n<body>\n<main>\n{body}\n</main>\n</body>\n</html>\n'
    return f'<title>{title}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>{CSS}</style>\n<main>\n{body}\n</main>\n'

priv, terms = open('PRIVACY.md').read(), open('TERMS.md').read()
open('docs/privacy-policy.html', 'w').write(page(priv, 'Patikaç – Gizlilik Politikası'))
open('docs/terms.html', 'w').write(page(terms, 'Patikaç – Kullanım Koşulları'))
open('release/Patikac-Gizlilik-Politikasi-Google-Sites.txt', 'w').write(md_to_text(priv))
open('release/Patikac-Kullanim-Kosullari-Google-Sites.txt', 'w').write(md_to_text(terms))
if len(sys.argv) > 1:
    open(sys.argv[1], 'w').write(page(priv, 'Patikaç Gizlilik Politikası', standalone=False))
print('legal pages written')
