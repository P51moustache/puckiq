import AppKit
import CoreText

/// Caption, subtitle and label bitmaps. All sizes are canvas pixels on a 1080-wide frame.
enum Overlays {
    static let ink = NSColor(srgbRed: 0.059, green: 0.078, blue: 0.098, alpha: 1)  // X's text black
    static let red = NSColor(srgbRed: 0.882, green: 0.024, blue: 0, alpha: 1)      // PuckIQ accent
    static let muted = NSColor(srgbRed: 0.545, green: 0.596, blue: 0.647, alpha: 1) // X's secondary grey
    static let aiTag = "AI-generated"

    /// Header band: a small "AI-generated" tag, then the caption, styled by `theme`. No branding; the tag
    /// travels with reshares, since bodycam/news formats can pass as real. The top inset clears player buttons.
    static func header(caption: String, width: CGFloat, theme: HeaderTheme) -> CGImage {
        let side: CGFloat = 60, top: CGFloat = 64, gap: CGFloat = 18, bottom: CGFloat = 50
        let tag = plainLabel(aiTag, font: Typography.font(26, .medium), color: theme.tag)
        let text = Typography.styled(caption, font: theme.font, color: theme.text, emphasis: theme.emphasis, kern: theme.kern)
        let block = TextBlock(text, font: theme.font, maxWidth: width - side * 2, spacing: theme.spacing)
        let height = top + CGFloat(tag.height) + gap + block.height + bottom
        let context = Typography.bitmap(CGSize(width: width, height: height))
        context.setFillColor(theme.background.cgColor)
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        context.draw(tag, in: CGRect(x: width - side - CGFloat(tag.width), y: height - top - CGFloat(tag.height),
                                     width: CGFloat(tag.width), height: CGFloat(tag.height)))
        let textTop = top + CGFloat(tag.height) + gap
        block.draw(in: context, frames: block.lineFrames(left: side, top: textTop, boxWidth: block.width, align: .left, contextHeight: height))
        return context.makeImage()!
    }

    /// Caption drawn on the footage itself: heavy white capitals with a black outline, `*emphasis*` in red.
    static func overlay(caption: String) -> CGImage {
        outlined(caption, font: Typography.font(72, .black), emphasis: red, uppercase: true, outline: 14)
    }

    /// Bold white subtitle with a heavy black outline, readable on any footage with the sound off.
    static func subtitle(_ text: String) -> CGImage {
        outlined(text, font: Typography.font(66, .heavy), emphasis: nil, uppercase: false, outline: 12)
    }

    /// Centered white text with a round-joined black outline drawn behind it.
    static func outlined(_ text: String, font: NSFont, emphasis: NSColor?, uppercase: Bool, outline: CGFloat) -> CGImage {
        let pad = outline + 6, maxWidth: CGFloat = 920
        // CoreText strokes in the run's foreground color, so the outline pass is an all-black copy of the same layout.
        let fill = TextBlock(Typography.styled(text, font: font, color: .white, emphasis: emphasis, uppercase: uppercase),
                             font: font, maxWidth: maxWidth, spacing: 1.06)
        let stroke = TextBlock(Typography.styled(text, font: font, color: .black, uppercase: uppercase),
                               font: font, maxWidth: maxWidth, spacing: 1.06)
        let size = CGSize(width: fill.width + pad * 2, height: fill.height + pad * 2)
        let context = Typography.bitmap(size)
        let frames = fill.lineFrames(left: pad, top: pad, boxWidth: fill.width, align: .center, contextHeight: size.height)
        context.setLineJoin(.round)
        context.setLineWidth(outline)
        context.setTextDrawingMode(.stroke)
        stroke.draw(in: context, frames: frames)
        context.setTextDrawingMode(.fill)
        fill.draw(in: context, frames: frames)
        return context.makeImage()!
    }

    /// Single-line label with no effects, tightly cropped.
    static func plainLabel(_ text: String, font: NSFont, color: NSColor) -> CGImage {
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: [.font: font, .foregroundColor: color]))
        var ascent: CGFloat = 0, descent: CGFloat = 0
        let width = CGFloat(CTLineGetTypographicBounds(line, &ascent, &descent, nil))
        let context = Typography.bitmap(CGSize(width: ceil(width), height: ceil(ascent + descent)))
        context.textPosition = CGPoint(x: 0, y: descent)
        CTLineDraw(line, context)
        return context.makeImage()!
    }

    /// Single-line label with a soft shadow, for found-footage chrome.
    static func label(_ text: String, font: NSFont, color: NSColor = .white, dot: NSColor? = nil) -> CGImage {
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: [.font: font, .foregroundColor: color]))
        var ascent: CGFloat = 0, descent: CGFloat = 0
        let textWidth = CGFloat(CTLineGetTypographicBounds(line, &ascent, &descent, nil))
        let margin: CGFloat = 12, dotSize = dot == nil ? 0 : ascent * 0.62, dotGap = dot == nil ? 0 : ascent * 0.4
        let canvas = CGSize(width: ceil(dotSize + dotGap + textWidth + margin * 2), height: ceil(ascent + descent + margin * 2))
        let context = Typography.bitmap(canvas)
        context.setShadow(offset: CGSize(width: 0, height: -1), blur: 6, color: NSColor.black.withAlphaComponent(0.75).cgColor)
        if let dot {
            context.setFillColor(dot.cgColor)
            context.fillEllipse(in: CGRect(x: margin, y: margin + descent + (ascent - dotSize) / 2, width: dotSize, height: dotSize))
        }
        context.textPosition = CGPoint(x: margin + dotSize + dotGap, y: margin + descent)
        CTLineDraw(line, context)
        return context.makeImage()!
    }
}
