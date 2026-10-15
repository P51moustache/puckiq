import AppKit
import AVFoundation
import CoreText
import ImageIO

struct PreviewClip: Decodable {
    let file: String, from: Double, duration: Double, title: String, accent: String, label: String
    let speed: Double?
}
struct PreviewPlan: Decodable {
    let width: Int, height: Int, fps: Int, clips: [PreviewClip]
    var duration: Double { clips.reduce(0) { $0 + $1.duration } }
}

/// Real captured UI remains proportional and readable; titles explain each feature.
final class PreviewRenderer {
    let plan: PreviewPlan
    let root: URL
    private var generators: [String: AVAssetImageGenerator] = [:]
    private let paper = NSColor(calibratedRed: 0.95, green: 0.94, blue: 0.92, alpha: 1)
    private let ink = NSColor(calibratedRed: 0.082, green: 0.082, blue: 0.118, alpha: 1)
    private let red = NSColor(calibratedRed: 0.882, green: 0.024, blue: 0, alpha: 1)

    init(plan: PreviewPlan, root: URL) { self.plan = plan; self.root = root }

    private func capturedFrame(clip: PreviewClip, localTime: Double) async throws -> CGImage {
        let generator: AVAssetImageGenerator
        if let cached = generators[clip.file] { generator = cached }
        else {
            generator = AVAssetImageGenerator(asset: AVURLAsset(url: root.appendingPathComponent(clip.file)))
            generator.appliesPreferredTrackTransform = true
            generator.requestedTimeToleranceBefore = CMTime(seconds: 1 / 30, preferredTimescale: 600)
            generator.requestedTimeToleranceAfter = CMTime(seconds: 1 / 30, preferredTimescale: 600)
            generators[clip.file] = generator
        }
        return try await generator.image(at: CMTime(seconds: clip.from + localTime * (clip.speed ?? 1), preferredTimescale: 600)).image
    }

    private func label(_ text: String, context: CGContext, x: CGFloat, y: CGFloat, size: CGFloat, color: NSColor, italic: Bool = false) {
        var point = size
        var line: CTLine!
        var ascent: CGFloat = 0
        repeat {
            let base = NSFont.systemFont(ofSize: point, weight: .black)
            let font = italic ? NSFontManager.shared.convert(base, toHaveTrait: .italicFontMask) : base
            line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: [.font: font, .foregroundColor: color]))
            let width = CTLineGetTypographicBounds(line, &ascent, nil, nil)
            if width < Double(plan.width) - Double(x) * 2 || point < 12 { break }
            point -= 1
        } while true
        context.saveGState()
        context.translateBy(x: x, y: y + ascent)
        context.scaleBy(x: 1, y: -1)
        context.textMatrix = .identity
        context.textPosition = .zero
        CTLineDraw(line, context)
        context.restoreGState()
    }

    private func draw(_ image: CGImage, clip: PreviewClip, at time: Double, context: CGContext) {
        let w = CGFloat(plan.width), h = CGFloat(plan.height)
        context.setFillColor(ink.cgColor)
        context.fill(CGRect(x: 0, y: 0, width: w, height: h))
        context.setFillColor(red.cgColor)
        context.fill(CGRect(x: 36, y: 42, width: 12, height: 12))
        label("PUCKIQ", context: context, x: 60, y: 34, size: 24, color: paper, italic: true)
        label(clip.title, context: context, x: 36, y: 92, size: 54, color: paper, italic: true)
        label(clip.accent, context: context, x: 36, y: 154, size: 54, color: red, italic: true)
        label(clip.label, context: context, x: 36, y: 232, size: 19, color: paper)
        // Preserve every UI pixel and both navigation bars. No fabricated screens.
        let available = CGRect(x: 0, y: 286, width: w, height: h - 372)
        let scale = min(available.width / CGFloat(image.width), available.height / CGFloat(image.height))
        let size = CGSize(width: CGFloat(image.width) * scale, height: CGFloat(image.height) * scale)
        let rect = CGRect(x: (w - size.width) / 2, y: available.minY, width: size.width, height: size.height)
        context.saveGState()
        context.translateBy(x: rect.minX, y: rect.maxY)
        context.scaleBy(x: 1, y: -1)
        context.interpolationQuality = .high
        context.draw(image, in: CGRect(origin: .zero, size: size))
        context.restoreGState()
        label("SAMPLE ROSTER · PRO FEATURES SHOWN", context: context, x: 36, y: h - 59, size: 18, color: paper)
        context.setFillColor(red.cgColor)
        context.fill(CGRect(x: 0, y: h - 6, width: w * min(1, time / plan.duration), height: 6))
    }

    func render(to output: URL, poster: URL) async throws {
        try? FileManager.default.removeItem(at: output)
        let writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: plan.width, AVVideoHeightKey: plan.height,
            AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 11_000_000,
                AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
                AVVideoExpectedSourceFrameRateKey: plan.fps, AVVideoMaxKeyFrameIntervalKey: plan.fps],
        ])
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
            kCVPixelBufferWidthKey as String: plan.width, kCVPixelBufferHeightKey as String: plan.height,
        ])
        writer.add(input); writer.startWriting(); writer.startSession(atSourceTime: .zero)
        var at = 0.0
        for clip in plan.clips {
            for frame in 0..<Int((clip.duration * Double(plan.fps)).rounded()) {
                let local = Double(frame) / Double(plan.fps), time = at + local
                let image = try await capturedFrame(clip: clip, localTime: local)
                while !input.isReadyForMoreMediaData { try await Task.sleep(nanoseconds: 2_000_000) }
                try autoreleasepool {
                    var buffer: CVPixelBuffer?
                    CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &buffer)
                    guard let buffer else { throw NSError(domain: "Preview", code: 1) }
                    CVPixelBufferLockBaseAddress(buffer, [])
                    let context = CGContext(data: CVPixelBufferGetBaseAddress(buffer), width: plan.width, height: plan.height,
                        bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
                        space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
                    context.translateBy(x: 0, y: CGFloat(plan.height)); context.scaleBy(x: 1, y: -1)
                    draw(image, clip: clip, at: time, context: context)
                    if abs(time - 5) < 0.01 {
                        let destination = CGImageDestinationCreateWithURL(poster as CFURL, "public.png" as CFString, 1, nil)!
                        CGImageDestinationAddImage(destination, context.makeImage()!, nil)
                        CGImageDestinationFinalize(destination)
                    }
                    CVPixelBufferUnlockBaseAddress(buffer, [])
                    guard adaptor.append(buffer, withPresentationTime: CMTime(seconds: time, preferredTimescale: 30_000)) else {
                        throw writer.error ?? NSError(domain: "Preview", code: 2)
                    }
                }
            }
            at += clip.duration
            print("Rendered \(at)s / \(plan.duration)s")
        }
        input.markAsFinished(); await writer.finishWriting()
        if let error = writer.error { throw error }
    }
}

let args = CommandLine.arguments
guard args.count == 5 else { fatalError("preview-render ROOT PLAN OUTPUT POSTER") }
let plan = try JSONDecoder().decode(PreviewPlan.self, from: Data(contentsOf: URL(fileURLWithPath: args[2])))
try await PreviewRenderer(plan: plan, root: URL(fileURLWithPath: args[1])).render(to: URL(fileURLWithPath: args[3]), poster: URL(fileURLWithPath: args[4]))
