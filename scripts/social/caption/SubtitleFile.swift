import Foundation

/// SubRip (.srt) text for a post's subtitle cues, for platforms that take a caption file on upload.
enum SubtitleFile {
    static func srt(_ cues: [PostSpec.Cue]) -> String {
        cues.enumerated().map { index, cue in
            "\(index + 1)\n\(timestamp(cue.start)) --> \(timestamp(cue.end))\n\(cue.text)\n"
        }.joined(separator: "\n")
    }

    /// `HH:MM:SS,mmm`
    static func timestamp(_ seconds: Double) -> String {
        let millis = Int((seconds * 1000).rounded())
        return String(format: "%02d:%02d:%02d,%03d", millis / 3_600_000, millis / 60_000 % 60, millis / 1000 % 60, millis % 1000)
    }
}
