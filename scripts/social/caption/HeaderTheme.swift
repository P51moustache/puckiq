import AppKit

/// Look of the header band. Add a theme by adding a static value and a case in `named(_:)`.
/// Captions may mark a phrase as `*emphasis*`; it is drawn in the theme's emphasis color.
struct HeaderTheme {
    let background: NSColor
    let text: NSColor
    let emphasis: NSColor
    let tag: NSColor
    let font: NSFont
    let kern: CGFloat
    let spacing: CGFloat

    /// Meme-page white band with heavy black text. The default.
    static let bold = HeaderTheme(background: .white, text: Overlays.ink, emphasis: Overlays.red, tag: Overlays.muted,
                                  font: Typography.font(66, .heavy), kern: -0.6, spacing: 1.1)
    /// Near-black band with heavy white text.
    static let dark = HeaderTheme(background: NSColor(srgbRed: 0.082, green: 0.082, blue: 0.118, alpha: 1), text: .white,
                                  emphasis: Overlays.red, tag: NSColor(white: 0.62, alpha: 1),
                                  font: Typography.font(66, .heavy), kern: -0.6, spacing: 1.1)

    static func named(_ name: String?) -> HeaderTheme {
        name == "dark" ? dark : bold
    }
}
