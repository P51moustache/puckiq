import AppKit
import CoreText

/// Fonts, bitmaps and balanced multi-line text shared by every overlay.
enum Typography {
    static func font(_ size: CGFloat, _ weight: NSFont.Weight, italic: Bool = false) -> NSFont {
        let base = NSFont.systemFont(ofSize: size, weight: weight)
        return italic ? NSFontManager.shared.convert(base, toHaveTrait: .italicFontMask) : base
    }

    static func mono(_ size: CGFloat, _ weight: NSFont.Weight = .medium) -> NSFont {
        NSFont.monospacedSystemFont(ofSize: size, weight: weight)
    }

    /// Transparent sRGB bitmap with a bottom-left origin.
    static func bitmap(_ size: CGSize) -> CGContext {
        CGContext(data: nil, width: Int(ceil(size.width)), height: Int(ceil(size.height)), bitsPerComponent: 8, bytesPerRow: 0,
                  space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    }

    static func lines(_ text: NSAttributedString, width: CGFloat) -> [CTLine] {
        let setter = CTFramesetterCreateWithAttributedString(text)
        let path = CGPath(rect: CGRect(x: 0, y: 0, width: width, height: 100_000), transform: nil)
        return CTFrameGetLines(CTFramesetterCreateFrame(setter, CFRange(), path, nil)) as! [CTLine]
    }

    /// Wraps at `maxWidth`, then narrows the width as far as it can without adding a line, so no line is left with one word.
    static func balancedLines(_ text: NSAttributedString, maxWidth: CGFloat) -> [CTLine] {
        let greedy = lines(text, width: maxWidth)
        guard greedy.count > 1 else { return greedy }
        var low = maxWidth / CGFloat(greedy.count), high = maxWidth
        for _ in 0..<18 {
            let mid = (low + high) / 2
            if lines(text, width: mid).count > greedy.count { low = mid } else { high = mid }
        }
        return lines(text, width: high)
    }

    /// Builds caption text where `*phrase*` is tinted with `emphasis`; the asterisks are dropped.
    static func styled(_ text: String, font: NSFont, color: NSColor, emphasis: NSColor? = nil,
                       uppercase: Bool = false, kern: CGFloat = 0) -> NSAttributedString {
        let result = NSMutableAttributedString()
        for (index, part) in text.components(separatedBy: "*").enumerated() {
            let tint = index % 2 == 1 ? (emphasis ?? color) : color
            result.append(NSAttributedString(string: uppercase ? part.uppercased() : part,
                                             attributes: [.font: font, .foregroundColor: tint, .kern: kern]))
        }
        return result
    }

    /// Visible width, ignoring trailing spaces.
    static func width(_ line: CTLine) -> CGFloat {
        CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil) - CTLineGetTrailingWhitespaceWidth(line))
    }
}

/// A wrapped, balanced paragraph that knows its size and draws its own lines.
struct TextBlock {
    enum Align { case left, center }

    let lines: [CTLine]
    let ascent: CGFloat
    let descent: CGFloat
    let lineHeight: CGFloat

    init(_ text: NSAttributedString, font: NSFont, maxWidth: CGFloat, spacing: CGFloat = 1.1) {
        lines = Typography.balancedLines(text, maxWidth: maxWidth)
        ascent = font.ascender
        descent = -font.descender
        lineHeight = font.pointSize * spacing
    }

    init(_ text: String, font: NSFont, color: NSColor, maxWidth: CGFloat, spacing: CGFloat = 1.1, kern: CGFloat = 0) {
        self.init(Typography.styled(text, font: font, color: color, kern: kern), font: font, maxWidth: maxWidth, spacing: spacing)
    }

    var width: CGFloat { ceil(lines.map(Typography.width).max() ?? 0) }
    var height: CGFloat { ceil(ascent + descent + lineHeight * CGFloat(max(lines.count - 1, 0))) }

    /// Rect each line occupies inside a box of `boxWidth`, top-down, in bottom-left coordinates of a context `contextHeight` tall.
    func lineFrames(left: CGFloat, top: CGFloat, boxWidth: CGFloat, align: Align, contextHeight: CGFloat) -> [CGRect] {
        lines.enumerated().map { index, line in
            let width = Typography.width(line)
            let x = align == .left ? left : left + (boxWidth - width) / 2
            let baseline = contextHeight - top - ascent - lineHeight * CGFloat(index)
            return CGRect(x: x, y: baseline - descent, width: width, height: ascent + descent)
        }
    }

    func draw(in context: CGContext, frames: [CGRect]) {
        for (line, frame) in zip(lines, frames) {
            context.textPosition = CGPoint(x: frame.minX, y: frame.minY + descent)
            CTLineDraw(line, context)
        }
    }
}
