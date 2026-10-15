import AVFoundation

/// The clips a post is cut from, joined end to end with hard cuts on one video track. Each clip keeps
/// its own sound unless a single soundtrack is laid over the whole timeline.
struct Timeline {
    /// Where one source clip starts on the timeline and how to orient it.
    struct Segment { let start: CMTime; let natural: CGSize; let preferred: CGAffineTransform }

    let composition: AVMutableComposition
    let video: AVMutableCompositionTrack
    let segments: [Segment]
    var duration: CMTime { composition.duration }

    static func build(clips: [String], soundtrack: String?) async throws -> Timeline {
        let composition = AVMutableComposition()
        let video = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
        let audio = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
        var cursor = CMTime.zero
        var segments: [Segment] = []
        for path in clips {
            let asset = AVURLAsset(url: URL(fileURLWithPath: path))
            guard let source = try await asset.loadTracks(withMediaType: .video).first else { throw Failure("no video track in \(path)") }
            let range = CMTimeRange(start: .zero, duration: try await source.load(.timeRange).end)
            try video.insertTimeRange(range, of: source, at: cursor)
            if soundtrack == nil, let sound = try await asset.loadTracks(withMediaType: .audio).first {
                try audio.insertTimeRange(CMTimeRangeGetIntersection(range, otherRange: try await sound.load(.timeRange)), of: sound, at: cursor)
            }
            segments.append(Segment(start: cursor, natural: try await source.load(.naturalSize), preferred: try await source.load(.preferredTransform)))
            cursor = cursor + range.duration
        }
        if let soundtrack {
            let asset = AVURLAsset(url: URL(fileURLWithPath: soundtrack))
            if let sound = try await asset.loadTracks(withMediaType: .audio).first {
                let span = CMTimeRange(start: .zero, duration: cursor)
                try audio.insertTimeRange(CMTimeRangeGetIntersection(span, otherRange: try await sound.load(.timeRange)), of: sound, at: .zero)
            }
        }
        if audio.segments.isEmpty { composition.removeTrack(audio) }
        return Timeline(composition: composition, video: video, segments: segments)
    }
}
