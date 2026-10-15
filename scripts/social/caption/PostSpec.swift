import Foundation

/// One social post, read from JSON: the source clip, how to dress it, and where to write it.
///
///     { "input": "marketing/videos/x/upscaled/06-breaking-news.mp4",
///       "audio": "marketing/videos/x/raw/06-breaking-news.mp4",
///       "output": "marketing/videos/x/posts/06-breaking-news.mp4",
///       "style": "none",
///       "hud": "news",
///       "news": { "station": "ACTION NEWS", "location": "MAPLE HEIGHTS", "clock": "10:14  18°",
///                 "headline": "Man benches player who then scores four goals", "ticker": "Lineups lock at 7 PM" },
///       "subtitles": [{ "start": 0.04, "end": 2.5, "text": "Neighbors say he benched a player tonight" }] }
///
/// Subtitles are always written beside the output as an .srt file (X accepts one on upload),
/// and burned into the picture only when `burnSubtitles` is true.
struct PostSpec: Decodable {
    /// Source clips in timeline order.
    var sources: [String] { clips ?? input.map { [$0] } ?? [] }

    /// `header`: caption band above the clip. `overlay`: outlined caption on the clip. `none`: no caption.
    enum Style: String, Decodable { case header, overlay, none }
    /// Format-native chrome drawn on the clip itself, so generated footage reads as the real thing.
    enum Hud: String, Decodable { case bodycam, doorbell, news }
    /// A subtitle shown from `start` to `end` seconds.
    struct Cue: Decodable { let start: Double, end: Double, text: String }
    /// Local-news graphics: station bug, LIVE location tag, breaking-news lower third and ticker.
    struct News: Decodable { let station: String, location: String, clock: String, headline: String, ticker: String }

    /// One source clip, or use `clips` to cut several together in order (e.g. 5 s Kling shots).
    let input: String?
    let clips: [String]?
    /// One soundtrack for the whole post instead of each clip's own sound: the original file behind an
    /// upscale (the upscaler shifts audio ~50 ms), or a voice-over laid across several clips.
    let audio: String?
    let output: String
    /// Digital zoom on the source (1 = none) centered on `focus`, a point in 0–1 frame coordinates
    /// from the top left. A cheap camera push-in, like a news helicopter zooming on its subject.
    let zoom: Double?
    let focus: [Double]?
    let style: Style
    /// `*phrase*` in a caption is drawn in the emphasis color.
    let caption: String?
    /// Header look: `bold` (default, white band) or `dark`; see HeaderTheme.
    let theme: String?
    let subtitles: [Cue]?
    let burnSubtitles: Bool?
    let hud: Hud?
    let news: News?
}
