import AVFoundation
import QuartzCore

/// Puts one clip on a 1080×1920 canvas with the overlays its spec asks for, and exports H.264/AAC.
struct Compositor {
    static let canvasSize = CGSize(width: 1080, height: 1920)
    /// Where captions and subtitles sit, measured from the top. Clear of X/TikTok top and bottom chrome.
    static let overlayCaptionTop: CGFloat = 250
    static let subtitleCenterFromTop: CGFloat = 1300

    let spec: PostSpec

    func render() async throws {
        guard !spec.sources.isEmpty else { throw Failure("\(spec.output): needs \"input\" or \"clips\"") }
        let timeline = try await Timeline.build(clips: spec.sources, soundtrack: spec.audio)
        let range = CMTimeRange(start: .zero, duration: timeline.duration)

        let canvas = Canvas(size: Self.canvasSize, duration: range.duration.seconds)
        let header = spec.style == .header ? Overlays.header(caption: spec.caption ?? "", width: canvas.size.width, theme: HeaderTheme.named(spec.theme)) : nil
        let band = CGFloat(header?.height ?? 0)
        let videoRect = CGRect(x: 0, y: band, width: canvas.size.width, height: canvas.size.height - band)

        let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: timeline.video)
        let focus = spec.focus.map { CGPoint(x: $0[0], y: $0[1]) } ?? CGPoint(x: 0.5, y: 0.5)
        for segment in timeline.segments {
            layerInstruction.setTransform(Self.fill(natural: segment.natural, preferred: segment.preferred, into: videoRect,
                                                    zoom: CGFloat(spec.zoom ?? 1), focus: focus), at: segment.start)
        }
        let instruction = AVMutableVideoCompositionInstruction()
        instruction.timeRange = range
        instruction.layerInstructions = [layerInstruction]

        let parent = CALayer(), videoLayer = CALayer()
        parent.frame = CGRect(origin: .zero, size: canvas.size)
        videoLayer.frame = parent.frame
        parent.addSublayer(videoLayer)
        try overlays(canvas: canvas, header: header, video: videoRect).forEach(parent.addSublayer)

        let fps = try await timeline.video.load(.nominalFrameRate)
        let videoComposition = AVMutableVideoComposition()
        videoComposition.renderSize = canvas.size
        videoComposition.frameDuration = CMTime(value: 1, timescale: CMTimeScale(fps > 0 ? fps.rounded() : 30))
        videoComposition.instructions = [instruction]
        videoComposition.animationTool = AVVideoCompositionCoreAnimationTool(postProcessingAsVideoLayer: videoLayer, in: parent)

        guard let export = AVAssetExportSession(asset: timeline.composition, presetName: AVAssetExportPresetHighestQuality) else {
            throw Failure("cannot create export session")
        }
        export.videoComposition = videoComposition
        let output = URL(fileURLWithPath: spec.output)
        try? FileManager.default.removeItem(at: output)
        try await export.export(to: output, as: .mp4)
        if let cues = spec.subtitles, !cues.isEmpty {
            try SubtitleFile.srt(cues).write(to: output.deletingPathExtension().appendingPathExtension("srt"), atomically: true, encoding: .utf8)
        }
    }

    private func overlays(canvas: Canvas, header: CGImage?, video: CGRect) throws -> [CALayer] {
        var layers = try Hud.layers(for: spec, video: video, canvas: canvas)
        for cue in spec.burnSubtitles == true ? spec.subtitles ?? [] : [] {
            let art = Overlays.subtitle(cue.text)
            let layer = canvas.centered(art, top: Self.subtitleCenterFromTop - CGFloat(art.height) / 2)
            canvas.show(layer, from: cue.start, to: cue.end)
            layers.append(layer)
        }
        switch spec.style {
        case .header:
            layers.append(canvas.layer(header!, x: 0, top: 0))
        case .overlay:
            layers.append(canvas.centered(Overlays.overlay(caption: spec.caption ?? ""), top: Self.overlayCaptionTop))
        case .none:
            break
        }
        return layers
    }

    /// Aspect-fills the source into `rect` (top-left coordinates), magnified by `zoom` around `focus`
    /// (0–1 source coordinates), clamped so the picture always covers the rect. Overflow is hidden.
    static func fill(natural: CGSize, preferred: CGAffineTransform, into rect: CGRect,
                     zoom: CGFloat = 1, focus: CGPoint = CGPoint(x: 0.5, y: 0.5)) -> CGAffineTransform {
        let oriented = CGRect(origin: .zero, size: natural).applying(preferred).standardized.size
        let scale = max(rect.width / oriented.width, rect.height / oriented.height) * max(zoom, 1)
        let scaled = CGSize(width: oriented.width * scale, height: oriented.height * scale)
        let dx = min(max(rect.midX - focus.x * scaled.width, rect.maxX - scaled.width), rect.minX)
        let dy = min(max(rect.midY - focus.y * scaled.height, rect.maxY - scaled.height), rect.minY)
        return preferred.concatenating(CGAffineTransform(scaleX: scale, y: scale)).concatenating(CGAffineTransform(translationX: dx, y: dy))
    }
}

struct Failure: Error, CustomStringConvertible {
    let description: String
    init(_ description: String) { self.description = description }
}
