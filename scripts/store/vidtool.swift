// Video helper for marketing/App Store previews (AVFoundation; no ffmpeg needed).
//
//   swiftc -O scripts/store/vidtool.swift -o /tmp/vidtool
//   vidtool info   <in.mp4>
//   vidtool frames <in.mp4> <outDir> <count>               — evenly spaced PNG stills
//   vidtool export <in.mp4> <out.mp4> <width> <height> [start] [duration]
//       Scales (aspect-fill, centered) to an exact size at 30 fps, H.264, with a silent
//       AAC track — App Store app previews must have audio and be 15–30 s.

import AVFoundation
import AppKit
import CoreImage

func fail(_ message: String) -> Never {
    FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
    exit(1)
}

func loadTrack(_ asset: AVURLAsset) async -> AVAssetTrack {
    guard let track = try? await asset.loadTracks(withMediaType: .video).first else { fail("no video track") }
    return track
}

func info(_ path: String) async {
    let asset = AVURLAsset(url: URL(fileURLWithPath: path))
    let track = await loadTrack(asset)
    let size = (try? await track.load(.naturalSize)) ?? .zero
    let duration = (try? await asset.load(.duration)) ?? .zero
    let fps = (try? await track.load(.nominalFrameRate)) ?? 0
    let audio = (try? await asset.loadTracks(withMediaType: .audio).count) ?? 0
    print(String(format: "%.0fx%.0f  %.2fs  %.1ffps  audio:%d", size.width, size.height, duration.seconds, fps, audio))
}

func frames(_ path: String, _ outDir: String, _ count: Int) async {
    let asset = AVURLAsset(url: URL(fileURLWithPath: path))
    let duration = ((try? await asset.load(.duration)) ?? .zero).seconds
    let generator = AVAssetImageGenerator(asset: asset)
    generator.appliesPreferredTrackTransform = true
    generator.requestedTimeToleranceBefore = .zero
    generator.requestedTimeToleranceAfter = .zero
    try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)
    for index in 0..<count {
        let t = duration * (Double(index) + 0.5) / Double(count)
        guard let (image, _) = try? await generator.image(at: CMTime(seconds: t, preferredTimescale: 600)) else { continue }
        let rep = NSBitmapImageRep(cgImage: image)
        let file = String(format: "%@/f%02d-%05.1fs.png", outDir, index, t)
        try? rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: file))
        print(file)
    }
}

/// Writes a silent stereo AAC file of the given length, used as the preview's audio track.
func silentAudio(seconds: Double) throws -> URL {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("silence-\(UUID().uuidString).m4a")
    let format = AVAudioFormat(standardFormatWithSampleRate: 44_100, channels: 2)!
    let file = try AVAudioFile(forWriting: url, settings: [
        AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: 44_100, AVNumberOfChannelsKey: 2,
    ])
    let frames = AVAudioFrameCount(seconds * 44_100)
    let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames)!
    buffer.frameLength = frames
    try file.write(from: buffer)
    return url
}

func export(_ input: String, _ output: String, _ width: Int, _ height: Int, _ start: Double, _ length: Double?) async {
    let asset = AVURLAsset(url: URL(fileURLWithPath: input))
    let track = await loadTrack(asset)
    let natural = (try? await track.load(.naturalSize)) ?? .zero
    let total = ((try? await asset.load(.duration)) ?? .zero).seconds
    let span = min(length ?? (total - start), total - start)
    let range = CMTimeRange(start: CMTime(seconds: start, preferredTimescale: 600), duration: CMTime(seconds: span, preferredTimescale: 600))

    let composition = AVMutableComposition()
    guard let videoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) else { fail("composition") }
    do { try videoTrack.insertTimeRange(range, of: track, at: .zero) } catch { fail("insert video: \(error)") }

    do {
        let silence = AVURLAsset(url: try silentAudio(seconds: span + 1))
        if let audio = try await silence.loadTracks(withMediaType: .audio).first,
           let audioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) {
            try audioTrack.insertTimeRange(CMTimeRange(start: .zero, duration: CMTime(seconds: span, preferredTimescale: 600)), of: audio, at: .zero)
        }
    } catch { fail("audio: \(error)") }

    let target = CGSize(width: width, height: height)
    let scale = max(target.width / natural.width, target.height / natural.height)
    let dx = (target.width - natural.width * scale) / 2
    let dy = (target.height - natural.height * scale) / 2

    let instruction = AVMutableVideoCompositionInstruction()
    instruction.timeRange = CMTimeRange(start: .zero, duration: range.duration)
    let layer = AVMutableVideoCompositionLayerInstruction(assetTrack: videoTrack)
    layer.setTransform(CGAffineTransform(scaleX: scale, y: scale).concatenating(CGAffineTransform(translationX: dx, y: dy)), at: .zero)
    instruction.layerInstructions = [layer]

    let videoComposition = AVMutableVideoComposition()
    videoComposition.renderSize = target
    videoComposition.frameDuration = CMTime(value: 1, timescale: 30)
    videoComposition.instructions = [instruction]

    try? FileManager.default.removeItem(atPath: output)
    guard let session = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else { fail("export session") }
    session.videoComposition = videoComposition
    do {
        try await session.export(to: URL(fileURLWithPath: output), as: .mp4)
    } catch { fail("export: \(error)") }
    print("wrote \(output)")
}

let args = CommandLine.arguments
guard args.count >= 3 else { fail("usage: vidtool info|frames|export ...") }
switch args[1] {
case "info": await info(args[2])
case "frames": await frames(args[2], args[3], Int(args[4]) ?? 6)
case "export":
    await export(args[2], args[3], Int(args[4])!, Int(args[5])!, args.count > 6 ? Double(args[6])! : 0, args.count > 7 ? Double(args[7]) : nil)
default: fail("unknown command \(args[1])")
}
