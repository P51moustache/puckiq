import AppKit
import AVFoundation
import CoreText
import ImageIO

// Native, deterministic 15-second composition. Source app pixels are not regenerated.
let root = "/Users/zach/Projects/puckiq"
let output = root + "/marketing/output/01-bench-games"
let W = 1080, H = 1920, FPS = 30
let duration = 15.0
let beats = [0.0, 3.75, 6.5625, 9.375, 12.1875, 15.0]
func color(_ hex: Int, _ alpha: CGFloat = 1) -> CGColor {
    CGColor(colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!, components: [CGFloat((hex >> 16) & 255)/255, CGFloat((hex >> 8) & 255)/255, CGFloat(hex & 255)/255, alpha])!
}
let ink = color(0x15151E), paper = color(0xF2F0EC), red = color(0xE10600), gray = color(0xA5A5AF)
func load(_ relative: String) -> CGImage {
    let url = URL(fileURLWithPath: root + "/" + relative)
    return CGImageSourceCreateImageAtIndex(CGImageSourceCreateWithURL(url as CFURL, nil)!, 0, nil)!
}
let week = load("marketing/screenshots/raw-iphone/04-week.png")
let pickups = load("marketing/screenshots/raw-iphone/05-pickups.png")
let tonight = load("marketing/screenshots/raw-iphone/02-tonight.png")
let puck = load("assets/images/art/logo-mark.png")
let weekCard = week.cropping(to: CGRect(x: 0, y: 340, width: 1320, height: 900))!
let pickupCard = pickups.cropping(to: CGRect(x: 36, y: 1144, width: 1248, height: 500))!
let tonightCard = tonight.cropping(to: CGRect(x: 36, y: 515, width: 1248, height: 850))!

