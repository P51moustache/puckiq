import AppKit
import QuartzCore

/// US local-news graphics for a vertical frame: LIVE location tag, station bug with time and
/// temperature, and a breaking-news lower third that slides in over a scrolling ticker.
enum NewsHud {
    static let red = NSColor(srgbRed: 0.80, green: 0.04, blue: 0.09, alpha: 1)
    static let navy = NSColor(srgbRed: 0.04, green: 0.10, blue: 0.21, alpha: 1)
    static let slate = NSColor(srgbRed: 0.12, green: 0.23, blue: 0.40, alpha: 1)
    /// Keeps the lower third above X's progress bar and buttons.
    static let bottomInset: CGFloat = 290
    static let tickerHeight: CGFloat = 62
    /// Ticker scroll speed in pixels per second, about a broadcast crawl.
    static let tickerSpeed: CGFloat = 150
    /// When the lower third animates in, as on air a beat after the shot opens.
    static let lowerThirdIn = 0.5
    static let topInset: CGFloat = 90, side: CGFloat = 36

    static func layers(_ news: PostSpec.News, video: CGRect, canvas: Canvas) -> [CALayer] {
        var layers: [CALayer] = []

        // Top left: LIVE + location.
        let live = box("LIVE", font: Typography.font(30, .heavy), fill: red, padX: 18, height: 50)
        let place = box(news.location.uppercased(), font: Typography.font(28, .semibold), fill: navy.withAlphaComponent(0.85), padX: 18, height: 50)
        layers.append(canvas.layer(live, x: video.minX + side, top: video.minY + topInset))
        layers.append(canvas.layer(place, x: video.minX + side + CGFloat(live.width), top: video.minY + topInset))

        // Top right: station bug, then time and temperature.
        let station = Overlays.label(news.station.uppercased(), font: Typography.font(38, .black, italic: true))
        let clock = Overlays.label(news.clock, font: Typography.font(28, .semibold))
        layers.append(canvas.layer(station, x: video.maxX - side - CGFloat(station.width), top: video.minY + topInset - 12))
        layers.append(canvas.layer(clock, x: video.maxX - side - CGFloat(clock.width), top: video.minY + topInset + CGFloat(station.height) - 22))

        // Lower third, built upward from the ticker.
        let tickerTop = canvas.size.height - bottomInset - tickerHeight
        layers += ticker(news.ticker, top: tickerTop, width: video.width, canvas: canvas)
        let headline = headlineBar(news.headline, width: video.width)
        let headlineTop = tickerTop - CGFloat(headline.height)
        let tag = box("BREAKING NEWS", font: Typography.font(34, .black, italic: true), fill: red, padX: 26, height: 58)
        for (image, top) in [(headline, headlineTop), (tag, headlineTop - CGFloat(tag.height))] {
            let layer = canvas.layer(image, x: video.minX, top: top)
            canvas.slideIn(layer, by: CGFloat(image.width), at: lowerThirdIn)
            layers.append(layer)
        }
        return layers
    }

    /// White bar with a red edge stripe and the headline in heavy navy capitals, up to two lines.
    static func headlineBar(_ text: String, width: CGFloat) -> CGImage {
        let stripe: CGFloat = 14, padX: CGFloat = 30, padY: CGFloat = 20
        let font = Typography.font(46, .heavy)
        let block = TextBlock(Typography.styled(text, font: font, color: navy, uppercase: true, kern: -0.3),
                              font: font, maxWidth: width - stripe - padX * 2, spacing: 1.08)
        let size = CGSize(width: width, height: block.height + padY * 2)
        let context = Typography.bitmap(size)
        context.setFillColor(NSColor.white.cgColor)
        context.fill(CGRect(origin: .zero, size: size))
        context.setFillColor(red.cgColor)
        context.fill(CGRect(x: 0, y: 0, width: stripe, height: size.height))
        block.draw(in: context, frames: block.lineFrames(left: stripe + padX, top: padY, boxWidth: block.width, align: .left, contextHeight: size.height))
        return context.makeImage()!
    }

    /// Navy crawl with a "LATEST" label; the text loops seamlessly.
    static func ticker(_ text: String, top: CGFloat, width: CGFloat, canvas: Canvas) -> [CALayer] {
        let label = box("LATEST", font: Typography.font(26, .heavy), fill: slate, padX: 20, height: tickerHeight)
        let item = Overlays.plainLabel(text.uppercased() + "   •   ", font: Typography.font(28, .semibold), color: .white)
        let strip = Typography.bitmap(CGSize(width: CGFloat(item.width) * 3, height: tickerHeight))
        for index in 0..<3 {
            strip.draw(item, in: CGRect(x: CGFloat(item.width * index), y: (tickerHeight - CGFloat(item.height)) / 2,
                                        width: CGFloat(item.width), height: CGFloat(item.height)))
        }
        let crawl = CALayer()
        crawl.backgroundColor = navy.cgColor
        crawl.masksToBounds = true
        let labelWidth = CGFloat(label.width)
        crawl.frame = CGRect(x: labelWidth, y: canvas.size.height - top - tickerHeight, width: width - labelWidth, height: tickerHeight)
        let moving = CALayer()
        moving.contents = strip.makeImage()!
        moving.frame = CGRect(x: 16, y: 0, width: CGFloat(item.width) * 3, height: tickerHeight)
        crawl.addSublayer(moving)
        canvas.scroll(moving, distance: CGFloat(item.width), speed: tickerSpeed)
        return [crawl, canvas.layer(label, x: 0, top: top)]
    }

    /// Solid box with white text centered vertically.
    static func box(_ text: String, font: NSFont, fill: NSColor, padX: CGFloat, height: CGFloat) -> CGImage {
        let label = Overlays.plainLabel(text, font: font, color: .white)
        let size = CGSize(width: CGFloat(label.width) + padX * 2, height: height)
        let context = Typography.bitmap(size)
        context.setFillColor(fill.cgColor)
        context.fill(CGRect(origin: .zero, size: size))
        context.draw(label, in: CGRect(x: padX, y: (height - CGFloat(label.height)) / 2, width: CGFloat(label.width), height: CGFloat(label.height)))
        return context.makeImage()!
    }
}
