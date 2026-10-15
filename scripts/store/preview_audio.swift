import AVFoundation

// Preserve H.264 pixels; encode the replacement music once as stereo AAC 256 kbps.
let args = CommandLine.arguments
if args.count != 4 { fatalError("preview-audio PICTURE AUDIO_OR_silence OUTPUT") }
let picture = AVURLAsset(url: URL(fileURLWithPath: args[1]))
let duration = try await picture.load(.duration)
let range = CMTimeRange(start: .zero, duration: duration)
let audioURL = FileManager.default.temporaryDirectory.appendingPathComponent("puckiq-preview-\(UUID().uuidString).m4a")
func writeMusic() throws {
    let format = AVAudioFormat(standardFormatWithSampleRate: 48_000, channels: 2)!
    let audioFile = try AVAudioFile(forWriting: audioURL, settings: [
        AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: 48_000,
        AVNumberOfChannelsKey: 2, AVEncoderBitRateKey: 256_000,
    ])
    let frames = AVAudioFrameCount(ceil(duration.seconds * 48_000))
    let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames)!
    buffer.frameLength = frames
    if args[2] != "silence" {
        let source = try AVAudioFile(forReading: URL(fileURLWithPath: args[2]), commonFormat: .pcmFormatFloat32, interleaved: false)
        guard source.processingFormat.sampleRate == 48_000, source.processingFormat.channelCount == 2 else {
            fatalError("Music must be 48 kHz stereo WAV; convert before muxing")
        }
        try source.read(into: buffer, frameCount: min(frames, AVAudioFrameCount(source.length)))
        buffer.frameLength = frames
    }
    try audioFile.write(from: buffer)
}
try writeMusic()
let music = AVURLAsset(url: audioURL)
let composition = AVMutableComposition()
for (asset, type) in [(picture, AVMediaType.video), (music, AVMediaType.audio)] {
    let source = try await asset.loadTracks(withMediaType: type).first!
    let track = composition.addMutableTrack(withMediaType: type, preferredTrackID: kCMPersistentTrackID_Invalid)!
    try track.insertTimeRange(range, of: source, at: .zero)
}
let output = URL(fileURLWithPath: args[3])
try? FileManager.default.removeItem(at: output)
let exporter = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough)!
exporter.shouldOptimizeForNetworkUse = true
try await exporter.export(to: output, as: .mp4)
try? FileManager.default.removeItem(at: audioURL)
print("Finished \(output.path)")