func clamp(_ x: Double) -> Double { max(0, min(1, x)) }
func ease(_ x: Double) -> Double { let a = clamp(x); return 1 - pow(1-a, 4) }
func interp(_ a: Double, _ b: Double, _ p: Double) -> Double { a + (b-a)*p }
func rect(_ ctx: CGContext, _ r: CGRect, _ fill: CGColor, radius: CGFloat = 0, stroke: CGColor? = nil, line: CGFloat = 1) {
    let p = CGPath(roundedRect: r, cornerWidth: radius, cornerHeight: radius, transform: nil)
    ctx.addPath(p); ctx.setFillColor(fill); ctx.fillPath()
    if let s = stroke { ctx.addPath(p); ctx.setStrokeColor(s); ctx.setLineWidth(line); ctx.strokePath() }
}
func image(_ c: CGContext, _ im: CGImage, _ r: CGRect) {
    c.saveGState(); c.translateBy(x: r.minX, y: r.maxY); c.scaleBy(x: 1, y: -1)
    c.interpolationQuality = .high; c.draw(im, in: CGRect(origin: .zero, size: r.size)); c.restoreGState()
}
func font(_ size: CGFloat, _ italic: Bool, _ heavy: Bool) -> NSFont {
    let f = NSFont.systemFont(ofSize: size, weight: heavy ? .black : .medium)
    return italic ? NSFontManager.shared.convert(f, toHaveTrait: .italicFontMask) : f
}
@discardableResult func text(_ c: CGContext, _ s: String, x: CGFloat, y: CGFloat, size: CGFloat,
                           fill: CGColor = paper, italic: Bool = false, heavy: Bool = true,
                           spacing: CGFloat = 0, maxWidth: CGFloat = 950, align: String = "left") -> CGFloat {
    var point = size
    var line: CTLine!
    var width = 0.0, ascent: CGFloat = 0
    repeat {
        let attrs: [NSAttributedString.Key: Any] = [.font: font(point, italic, heavy), .foregroundColor: NSColor(cgColor: fill)!, .kern: spacing]
        line = CTLineCreateWithAttributedString(NSAttributedString(string: s, attributes: attrs))
        width = CTLineGetTypographicBounds(line, &ascent, nil, nil)
        if width <= maxWidth || point <= 12 { break }
        point -= 1
    } while true
    let left = align == "center" ? x - width/2 : x
    c.saveGState(); c.translateBy(x: left, y: y+ascent); c.scaleBy(x: 1, y: -1)
    c.textMatrix = .identity; c.textPosition = .zero; CTLineDraw(line, c); c.restoreGState()
    return CGFloat(width)
}
func headline(_ c: CGContext, _ s: String, x: CGFloat = 76, y: CGFloat, size: CGFloat,
              fill: CGColor = paper, t: Double, delay: Double = 0) {
    let p = ease((t-delay)/0.40)
    c.saveGState(); c.setAlpha(p); c.translateBy(x: -65*(1-p), y: 26*(1-p))
    text(c, s, x: x, y: y, size: size, fill: fill, italic: true, maxWidth: 925)
    c.restoreGState()
}
func panel(_ c: CGContext, _ im: CGImage, x: CGFloat, y: CGFloat, width: CGFloat, t: Double, delay: Double = 0.15, zoom: Double = 0.008) {
    let p = ease((t-delay)/0.50)
    let height = width * CGFloat(im.height)/CGFloat(im.width)
    let scale = 0.965 + 0.035*p + clamp(t/3.3)*zoom
    c.saveGState(); c.setAlpha(p)
    c.translateBy(x: x+width/2, y: y+height/2+70*(1-p)); c.scaleBy(x: scale, y: scale)
    let r = CGRect(x: -width/2, y: -height/2, width: width, height: height)
    c.setShadow(offset: CGSize(width: 0, height: 18), blur: 40, color: color(0x000000, 0.34))
    rect(c, r.insetBy(dx: -8, dy: -8), color(0x292933), radius: 36, stroke: color(0x565660), line: 1.2)
    c.setShadow(offset: .zero, blur: 0)
    c.addPath(CGPath(roundedRect: r, cornerWidth: 29, cornerHeight: 29, transform: nil)); c.clip()
    image(c, im, r)
    c.restoreGState()
}
func bracket(_ c: CGContext, _ r: CGRect, progress: Double) {
    c.saveGState(); c.setAlpha(clamp(progress)); c.setStrokeColor(red); c.setLineWidth(7); c.setLineCap(.square)
    let len: CGFloat = 26
    for (x,y,dx,dy) in [(r.minX,r.minY,1.0,1.0),(r.maxX,r.minY,-1.0,1.0),(r.minX,r.maxY,1.0,-1.0),(r.maxX,r.maxY,-1.0,-1.0)] {
        c.move(to: CGPoint(x: x+dx*len, y: y)); c.addLine(to: CGPoint(x:x,y:y)); c.addLine(to: CGPoint(x:x,y:y+dy*len))
    }
    c.strokePath(); c.restoreGState()
}
func background(_ c: CGContext, _ t: Double, final: Bool) {
    rect(c, CGRect(x:0,y:0,width:W,height:H), ink)
    c.saveGState(); c.setStrokeColor(color(0x42424D, 0.18)); c.setLineWidth(2)
    c.addPath(CGPath(roundedRect: CGRect(x: -260, y: 670, width: 1590, height: 1500), cornerWidth: 270, cornerHeight: 270, transform: nil))
    c.move(to:CGPoint(x:-250,y:1430));c.addLine(to:CGPoint(x:1360,y:1430))
    c.addEllipse(in:CGRect(x:330,y:1220,width:420,height:420));c.strokePath();c.restoreGState()
    // Quiet broadcast rail, with a moving red tick.
    rect(c,CGRect(x:76,y:222,width:925,height:2),color(0x44444E))
    rect(c,CGRect(x:76+min(t/15,1)*825,y:220,width:100,height:5),red)
    if !final {
        rect(c,CGRect(x:78,y:166,width:14,height:14),red,radius:7)
        text(c,"PUCKIQ",x:110,y:151,size:33,italic:true)
        text(c,"FANTASY HOCKEY",x:510,y:157,size:25,fill:gray,spacing:3,maxWidth:470)
        text(c,"EXAMPLE ROSTER · ACTUAL APP SCREENS",x:80,y:1690,size:21,fill:color(0x858590),heavy:false,spacing:1.2)
    }
}
func scene(_ c: CGContext, _ t: Double) {
    let n = (0..<5).last(where: {t >= beats[$0]}) ?? 0
    let s = t-beats[n]
    background(c,t,final:n == 4)
    switch n {
    case 0:
        headline(c,"48 GAMES.",y:292,size:159,t:s)
        headline(c,"ONLY 41",y:473,size:156,t:s,delay:0.55)
        headline(c,"COUNT.",y:647,size:156,fill:red,t:s,delay:0.68)
        panel(c,weekCard,x:68,y:947,width:944,t:s,delay:0.20)
        if s > 1.1 { text(c,"YOUR WEEK, AT A GLANCE",x:79,y:880,size:27,fill:gray,spacing:2) }
    case 1:
        headline(c,"STOP LEAVING",y:284,size:97,t:s)
        headline(c,"GAMES ON",y:412,size:129,t:s,delay:0.07)
        headline(c,"THE BENCH.",y:558,size:123,fill:red,t:s,delay:0.14)
        panel(c,weekCard,x:68,y:862,width:944,t:s,delay:0.08,zoom:0)
        bracket(c,CGRect(x:388,y:1317,width:238,height:109),progress:(s-0.55)/0.25)
        c.saveGState(); c.setAlpha(ease((s-0.70)/0.4))
        text(c,"Spot the games your lineup can't use.",x:80,y:1552,size:35,fill:paper,heavy:false,maxWidth:920)
        c.restoreGState()
    case 2:
        headline(c,"FIND PICKUPS",y:302,size:111,t:s)
        headline(c,"THAT FIT.",y:447,size:158,fill:red,t:s,delay:0.10)
        c.saveGState();c.setAlpha(ease((s-0.25)/0.4))
        text(c,"FOR YOUR EMPTY NIGHTS",x:81,y:668,size:30,fill:gray,spacing:2.1)
        text(c,"PICKUPS  /  THIS WEEK",x:81,y:779,size:27,fill:paper,spacing:1.6)
        c.restoreGState()
        panel(c,pickupCard,x:68,y:852,width:944,t:s,delay:0.14,zoom:0)
        bracket(c,CGRect(x:87,y:1152,width:250,height:58),progress:(s-0.65)/0.25)
        let p = ease((s-0.80)/0.40)
        c.saveGState();c.setAlpha(p);c.translateBy(x:0,y:25*(1-p))
        text(c,"2",x:77,y:1320,size:210,italic:true)
        text(c,"EMPTY SLOTS",x:258,y:1380,size:49,italic:true,maxWidth:710)
        text(c,"YOU COULD FILL.",x:258,y:1440,size:44,fill:red,italic:true,maxWidth:710)
        c.restoreGState()
    case 3:
        headline(c,"BE READY.",y:300,size:158,t:s)
        headline(c,"BEFORE LOCK.",y:488,size:107,fill:red,t:s,delay:0.10)
        panel(c,tonightCard,x:68,y:809,width:944,t:s,delay:0.13,zoom:0.005)
        c.saveGState(); c.setAlpha(ease((s-0.65)/0.4))
        text(c,"Your next move, made clearer.",x:80,y:1536,size:38,fill:paper,heavy:false,maxWidth:920)
        c.restoreGState()
    default:
        text(c,"MAKE EVERY GAME COUNT.",x:540,y:292,size:38,fill:paper,spacing:1.8,maxWidth:930,align:"center")
        let p = ease((s-0.04)/0.55)
        c.saveGState();c.setAlpha(p);c.translateBy(x:-850*(1-p),y:0)
        image(c,puck,CGRect(x:199,y:544,width:682,height:231));c.restoreGState()
        c.saveGState();c.setAlpha(ease((s-0.24)/0.4))
        text(c,"PUCKIQ",x:540,y:825,size:192,italic:true,maxWidth:930,align:"center")
        text(c,"YOUR FANTASY",x:540,y:1085,size:53,italic:true,maxWidth:920,align:"center")
        text(c,"HOCKEY COACH.",x:540,y:1150,size:53,italic:true,maxWidth:920,align:"center")
        c.restoreGState()
        let q = ease((s-0.50)/0.40)
        c.saveGState();c.setAlpha(q);c.translateBy(x:0,y:20*(1-q))
        rect(c,CGRect(x:174,y:1336,width:732,height:116),red,radius:18)
        text(c,"GET PUCKIQ",x:499,y:1361,size:46,italic:true,maxWidth:600,align:"center")
        c.setStrokeColor(paper);c.setLineWidth(5);c.setLineCap(.round)
        c.move(to:CGPoint(x:773,y:1394));c.addLine(to:CGPoint(x:823,y:1394));c.addLine(to:CGPoint(x:806,y:1377));
        c.move(to:CGPoint(x:823,y:1394));c.addLine(to:CGPoint(x:806,y:1411));c.strokePath()
        text(c,"Available on the App Store",x:540,y:1504,size:32,fill:gray,heavy:false,maxWidth:930,align:"center")
        c.restoreGState()
    }
    // Short diagonal wipes land on the soundtrack's section boundaries.
    for cut in beats.dropFirst().dropLast() {
        let d = t-cut
        if abs(d) < 0.15 {
            let x = interp(-1500, 1450, (d+0.15)/0.30)
            let p = CGMutablePath();p.move(to:CGPoint(x:x,y:0));p.addLine(to:CGPoint(x:x+1500,y:0));p.addLine(to:CGPoint(x:x+900,y:1920));p.addLine(to:CGPoint(x:x-600,y:1920));p.closeSubpath()
            c.addPath(p);c.setFillColor(red);c.fillPath()
        }
    }
}
func context(_ data: UnsafeMutableRawPointer?, width: Int, height: Int, stride: Int) -> CGContext {
    CGContext(data:data,width:width,height:height,bitsPerComponent:8,bytesPerRow:stride,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)!
}
func frame(_ t: Double) -> CGImage {
    let c = context(nil,width:W,height:H,stride:W*4)
    c.translateBy(x:0,y:CGFloat(H));c.scaleBy(x:1,y:-1);scene(c,t)
    return c.makeImage()!
}
func png(_ im: CGImage, _ path: String) {
    let dst = CGImageDestinationCreateWithURL(URL(fileURLWithPath:path) as CFURL,"public.png" as CFString,1,nil)!
    CGImageDestinationAddImage(dst,im,nil);CGImageDestinationFinalize(dst)
}
func previews() {
    let times = [0.5,1.4,3.0,4.5,5.9,7.4,8.8,10.1,11.6,13.5]
    let cw = 270, ch = 480
    let c = context(nil,width:cw*5,height:ch*2,stride:cw*5*4)
    c.translateBy(x:0,y:CGFloat(ch*2));c.scaleBy(x:1,y:-1)
    for (n,t) in times.enumerated() {
        let im = frame(t)
        png(im,output+String(format:"/review/frame-%04.1f.png",t))
        image(c,im,CGRect(x:(n%5)*cw,y:(n/5)*ch,width:cw,height:ch))
    }
    png(c.makeImage()!,output+"/review/contact-sheet.png")
    png(frame(2.3),output+"/puckiq-bench-games-cover.png")
    print("Preview frames ready")
}
func render() async throws {
    let url=URL(fileURLWithPath:output+"/source/picture.mp4")
    try? FileManager.default.removeItem(at:url)
    let writer=try AVAssetWriter(outputURL:url,fileType:.mp4)
    let input=AVAssetWriterInput(mediaType:.video,outputSettings:[AVVideoCodecKey:AVVideoCodecType.h264,AVVideoWidthKey:W,AVVideoHeightKey:H,AVVideoCompressionPropertiesKey:[AVVideoAverageBitRateKey:14_000_000,AVVideoProfileLevelKey:AVVideoProfileLevelH264HighAutoLevel,AVVideoExpectedSourceFrameRateKey:FPS,AVVideoMaxKeyFrameIntervalKey:FPS],AVVideoColorPropertiesKey:[AVVideoColorPrimariesKey:AVVideoColorPrimaries_ITU_R_709_2,AVVideoTransferFunctionKey:AVVideoTransferFunction_ITU_R_709_2,AVVideoYCbCrMatrixKey:AVVideoYCbCrMatrix_ITU_R_709_2]])
    let adaptor=AVAssetWriterInputPixelBufferAdaptor(assetWriterInput:input,sourcePixelBufferAttributes:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32ARGB,kCVPixelBufferWidthKey as String:W,kCVPixelBufferHeightKey as String:H,kCVPixelBufferCGImageCompatibilityKey as String:true,kCVPixelBufferCGBitmapContextCompatibilityKey as String:true])
    input.expectsMediaDataInRealTime=false;writer.add(input);writer.startWriting();writer.startSession(atSourceTime:.zero)
    for i in 0..<Int(duration*Double(FPS)) {
        while !input.isReadyForMoreMediaData { try await Task.sleep(nanoseconds:2_000_000) }
        try autoreleasepool {
            var buf:CVPixelBuffer?;CVPixelBufferPoolCreatePixelBuffer(nil,adaptor.pixelBufferPool!,&buf)
            let b=buf!;CVPixelBufferLockBaseAddress(b,[])
            // ARGB memory layout for the writer's pixel pool.
            let c=CGContext(data:CVPixelBufferGetBaseAddress(b),width:W,height:H,bitsPerComponent:8,bytesPerRow:CVPixelBufferGetBytesPerRow(b),space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.noneSkipFirst.rawValue)!
            c.translateBy(x:0,y:CGFloat(H));c.scaleBy(x:1,y:-1);scene(c,Double(i)/Double(FPS))
            CVPixelBufferUnlockBaseAddress(b,[])
            guard adaptor.append(b,withPresentationTime:CMTime(value:Int64(i),timescale:Int32(FPS))) else {throw writer.error!}
        }
        if i % 90 == 0 {print("Rendered \(i)/450 frames")}
    }
    input.markAsFinished();await writer.finishWriting()
    if let e=writer.error {throw e}
    print("Picture render complete")
}
func mux() async throws {
    let composition=AVMutableComposition()
    let range=CMTimeRange(start:.zero,duration:CMTime(seconds:15,preferredTimescale:600))
    for (name,type) in [("picture.mp4",AVMediaType.video),("soundtrack.wav",AVMediaType.audio)] {
        let asset=AVURLAsset(url:URL(fileURLWithPath:output+"/source/"+name))
        let source=try await asset.loadTracks(withMediaType:type).first!
        let track=composition.addMutableTrack(withMediaType:type,preferredTrackID:kCMPersistentTrackID_Invalid)!
        try track.insertTimeRange(range,of:source,at:.zero)
    }
    let url=URL(fileURLWithPath:output+"/puckiq-bench-games-15s.mp4")
    try? FileManager.default.removeItem(at:url)
    let export=AVAssetExportSession(asset:composition,presetName:AVAssetExportPresetHighestQuality)!
    export.shouldOptimizeForNetworkUse=true
    try await export.export(to:url,as:.mp4)
    print("Finished: \(url.path)")
}
let mode=CommandLine.arguments.dropFirst().first ?? "previews"
switch mode {
case "previews":previews()
case "render":try await render()
case "mux":try await mux()
default:previews();try await render();try await mux()
}
