import AppKit
import QuartzCore

/// Format-native chrome (bodycam, doorbell cam, local news) that makes a generated clip read as real footage.
/// Text is drawn here rather than by the video model, which garbles on-screen text.
enum Hud {
    /// Fictional clock start for each format, in seconds since midnight.
    static let bodycamStart = 23 * 3600 + 41 * 60 + 7     // 11:41:07 PM traffic stop
    static let doorbellStart = 2 * 3600 + 14 * 60 + 33    // 2:14:33 AM
    /// Top text clears X's fullscreen buttons; bottom text clears its progress bar.
    static let top: CGFloat = 70, side: CGFloat = 32, bottom: CGFloat = 290
    /// Bodycam REC indicator blink period, seconds.
    static let recBlink = 1.0

    static func layers(for spec: PostSpec, video: CGRect, canvas: Canvas) throws -> [CALayer] {
        switch spec.hud {
        case nil: return []
        case .bodycam: return bodycam(video: video, canvas: canvas)
        case .doorbell: return doorbell(video: video, canvas: canvas)
        case .news:
            guard let news = spec.news else { throw Failure("hud \"news\" needs a \"news\" block in \(spec.output)") }
            return NewsHud.layers(news, video: video, canvas: canvas)
        }
    }

    /// Body-worn camera readout: ISO timestamp with zone offset and device ID top right, blinking REC top left.
    static func bodycam(video: CGRect, canvas: Canvas) -> [CALayer] {
        let mono = Typography.mono(30, .semibold)
        let rec = Overlays.label("REC", font: mono, dot: .systemRed)
        let device = Overlays.label("BODY CAM 4   X81A2207", font: Typography.mono(26))
        let clocks = ticks(canvas) { Overlays.label("2026-10-14 T" + timeOfDay(bodycamStart + $0, twelveHour: false) + " -0500", font: mono) }
        let clock = canvas.layer(clocks[0], x: video.maxX - side - CGFloat(clocks[0].width), top: video.minY + top)
        canvas.tick(clock, frames: clocks)
        let recLayer = canvas.layer(rec, x: video.minX + side, top: video.minY + top)
        canvas.blink(recLayer, period: recBlink)
        return [recLayer, clock,
                canvas.layer(device, x: video.maxX - side - CGFloat(device.width), top: video.minY + top + CGFloat(clocks[0].height) - 14)]
    }

    /// Video-doorbell live view: camera name and LIVE on top, date and time bottom left.
    static func doorbell(video: CGRect, canvas: Canvas) -> [CALayer] {
        let name = Overlays.label("Front Door", font: Typography.font(34, .semibold))
        let live = Overlays.label("LIVE", font: Typography.font(26, .bold), dot: .systemRed)
        let clocks = ticks(canvas) { Overlays.label("Oct 14   " + timeOfDay(doorbellStart + $0, twelveHour: true), font: Typography.font(30, .medium)) }
        let clock = canvas.layer(clocks[0], x: video.minX + side, top: video.maxY - bottom - CGFloat(clocks[0].height))
        canvas.tick(clock, frames: clocks)
        return [canvas.layer(name, x: video.minX + side, top: video.minY + top),
                canvas.layer(live, x: video.maxX - side - CGFloat(live.width), top: video.minY + top + 4),
                clock]
    }

    /// One image per second of the clip, for a ticking clock.
    static func ticks(_ canvas: Canvas, _ frame: (Int) -> CGImage) -> [CGImage] {
        (0..<Int(ceil(canvas.duration))).map(frame)
    }

    static func timeOfDay(_ total: Int, twelveHour: Bool) -> String {
        let h = (total / 3600) % 24, m = (total / 60) % 60, s = total % 60
        guard twelveHour else { return String(format: "%02d:%02d:%02d", h, m, s) }
        return String(format: "%d:%02d:%02d %@", h % 12 == 0 ? 12 : h % 12, m, s, h < 12 ? "AM" : "PM")
    }
}
