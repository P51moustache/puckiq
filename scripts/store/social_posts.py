"""
Social posts from raw captures: square (1080x1080, feed) and story (1080x1920).

  python3 scripts/store/social_posts.py <raw_iphone_dir> <out_dir>

Same F1 treatment as the App Store frames: carbon canvas, red-dot kicker, Black Italic headline.
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

POSTS = [
    ('02-tonight.png', 'TONIGHT', 'KNOW WHAT TO|FIX BEFORE LOCK.', 'Who plays, who to sit, 37 minutes to lock.'),
    ('03-lineup.png', 'BEST LINEUP', 'THE LINEUP YOUR|SLOTS ALLOW.', 'Every slot, filled by value. Not just "has a game."'),
    ('04-week.png', 'WEEK PLANNER', 'GAMES THAT|ACTUALLY COUNT.', 'See bench overflow and empty slots before they cost you.'),
    ('05-pickups.png', 'PICKUPS', 'STREAMERS FOR|YOUR EMPTY NIGHTS.', 'Ranked by what they add to YOUR lineup.'),
    ('15-matchup.png', 'MATCHUP', 'WIN THE GAMES-|PLAYED BATTLE.', 'Your games that count vs theirs, day by day.'),
    ('07-telemetry.png', 'NHL EDGE', 'SPEED & SHOTS,|RANKED.', 'Top speed, hardest shot, zone time — vs the league.'),
    ('08-share.png', 'SHARE CARDS', 'TALK TRASH IN|THE GROUP CHAT.', 'Tonight\'s lineup as a card for your league.'),
    ('28-goalie-telemetry.png', 'GOALIES', 'SAVE % BY|DANGER ZONE.', 'Know which goalie to trust tonight.'),
]


def font(path: str, size: int, style: str) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(path, size)
    f.set_variation_by_name(style)
    return f


def rounded(img: Image.Image, radius: int) -> Image.Image:
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.width, img.height), radius=radius, fill=255)
    out = img.convert('RGBA')
    out.putalpha(mask)
    return out


def device(shot: Image.Image, width: int, crop_ratio: "float | None" = None) -> Image.Image:
    """Screenshot in a thin carbon bezel; optionally cropped to show only the top part."""
    s = shot.convert('RGB')
    if crop_ratio:
        s = s.crop((0, 0, s.width, int(s.width * crop_ratio)))
    scale = width / s.width
    s = s.resize((width, int(s.height * scale)), Image.LANCZOS)
    radius = int(width * 0.085)
    bez = max(8, int(width * 0.025))
    frame = Image.new('RGBA', (s.width + bez * 2, s.height + bez * 2), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle(
        (0, 0, frame.width - 1, frame.height - 1), radius=radius + bez, fill=INK_RAISED + (255,), outline=(70, 70, 82, 255), width=3,
    )
    frame.alpha_composite(rounded(s, radius), (bez, bez))
    return frame


def kicker(d: ImageDraw.ImageDraw, x: int, y: int, text: str, size: int) -> None:
    kf = font(SF, size, 'Heavy')
    dot = int(size * 0.5)
    d.ellipse((x, y + size * 0.28, x + dot, y + size * 0.28 + dot), fill=RED)
    cx = x + dot + int(size * 0.55)
    for ch in text:
        d.text((cx, y), ch, font=kf, fill=WHITE)
        cx += d.textlength(ch, font=kf) + size * 0.16


def fit(d: ImageDraw.ImageDraw, text: str, path: str, style: str, size: int, max_width: int) -> ImageFont.FreeTypeFont:
    """Largest font <= size whose widest line (plus italic overhang) fits max_width."""
    while size > 12:
        f = font(path, size, style)
        if max(d.textlength(line, font=f) for line in text.split('|')) * 1.05 <= max_width:
            return f
        size -= 2
    return font(path, size, style)


def headline(d: ImageDraw.ImageDraw, x: int, y: int, text: str, size: int) -> int:
    hf = fit(d, text, SF_ITALIC, 'Black Italic', size, d.im.size[0] - x * 2)
    size = hf.size
    for line in text.split('|'):
        d.text((x, y), line, font=hf, fill=WHITE)
        y += int(size * 1.02)
    return y


def brand_footer(canvas: Image.Image, h: int) -> None:
    """Red strip with the call to action, like the in-app share card."""
    w = canvas.width
    d = ImageDraw.Draw(canvas)
    d.rectangle((0, canvas.height - h, w, canvas.height), fill=RED)
    tf = fit(d, 'PUCKIQ · FANTASY HOCKEY COACH', SF_ITALIC, 'Black Italic', int(h * 0.36), int(w * 0.88))
    sf = font(SF, int(h * 0.2), 'Semibold')
    d.text((int(w * 0.06), canvas.height - h + int(h * 0.16)), 'PUCKIQ · FANTASY HOCKEY COACH', font=tf, fill=WHITE)
    d.text((int(w * 0.06), canvas.height - h + int(h * 0.6)), 'Free on the App Store', font=sf, fill=(255, 255, 255, 220))


def square(shot: Image.Image, kick: str, head: str, sub: str) -> Image.Image:
    W = H = 1080
    canvas = Image.new('RGBA', (W, H), INK + (255,))
    d = ImageDraw.Draw(canvas)
    pad = 64
    kicker(d, pad, 70, kick, 30)
    y = headline(d, pad, 120, head, 78)
    sf = font(SF, 30, 'Medium')
    # wrap subline into the left column
    words, line, lines = sub.split(), '', []
    for word in words:
        trial = f'{line} {word}'.strip()
        if d.textlength(trial, font=sf) > 470:
            lines.append(line)
            line = word
        else:
            line = trial
    lines.append(line)
    for i, text in enumerate(lines):
        d.text((pad, y + 24 + i * 40), text, font=sf, fill=SUB)
    frame = device(shot, 400, crop_ratio=1.62)
    canvas.alpha_composite(frame, (W - frame.width - 50, H - frame.height - 140 + 30))
    brand_footer(canvas, 130)
    return canvas.convert('RGB')


def story(shot: Image.Image, kick: str, head: str, sub: str) -> Image.Image:
    W, H = 1080, 1920
    canvas = Image.new('RGBA', (W, H), INK + (255,))
    d = ImageDraw.Draw(canvas)
    pad = 80
    kicker(d, pad, 170, kick, 34)
    y = headline(d, pad, 230, head, 96)
    sf = font(SF, 36, 'Medium')
    d.text((pad, y + 20), sub, font=sf, fill=SUB)
    frame = device(shot, 700, crop_ratio=1.55)
    canvas.alpha_composite(frame, ((W - frame.width) // 2, y + 110))
    brand_footer(canvas, 190)
    return canvas.convert('RGB')


def main() -> None:
    raw, out = Path(sys.argv[1]), Path(sys.argv[2])
    (out / 'square').mkdir(parents=True, exist_ok=True)
    (out / 'story').mkdir(parents=True, exist_ok=True)
    for index, (name, kick, head, sub) in enumerate(POSTS, start=1):
        src = raw / name
        if not src.exists():
            print('missing', src)
            continue
        shot = Image.open(src)
        slug = name.split('-', 1)[1].replace('.png', '')
        square(shot, kick, head, sub).save(out / 'square' / f'{index:02d}-{slug}.png', optimize=True)
        story(shot, kick, head, sub).save(out / 'story' / f'{index:02d}-{slug}.png', optimize=True)
        print('wrote', slug)


if __name__ == '__main__':
    main()
