"""
App Store screenshots in the "Bench Games" campaign style (marketing/finished/social/bench-games):
huge Black Italic headlines with a red punch line, paper / carbon / red / photo panels,
"01 / WEEK" chapter tags, real app captures in a device frame, and key UI pulled out large.

  python3 scripts/store/campaign_screenshots.py            # both sets
  python3 scripts/store/campaign_screenshots.py phone|ipad

Reads marketing/screenshots/raw-iphone|raw-ipad and the campaign's generated hockey art;
writes marketing/screenshots/app-store-v2/iphone-6.9 (1320x2868) and ipad-13 (2064x2752).
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
MKT = ROOT / 'marketing'
RAW = {'phone': MKT / 'screenshots/raw-iphone', 'ipad': MKT / 'screenshots/raw-ipad'}
OUT = {'phone': MKT / 'screenshots/app-store-v2/iphone-6.9', 'ipad': MKT / 'screenshots/app-store-v2/ipad-13'}
SIZE = {'phone': (1320, 2868), 'ipad': (2064, 2752)}
HOCKEY_ART = MKT / 'output/02-bench-games-v2/source/hockey-opener.png'

INK = (21, 21, 30)
PAPER = (242, 240, 236)
RED = (225, 6, 0)
WHITE = (255, 255, 255)

THEMES = {
    'paper': {'bg': PAPER, 'text': INK, 'sub': (95, 95, 107), 'punch': RED, 'tag': (140, 140, 150), 'dot': RED},
    'carbon': {'bg': INK, 'text': WHITE, 'sub': (166, 166, 176), 'punch': RED, 'tag': (120, 120, 132), 'dot': RED},
    'red': {'bg': RED, 'text': WHITE, 'sub': (255, 214, 210), 'punch': INK, 'tag': (255, 190, 184), 'dot': WHITE},
    'photo': {'bg': INK, 'text': WHITE, 'sub': (205, 205, 212), 'punch': RED, 'tag': (170, 170, 180), 'dot': RED},
}

SF_ITALIC = '/System/Library/Fonts/SFNSItalic.ttf'
SF = '/System/Library/Fonts/SFNS.ttf'

# Card boxes inside the 1320x2868 iPhone captures (measured), for the enlarged callouts.
CROPS = {
    'tonight-hero': ('02-tonight.png', (48, 532, 1272, 1342)),
    'tonight-move': ('02-tonight.png', (48, 1548, 1272, 1802)),
    'week-hero': ('04-week.png', (48, 524, 1272, 1149)),
    'pickup-card': ('05-pickups.png', (48, 1161, 1272, 1624)),
    'telemetry': ('07-telemetry.png', (48, 317, 1272, 1112)),
}

# Headline lines split on "|"; a leading "*" sets the line in the punch colour.
PHONE = [
    dict(file='01-bench.png', theme='photo', tag='FANTASY HOCKEY COACH',
         headline='YOUR BENCH|IS COSTING|*YOU.', size=210,
         sub='PuckIQ coaches the Yahoo, ESPN or Fantrax team you already have — every night.',
         pop='week-hero', pop_at=(0.5, 0.80), pop_w=0.88, pop_tilt=-3),
    dict(file='02-tonight.png', theme='paper', chapter='01 / TONIGHT',
         headline='KNOW WHAT|TO FIX BEFORE|*LOCK.',
         sub='Who plays, who’s scratched, and exactly who to sit — with a countdown to first puck.',
         device='02-tonight.png', device_at=(0.5, 0.50), device_w=0.80,
         pop='tonight-move', pop_at='lift', pop_w=0.98, pop_tilt=-2),
    dict(file='03-week.png', theme='carbon', chapter='02 / WEEK · PRO',
         headline='THE GAMES|*THAT COUNT.',
         stat=('41', 'of your 48 games count this week', '−7', 'BENCHED'),
         device='04-week.png', device_at=(0.5, 0.60), device_w=0.80),
    dict(file='04-pickups.png', theme='paper', chapter='03 / PICKUPS',
         headline='FIND GAMES|*THAT FIT.',
         sub='Streamers ranked by the empty nights they fill for your team — not just who’s hot.',
         device='05-pickups.png', device_at=(0.5, 0.45), device_w=0.80,
         pop='pickup-card', pop_at='lift', pop_w=0.98, pop_tilt=-2),
    dict(file='05-lineup.png', theme='red', chapter='04 / BEST LINEUP · PRO',
         headline='THE LINEUP|YOUR SLOTS|*ALLOW.',
         sub='Filled slot by slot from your league’s real positions.',
         device='03-lineup.png', device_at=(0.5, 0.49), device_w=0.80),
    dict(file='06-player.png', theme='carbon', chapter='05 / PLAYERS',
         headline='SCOUT EVERY|*PLAYER.',
         sub='Form, game logs and this week’s schedule. NHL Edge speed & shot data with Pro.',
         device='06-player.png', device_at=(0.5, 0.40), device_w=0.80,
         pop='telemetry', pop_at=(0.5, 0.65), pop_w=0.92, pop_tilt=2),
    dict(file='07-share.png', theme='paper', chapter='06 / SHARE',
         headline='TALK TRASH|IN THE|*GROUP CHAT.',
         sub='One tap turns your night into a card for the league chat.',
         device='08-share.png', device_at=(0.5, 0.49), device_w=0.80),
    dict(file='08-finale.png', theme='red', chapter='PUCKIQ',
         headline='MAKE EVERY|*GAME COUNT.',
         sub='Free to download. PuckIQ Pro unlocks the full coach.',
         fan=['04-week.png', '02-tonight.png', '05-pickups.png']),
]

IPAD = [
    dict(file='01-bench.png', theme='photo', tag='FANTASY HOCKEY COACH',
         headline='YOUR BENCH IS|COSTING *YOU.', size=190,
         sub='PuckIQ coaches the Yahoo, ESPN or Fantrax team you already have — every night.',
         device='04-week.png', device_at=(0.5, 1.08), device_w=0.84),
    dict(file='02-tonight.png', theme='paper', chapter='01 / TONIGHT',
         headline='KNOW WHAT TO FIX|*BEFORE LOCK.',
         sub='Who plays, who’s scratched, and exactly who to sit — with a countdown to first puck.',
         device='02-tonight.png', device_at=(0.5, 0.49), device_w=0.84),
    dict(file='03-week.png', theme='carbon', chapter='02 / WEEK · PRO',
         headline='THE GAMES|*THAT COUNT.',
         sub='Games that actually count once your lineup slots fill — this week and next.',
         device='04-week.png', device_at=(0.5, 0.49), device_w=0.84),
    dict(file='04-pickups.png', theme='paper', chapter='03 / PICKUPS',
         headline='FIND GAMES|*THAT FIT.',
         sub='Streamers ranked by the empty nights they fill for your team.',
         device='05-pickups.png', device_at=(0.5, 0.49), device_w=0.84),
    dict(file='05-roster.png', theme='red', chapter='04 / ROSTER',
         headline='EVERY PLAYER.|*EVERY GAME.',
         sub='Free to download. PuckIQ Pro unlocks the full coach.',
         device='10-roster.png', device_at=(0.5, 0.49), device_w=0.84),
]


def font(path: str, size: int, style: str) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(path, size)
    f.set_variation_by_name(style)
    return f


def tracked(draw: ImageDraw.ImageDraw, xy, text: str, fnt, fill, spacing: float) -> int:
    """Letter-spaced text; returns the end x."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + spacing
    return int(x)


