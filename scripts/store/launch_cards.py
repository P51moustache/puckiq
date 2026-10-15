"""Export launch cards from real app captures, using the shared campaign design helpers."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw
from social_posts import device, fit, font, kicker, SF, SF_ITALIC, INK, RED, SUB, WHITE

CARDS = [
    ('tonight', '02-tonight.png', 'YOUR LINEUP.|ONE CLEAR PLAN.',
     'Who plays. Who to sit. What to fix before lock.', 'Best lineup and all coach moves with Pro.'),
    ('week', '04-week.png', 'MORE GAMES.|LESS BENCH.',
     'Find the games that actually fit your lineup slots.', 'Week planner with PuckIQ Pro.'),
    ('pickups', '05-pickups.png', 'FIND GAMES|YOUR TEAM NEEDS.',
     'Stream for the empty nights in your own roster.', 'Top pickup free. Full ranked list with Pro.'),
]

def render(raw: Path, card: tuple, height: int) -> Image.Image:
    slug, source, headline, subtitle, pro = card
    canvas = Image.new('RGBA', (1080, height), INK + (255,))
    draw = ImageDraw.Draw(canvas)
    top = 150 if height == 1920 else 54
    kicker(draw, 64, top, 'PUCKIQ 3.0 / '+slug.upper(), 27)
    face = fit(draw, headline, SF_ITALIC, 'Black Italic', 90, 952)
    y = top + 52
    for index, line in enumerate(headline.split('|')):
        draw.text((64, y), line, font=face, fill=WHITE if index == 0 else RED)
        y += int(face.size * 1.02)
    caption = font(SF, 28, 'Medium')
    draw.text((64, y+18), subtitle, font=caption, fill=SUB)
    image = Image.open(raw/source)
    frame = device(image, 760 if height == 1920 else 630, crop_ratio=1.28 if height == 1350 else 1.62)
    frame_y = y+91
    canvas.alpha_composite(frame, ((1080-frame.width)//2, frame_y))
    footer = height-245 if height == 1920 else height-194
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, footer, 1080, height), fill=INK)
    draw.line((64, footer+12, 1016, footer+12), fill=RED, width=4)
    draw.text((64, footer+34), pro, font=font(SF, 25, 'Semibold'), fill=WHITE)
    draw.text((64, footer+77), 'SAMPLE ROSTER · ACTUAL APP CAPTURES', font=font(SF, 19, 'Semibold'), fill=SUB)
    draw.text((64, footer+119), 'PUCKIQ · FANTASY HOCKEY COACH', font=font(SF_ITALIC, 31, 'Black Italic'), fill=WHITE)
    return canvas.convert('RGB')

def main():
    root, output = Path(sys.argv[1]), Path(sys.argv[2])
    for folder, height in [('feed',1350), ('story',1920)]:
        target = output/folder; target.mkdir(parents=True, exist_ok=True)
        for card in CARDS:
            render(root/'marketing/screenshots/raw-iphone',card,height).save(target/f'{card[0]}.png',optimize=True)
    print('Exported 3 feed cards and 3 story cards')

if __name__ == '__main__':
    main()
