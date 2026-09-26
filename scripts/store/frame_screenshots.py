"""
App Store screenshots: raw simulator captures -> F1-style framed posters.

  python3 scripts/store/frame_screenshots.py <raw_dir> <out_dir> phone|ipad

Output sizes match App Store Connect exactly: iPhone 6.9" 1320x2868, iPad 13" 2064x2752.
Uses the macOS system font (SF Pro) in Black Italic, same face as the app's display().
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

INK = (21, 21, 30)
INK_RAISED = (36, 36, 46)
RED = (225, 6, 0)
WHITE = (255, 255, 255)
SUB = (166, 166, 176)

SF_ITALIC = '/System/Library/Fonts/SFNSItalic.ttf'
SF = '/System/Library/Fonts/SFNS.ttf'

# (file, kicker, headline) — headline lines are split on "|".
PHONE = [
    ('02-tonight.png', 'TONIGHT', 'KNOW WHAT TO|FIX BEFORE LOCK.'),
    ('03-lineup.png', 'BEST LINEUP · PRO', 'THE LINEUP YOUR|SLOTS ALLOW.'),
    ('04-week.png', 'WEEK PLANNER · PRO', 'GAMES THAT|ACTUALLY COUNT.'),
    ('05-pickups.png', 'PICKUPS', 'STREAMERS FOR|YOUR EMPTY NIGHTS.'),
    ('06-player.png', 'EVERY PLAYER', 'FORM, LOGS &|THIS WEEK.'),
    ('07-telemetry.png', 'NHL EDGE · PRO', 'SPEED & SHOTS,|RANKED.'),
    ('08-share.png', 'SHARE CARDS', 'TALK TRASH IN|THE GROUP CHAT.'),
    ('09-reminders.png', 'REMINDERS', 'NEVER MISS|LINEUP LOCK.'),
]

IPAD = [
    ('02-tonight.png', 'TONIGHT', 'KNOW WHAT TO CHANGE|BEFORE LOCK.'),
    ('04-week.png', 'WEEK PLANNER · PRO', 'SEE THE GAMES THAT|ACTUALLY COUNT.'),
    ('05-pickups.png', 'PICKUPS', 'STREAMERS FOR YOUR|EMPTY NIGHTS.'),
    ('06-player.png', 'NHL EDGE · PRO', 'SPEED, SHOTS & ZONE|TIME, RANKED.'),
]


def font(path: str, size: int, style: str) -> ImageFont.FreeTypeFont:
    """Named instance of the variable system font, e.g. 'Black Italic' or 'Heavy'."""
    f = ImageFont.truetype(path, size)
    f.set_variation_by_name(style)
    return f


def fit_headline_size(headlines: list, start: int, max_width: int) -> int:
    """Largest size (<= start) at which every line of every headline fits — one size per set."""
    size = start
    probe = ImageDraw.Draw(Image.new('RGB', (10, 10)))
    while size > 20:
        f = font(SF_ITALIC, size, 'Black Italic')
        # +6% for the italic overhang on the last glyph
        widest = max(probe.textlength(line, font=f) * 1.06 for h in headlines for line in h.split('|'))
        if widest <= max_width:
            return size
        size -= 2
    return size


def rounded(img: Image.Image, radius: int) -> Image.Image:
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.width, img.height), radius=radius, fill=255)
    out = img.convert('RGBA')
    out.putalpha(mask)
    return out


def rink_lines(draw: ImageDraw.ImageDraw, w: int, h: int, top: int) -> None:
    """Faint rink markings behind the device — the app's 'circuit map' motif."""
    line = (255, 255, 255, 16)
    cx = w // 2
    r = int(w * 0.23)
    draw.ellipse((cx - r, top - r, cx + r, top + r), outline=line, width=4)
    draw.line((0, top, w, top), fill=line, width=4)
    for dx in (-0.36, 0.36):
        x = int(cx + dx * w)
        draw.line((x, 0, x, h), fill=(225, 6, 0, 14), width=10)


def poster(raw: Path, kicker: str, headline: str, size: tuple, is_ipad: bool, head_size: int) -> Image.Image:
    w, h = size
    canvas = Image.new('RGBA', size, INK + (255,))
    overlay = Image.new('RGBA', size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)

    pad = int(w * 0.075)
    kicker_size = int(w * (0.026 if is_ipad else 0.034))
    head_top = int(h * 0.075)

    rink_lines(od, w, h, int(h * 0.62))
    canvas = Image.alpha_composite(canvas, overlay)
    d = ImageDraw.Draw(canvas)

    # Kicker: red dot + tracked caps
    kf = font(SF, kicker_size, 'Heavy')
    dot = int(kicker_size * 0.5)
    ky = head_top
    d.ellipse((pad, ky + kicker_size * 0.28, pad + dot, ky + kicker_size * 0.28 + dot), fill=RED)
    x = pad + dot + int(kicker_size * 0.55)
    for ch in kicker:
        d.text((x, ky), ch, font=kf, fill=WHITE)
        x += d.textlength(ch, font=kf) + kicker_size * 0.16

    # Headline: Black Italic, two lines
    hf = font(SF_ITALIC, head_size, 'Black Italic')
    y = ky + int(kicker_size * 1.9)
    for line in headline.split('|'):
        d.text((pad, y), line, font=hf, fill=WHITE)
        y += int(head_size * 1.02)

    # Device shot
    shot = Image.open(raw).convert('RGB')
    shot_top = y + int(h * 0.035)
    max_w = int(w * (0.80 if is_ipad else 0.80))
    scale = max_w / shot.width
    sw, sh = max_w, int(shot.height * scale)
    shot = shot.resize((sw, sh), Image.LANCZOS)
    radius = int(sw * (0.035 if is_ipad else 0.085))
    shot = rounded(shot, radius)

    # Bezel
    bez = int(w * 0.012)
    frame = Image.new('RGBA', (sw + bez * 2, sh + bez * 2), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle(
        (0, 0, frame.width - 1, frame.height - 1), radius=radius + bez, fill=INK_RAISED + (255,), outline=(70, 70, 82, 255), width=3,
    )
    frame.alpha_composite(shot, (bez, bez))

    fx = (w - frame.width) // 2
    canvas.alpha_composite(frame, (fx, shot_top))
    return canvas.convert('RGB')


def main() -> None:
    raw_dir, out_dir, kind = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
    out_dir.mkdir(parents=True, exist_ok=True)
    is_ipad = kind == 'ipad'
    size = (2064, 2752) if is_ipad else (1320, 2868)
    items = IPAD if is_ipad else PHONE
    pad = int(size[0] * 0.075)
    head_size = fit_headline_size([h for _, _, h in items], int(size[0] * (0.066 if is_ipad else 0.083)), size[0] - pad * 2)
    for index, (name, kicker, headline) in enumerate(items, start=1):
        src = raw_dir / name
        if not src.exists():
            print('missing', src)
            continue
        out = out_dir / f'{index:02d}-{name.split("-", 1)[1]}'
        poster(src, kicker, headline, size, is_ipad, head_size).save(out, 'PNG', optimize=True)
        print('wrote', out)


if __name__ == '__main__':
    main()
