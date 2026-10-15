import AVFoundation
import QuartzCore

/// Places bitmaps on the canvas and times them. Callers think in top-left coordinates;
/// Core Animation inside an AVVideoComposition uses a bottom-left origin, so this converts.
struct Canvas {
    let size: CGSize
    let duration: Double

    func layer(_ image: CGImage, x: CGFloat, top: CGFloat, opacity: Float = 1) -> CALayer {
        let layer = CALayer()
        layer.contents = image
        layer.opacity = opacity
        layer.frame = CGRect(x: x, y: size.height - top - CGFloat(image.height), width: CGFloat(image.width), height: CGFloat(image.height))
        return layer
    }

    func centered(_ image: CGImage, top: CGFloat) -> CALayer {
        layer(image, x: (size.width - CGFloat(image.width)) / 2, top: top)
    }

    /// Hides the layer except between `start` and `end` seconds.
    func show(_ layer: CALayer, from start: Double, to end: Double) {
        layer.opacity = 0
        let animation = CAKeyframeAnimation(keyPath: "opacity")
        animation.values = [0, 1, 0]
        animation.keyTimes = [0, start, end, duration].map { NSNumber(value: min(max($0 / duration, 0), 1)) }
        animation.calculationMode = .discrete
        add(animation, to: layer, key: "visible")
    }

    /// Swaps the layer's image once per second, e.g. a ticking clock.
    func tick(_ layer: CALayer, frames: [CGImage]) {
        let animation = CAKeyframeAnimation(keyPath: "contents")
        animation.values = frames
        animation.keyTimes = (0...frames.count).map { NSNumber(value: min(Double($0) / duration, 1)) }
        animation.calculationMode = .discrete
        add(animation, to: layer, key: "tick")
    }

    /// Slides the layer in from `distance` pixels to its left, starting at `start` seconds; hidden offscreen until then.
    func slideIn(_ layer: CALayer, by distance: CGFloat, at start: Double, over seconds: Double = 0.35) {
        let animation = CABasicAnimation(keyPath: "position.x")
        animation.fromValue = layer.position.x - distance
        animation.toValue = layer.position.x
        animation.beginTime = start > 0 ? start : AVCoreAnimationBeginTimeAtZero
        animation.duration = seconds
        animation.timingFunction = CAMediaTimingFunction(name: .easeOut)
        animation.fillMode = .both
        animation.isRemovedOnCompletion = false
        layer.add(animation, forKey: "slide")
    }

    /// Moves the layer left by `distance` at `speed` pixels per second, looping for the whole clip.
    func scroll(_ layer: CALayer, distance: CGFloat, speed: CGFloat) {
        let animation = CABasicAnimation(keyPath: "position.x")
        animation.fromValue = layer.position.x
        animation.toValue = layer.position.x - distance
        animation.duration = Double(distance / speed)
        animation.repeatCount = .infinity
        animation.beginTime = AVCoreAnimationBeginTimeAtZero
        animation.isRemovedOnCompletion = false
        layer.add(animation, forKey: "scroll")
    }

    /// Turns the layer on and off, half of each `period` visible.
    func blink(_ layer: CALayer, period: Double) {
        let animation = CAKeyframeAnimation(keyPath: "opacity")
        animation.values = [1, 0]
        animation.keyTimes = [0, 0.5, 1]
        animation.calculationMode = .discrete
        animation.duration = period
        animation.repeatCount = .infinity
        animation.beginTime = AVCoreAnimationBeginTimeAtZero
        animation.isRemovedOnCompletion = false
        layer.add(animation, forKey: "blink")
    }

    private func add(_ animation: CAKeyframeAnimation, to layer: CALayer, key: String) {
        animation.duration = duration
        animation.beginTime = AVCoreAnimationBeginTimeAtZero
        animation.isRemovedOnCompletion = false
        animation.fillMode = .forwards
        layer.add(animation, forKey: key)
    }
}
