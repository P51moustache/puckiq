import AVFoundation

/// Decode the supplied track, trim to the picture, and leave a clean audio tail.
let args = CommandLine.arguments
guard args.count == 5, let seconds = Double(args[3]), let start = Double(args[4]), seconds > 0, start >= 0 else {
    fatalError("prepare-music INPUT OUTPUT_WAV SECONDS START_SECONDS")
}
let sampleRate = 48_000.0
let source = try AVAudioFile(forReading: URL(fileURLWithPath: args[1]), commonFormat: .pcmFormatFloat32, interleaved: false)
guard source.processingFormat.sampleRate == sampleRate, source.processingFormat.channelCount == 2 else {
    fatalError("Input must decode as 48 kHz stereo")
}
let frames = AVAudioFrameCount((seconds * sampleRate).rounded())
source.framePosition = AVAudioFramePosition((start * sampleRate).rounded())
guard source.length - source.framePosition >= frames else { fatalError("Source is shorter than requested cut") }
let buffer = AVAudioPCMBuffer(pcmFormat: source.processingFormat, frameCapacity: frames)!
try source.read(into: buffer, frameCount: frames)
guard buffer.frameLength == frames, let channels = buffer.floatChannelData else { fatalError("Incomplete decode") }
var peak: Float = 0
for channel in 0..<2 {
    for frame in 0..<Int(frames) { peak = max(peak, abs(channels[channel][frame])) }
}
let gain = min(1, 0.89 / max(peak, 0.0001))
let fadeIn = Int(0.025 * sampleRate), fadeOut = Int(0.8 * sampleRate)
for channel in 0..<2 {
    for frame in 0..<Int(frames) {
        let attack = min(1, Float(frame) / Float(fadeIn))
        let release = min(1, Float(Int(frames) - 1 - frame) / Float(fadeOut))
        channels[channel][frame] *= gain * attack * release
    }
}
func save() throws {
    let file = try AVAudioFile(forWriting: URL(fileURLWithPath: args[2]), settings: [
        AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: sampleRate,
        AVNumberOfChannelsKey: 2, AVLinearPCMBitDepthKey: 16,
        AVLinearPCMIsFloatKey: false, AVLinearPCMIsBigEndianKey: false,
        AVLinearPCMIsNonInterleaved: false,
    ], commonFormat: .pcmFormatFloat32, interleaved: false)
    try file.write(from: buffer)
}
try save()
print("Prepared \(seconds)s from \(start)s; source peak \(peak), gain \(gain), 800ms ending fade")