def tracked_width(draw, text, fnt, spacing) -> float:
    return sum(draw.textlength(ch, font=fnt) + spacing for ch in text) - spacing


def wrap(draw, text: str, fnt, max_w: int) -> list:
    lines, cur = [], ''
    for word in text.split():
        trial = f'{cur} {word}'.strip()
        if draw.textlength(trial, font=fnt) <= max_w:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def rounded(img: Image.Image, radius: int) -> Image.Image:
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.width - 1, img.height - 1), radius=radius, fill=255)
    out = img.convert('RGBA')
    out.putalpha(mask)
    return out


def with_shadow(img: Image.Image, blur: int, offset: int, opacity: int) -> Image.Image:
    pad = blur * 3
    canvas = Image.new('RGBA', (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))
    shadow = Image.new('RGBA', img.size, (0, 0, 0, opacity))
    shadow.putalpha(img.getchannel('A').point(lambda a: a * opacity // 255))
    canvas.paste(shadow, (pad, pad + offset), shadow)
    canvas = canvas.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(img, (pad, pad))
    return canvas


def device(screen: Image.Image, width: int, kind: str) -> Image.Image:
    """A dark titanium device around a raw capture (captures already include the status bar)."""
    bezel = int(width * (0.028 if kind == 'phone' else 0.022))
    sw = width - bezel * 2
    sh = int(screen.height * sw / screen.width)
    outer_r = int(width * (0.135 if kind == 'phone' else 0.05))
    body = Image.new('RGBA', (width, sh + bezel * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(body)
    d.rounded_rectangle((0, 0, width - 1, sh + bezel * 2 - 1), radius=outer_r, fill=(14, 14, 18), outline=(92, 92, 102), width=max(3, width // 330))
    shot = rounded(screen.resize((sw, sh), Image.LANCZOS), max(outer_r - bezel, 8))
    body.alpha_composite(shot, (bezel, bezel))
    return body


def paste_center(canvas: Image.Image, img: Image.Image, cx: float, cy: float) -> None:
    canvas.alpha_composite(img, (int(cx - img.width / 2), int(cy - img.height / 2)))


def place(canvas, img, rel, tilt=0, shadow=(40, 24, 150)):
    if tilt:
        img = img.rotate(tilt, resample=Image.BICUBIC, expand=True)
    img = with_shadow(img, *shadow)
    W, H = canvas.size
    paste_center(canvas, img, rel[0] * W, rel[1] * H)


def background(theme: str, size) -> Image.Image:
    W, H = size
    bg = Image.new('RGBA', size, THEMES[theme]['bg'] + (255,))
    if theme == 'photo':
        art = Image.open(HOCKEY_ART).convert('RGB')
        scale = max(W / art.width, H / art.height)
        art = art.resize((int(art.width * scale), int(art.height * scale)), Image.LANCZOS)
        left, top = (art.width - W) // 2, (art.height - H) // 2
        bg = art.crop((left, top, left + W, top + H)).convert('RGBA')
        # Dark at the top for the headline, clear through the puck, dark again under the device.
        shade = Image.new('RGBA', size, (0, 0, 0, 0))
        sd = ImageDraw.Draw(shade)
        for y in range(H):
            t = y / H
            a = 200 if t < 0.18 else int(200 - (t - 0.18) / 0.22 * 150) if t < 0.40 else 50 if t < 0.55 else int(50 + (t - 0.55) / 0.45 * 170)
            sd.line((0, y, W, y), fill=(10, 10, 14, max(0, min(230, a))))
        bg.alpha_composite(shade)
    elif theme == 'carbon':
        # Faint rink lines, the app's "circuit map".
        d = ImageDraw.Draw(bg)
        line = (255, 255, 255, 14)
        r = int(W * 0.34)
        d.ellipse((W / 2 - r, H * 0.62 - r, W / 2 + r, H * 0.62 + r), outline=line, width=5)
        d.line((0, H * 0.62, W, H * 0.62), fill=line, width=5)
    elif theme == 'red':
        # A soft darker vignette so the device sits in light.
        glow = Image.new('RGBA', size, (0, 0, 0, 0))
        ImageDraw.Draw(glow).ellipse((-W * 0.3, H * 0.35, W * 1.3, H * 1.4), fill=(120, 0, 0, 90))
        bg.alpha_composite(glow.filter(ImageFilter.GaussianBlur(W // 6)))
    return bg


def masthead(canvas, spec, kind):
    W, H = canvas.size
    t = THEMES[spec['theme']]
    d = ImageDraw.Draw(canvas)
    m = int(W * 0.073)
    top = int(H * 0.042)
    brand = font(SF_ITALIC, int(W * 0.03), 'Black Italic')
    r = int(W * 0.0075)
    d.ellipse((m, top + brand.size * 0.42 - r, m + 2 * r, top + brand.size * 0.42 + r), fill=t['dot'])
    tracked(d, (m + 2 * r + int(W * 0.012), top), 'PUCKIQ', brand, t['text'], brand.size * 0.08)
    chapter = spec.get('chapter')
    if chapter and chapter != 'PUCKIQ':
        f = font(SF, int(W * 0.024), 'Heavy')
        w = tracked_width(d, chapter, f, f.size * 0.14)
        tracked(d, (W - m - w, top + int(brand.size * 0.12)), chapter, f, t['tag'], f.size * 0.14)
    return top + brand.size + int(H * 0.035)


def headline(canvas, spec, y, kind):
    W, H = canvas.size
    t = THEMES[spec['theme']]
    d = ImageDraw.Draw(canvas)
    m = int(W * 0.073)
    lines = spec['headline'].split('|')
    size = spec.get('size', int(W * (0.128 if kind == 'phone' else 0.092)))
    # Shrink until the widest line fits (italic overhang included).
    while True:
        f = font(SF_ITALIC, size, 'Black Italic')
        widest = max(d.textlength(l.replace('*', ''), font=f) * 1.05 for l in lines)
        if widest <= W - 2 * m or size < 60:
            break
        size -= 4
    lh = int(size * 0.96)
    for line in lines:
        # "*" can start a line or sit mid-line ("COSTING *YOU."): everything after it is punch.
        head, _, punch = line.partition('*')
        x = m
        if head:
            d.text((x, y), head, font=f, fill=t['text'])
            x += d.textlength(head, font=f)
        if punch:
            d.text((x, y), punch, font=f, fill=t['punch'])
        y += lh
    return y + int(H * 0.012)


def subline(canvas, spec, y, kind):
    if not spec.get('sub'):
        return y
    W, H = canvas.size
    t = THEMES[spec['theme']]
    d = ImageDraw.Draw(canvas)
    m = int(W * 0.073)
    f = font(SF, int(W * (0.037 if kind == 'phone' else 0.026)), 'Semibold')
    for line in wrap(d, spec['sub'], f, int((W - 2 * m) * 0.96)):
        d.text((m, y), line, font=f, fill=t['sub'])
        y += int(f.size * 1.3)
    return y


def tag_chip(canvas, text, y, kind):
    """The small white label from the campaign opener."""
    W, H = canvas.size
    d = ImageDraw.Draw(canvas)
    m = int(W * 0.073)
    f = font(SF, int(W * 0.022), 'Heavy')
    w = tracked_width(d, text, f, f.size * 0.12)
    pad = int(f.size * 0.55)
    d.rectangle((m, y, m + w + pad * 2, y + f.size + pad * 1.4), fill=(245, 245, 245))
    tracked(d, (m + pad, y + pad * 0.55), text, f, INK, f.size * 0.12)
    return y + f.size + int(pad * 1.4) + int(H * 0.02)


def stat_block(canvas, spec, y):
    """Campaign counter: big number, caption, red '−7 BENCHED' disc."""
    W, H = canvas.size
    t = THEMES[spec['theme']]
    d = ImageDraw.Draw(canvas)
    m = int(W * 0.073)
    big, caption, disc, disc_label = spec['stat']
    fb = font(SF_ITALIC, int(W * 0.25), 'Black Italic')
    d.text((m - int(W * 0.01), y - int(fb.size * 0.18)), big, font=fb, fill=t['text'])
    bw = d.textlength(big, font=fb)
    r = int(W * 0.085)
    cx, ccy = W - m - r, y + int(fb.size * 0.40)
    fc = font(SF, int(W * 0.034), 'Semibold')
    cap_x = m + bw + int(W * 0.03)
    cap_lines = wrap(d, caption, fc, int(cx - r - int(W * 0.03) - cap_x))
    cy = ccy - len(cap_lines) * fc.size * 1.3 / 2
    for line in cap_lines:
        d.text((cap_x, cy), line, font=fc, fill=t['sub'])
        cy += int(fc.size * 1.3)
    d.ellipse((cx - r, ccy - r, cx + r, ccy + r), fill=RED)
    fd = font(SF_ITALIC, int(r * 0.85), 'Black Italic')
    dw = d.textlength(disc, font=fd)
    d.text((cx - dw / 2 - r * 0.04, ccy - fd.size * 0.62), disc, font=fd, fill=WHITE)
    fl = font(SF, int(W * 0.018), 'Heavy')
    lw = tracked_width(d, disc_label, fl, fl.size * 0.14)
    tracked(d, (cx - lw / 2, ccy + r + int(W * 0.012)), disc_label, fl, RED if spec['theme'] != 'red' else WHITE, fl.size * 0.14)
    return y + int(fb.size * 0.95)


def crop_card(name: str) -> Image.Image:
    file, box = CROPS[name]
    return Image.open(RAW['phone'] / file).convert('RGBA').crop(box)


def render(spec, kind):
    size = SIZE[kind]
    W, H = size
    canvas = background(spec['theme'], size)
    y = masthead(canvas, spec, kind)
    if spec.get('tag'):
        y = tag_chip(canvas, spec['tag'], y, kind)
    y = headline(canvas, spec, y, kind)
    if spec.get('stat'):
        y = stat_block(canvas, spec, y + int(H * 0.01))
    else:
        y = subline(canvas, spec, y, kind)

    if spec.get('fan'):
        shots = [Image.open(RAW[kind] / f).convert('RGBA') for f in spec['fan']]
        dw = int(W * 0.56)
        top = y + int(H * 0.04)
        for shot, dx, tilt, lift in [(shots[0], -0.22, 7, 0.07), (shots[2], 0.22, -7, 0.07), (shots[1], 0.0, 0, 0.0)]:
            dev = device(shot, dw, kind)
            place(canvas, dev, (0.5 + dx, (top + dev.height / 2) / H + lift), tilt, shadow=(36, 22, 170))
    elif spec.get('device'):
        shot = Image.open(RAW[kind] / spec['device']).convert('RGBA')
        dev = device(shot, int(W * spec['device_w']), kind)
        # Devices start below the text and run off the bottom edge, like the campaign.
        cy = max(spec['device_at'][1] * H, y + int(H * 0.03) + dev.height / 2)
        place(canvas, dev, (spec['device_at'][0], cy / H), spec.get('tilt', 0))
        bezel = int(dev.width * 0.028)
        screen_scale = (dev.width - 2 * bezel) / shot.width
        screen_origin = (spec['device_at'][0] * W - dev.width / 2 + bezel, cy - dev.height / 2 + bezel)

    if spec.get('pop'):
        card = crop_card(spec['pop'])
        pw = int(W * spec['pop_w'])
        card = card.resize((pw, int(card.height * pw / card.width)), Image.LANCZOS)
        card = rounded(card, int(pw * 0.045))
        at = spec['pop_at']
        if at == 'lift':
            # Centre the enlarged card on the same card inside the phone.
            _, (x0, y0, x1, y1) = CROPS[spec['pop']]
            at = ((screen_origin[0] + (x0 + x1) / 2 * screen_scale) / W, (screen_origin[1] + (y0 + y1) / 2 * screen_scale) / H)
        place(canvas, card, at, spec.get('pop_tilt', 0), shadow=(44, 30, 190))

    return canvas.convert('RGB')


def main():
    kinds = sys.argv[1:] or ['phone', 'ipad']
    for kind in kinds:
        OUT[kind].mkdir(parents=True, exist_ok=True)
        for spec in PHONE if kind == 'phone' else IPAD:
            img = render(spec, kind)
            assert img.size == SIZE[kind]
            img.save(OUT[kind] / spec['file'], optimize=True)
            print(OUT[kind].relative_to(ROOT) / spec['file'])


if __name__ == '__main__':
    main()
