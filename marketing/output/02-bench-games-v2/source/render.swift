import AppKit
import AVFoundation
import CoreText
import ImageIO
import CoreImage

// Native, deterministic 15-second composition. Source app pixels are not regenerated.
let root = "/Users/zach/Projects/puckiq"
let output = root + "/marketing/output/02-bench-games-v2"
let W = 1080, H = 1920, FPS = 60
let duration = 15.0
let beats = [0.0, 1.875, 4.6875, 7.5, 11.25, 15.0]
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
let hockey = load("marketing/output/02-bench-games-v2/source/hockey-opener.png")
var hockeyFrames: [CGImage] = []
@MainActor func prepareHockeyVideo() async {
    let path=output+"/source/hockey-opener.mp4"
    guard FileManager.default.fileExists(atPath:path) else {return}
    let asset=AVURLAsset(url:URL(fileURLWithPath:path))
    let generator=AVAssetImageGenerator(asset:asset)
    generator.appliesPreferredTrackTransform=true
    generator.maximumSize=CGSize(width:1080,height:1920)
    generator.requestedTimeToleranceBefore = .zero
    generator.requestedTimeToleranceAfter = .zero
    for i in 0..<70 {
        if let (im,_) = try? await generator.image(at:CMTime(seconds:Double(i)/24,preferredTimescale:600)) {hockeyFrames.append(im)}
    }
    print("Loaded \(hockeyFrames.count) generated hockey frames")
}
let green = color(0x008E55)
func smooth(_ x: Double) -> Double { let p=clamp(x);return p*p*(3-2*p) }
func scoped(_ c: CGContext, alpha: Double = 1, _ f: () -> Void) { c.saveGState();c.setAlpha(clamp(alpha));f();c.restoreGState() }
func line(_ c: CGContext, _ a: CGPoint, _ b: CGPoint, fill: CGColor, width: CGFloat = 2) {
    c.setStrokeColor(fill);c.setLineWidth(width);c.move(to:a);c.addLine(to:b);c.strokePath()
}
func gradient(_ c: CGContext, _ a: CGColor, _ b: CGColor, from: CGPoint, to: CGPoint) {
    let g=CGGradient(colorsSpace:CGColorSpace(name:CGColorSpace.sRGB),colors:[a,b] as CFArray,locations:[0,1])!
    c.drawLinearGradient(g,start:from,end:to,options:[.drawsBeforeStartLocation,.drawsAfterEndLocation])
}
func label(_ c: CGContext, _ title: String, y: CGFloat, dark: Bool = false, center: Bool = false) {
    text(c,title,x:center ? 540:82,y:y,size:28,fill:dark ? color(0x656571):gray,spacing:2,maxWidth:915,align:center ? "center":"left")
}
func brand(_ c: CGContext, dark: Bool = false, step: String = "") {
    rect(c,CGRect(x:82,y:170,width:14,height:14),dark ? ink:red,radius:7)
    text(c,"PUCKIQ",x:112,y:151,size:36,fill:dark ? ink:paper,italic:true)
    if !step.isEmpty { text(c,step,x:826,y:161,size:23,fill:dark ? color(0x656571):gray,spacing:1.8,maxWidth:190) }
}
func note(_ c: CGContext, dark: Bool = false) {
    text(c,"EXAMPLE ROSTER",x:82,y:1668,size:22,fill:dark ? color(0x73737E):gray,spacing:1.5)
}
func kinetic(_ c: CGContext, _ title: String, y: CGFloat, size: CGFloat, t: Double, delay: Double=0,
             fill: CGColor=paper, centered: Bool=false, width: CGFloat=915) {
    let p=ease((t-delay)/0.32)
    c.saveGState();c.setAlpha(p);c.translateBy(x:540,y:y+80);c.scaleBy(x:1+0.06*(1-p),y:1+0.06*(1-p));c.translateBy(x:-540,y:-y-80+75*(1-p))
    text(c,title,x:centered ? 540:76,y:y,size:size,fill:fill,italic:true,maxWidth:width,align:centered ? "center":"left")
    c.restoreGState()
}
func phone(_ c: CGContext, _ shot: CGImage, cx: Double, cy: Double, width: Double, angle: Double=0, alpha: Double=1, yaw: Double=0) {
    let h=width*Double(shot.height)/Double(shot.width), bezel=width*0.025
    scoped(c,alpha:alpha) {
        c.translateBy(x:cx,y:cy);c.rotate(by:angle);c.scaleBy(x:cos(yaw),y:1)
        let r=CGRect(x:-width/2,y:-h/2,width:width,height:h)
        c.setShadow(offset:CGSize(width:0,height:28),blur:46,color:color(0x000000,0.40))
        rect(c,r.insetBy(dx:-bezel,dy:-bezel),color(0x050506),radius:width*0.09,stroke:color(0x74747B),line:2.5)
        c.setShadow(offset:.zero,blur:0)
        line(c,CGPoint(x:-width/2-bezel+3,y:-h/2+width*0.11),CGPoint(x:-width/2-bezel+3,y:h/2-width*0.11),fill:color(0xD7D7DB,0.58),width:2)
        c.addPath(CGPath(roundedRect:r,cornerWidth:width*0.08,cornerHeight:width*0.08,transform:nil));c.clip();image(c,shot,r)
    }
}
func ambient(_ c: CGContext, _ t: Double) {
    rect(c,CGRect(x:0,y:0,width:W,height:H),ink)
    gradient(c,color(0x262631),color(0x0D0D13),from:CGPoint(x:0,y:500),to:CGPoint(x:1080,y:1700))
    c.saveGState();c.setStrokeColor(color(0xC4C4D2,0.055));c.setLineWidth(1.4)
    for n in 0..<12 {
        let x=Double(n)*150-400+t*12
        c.move(to:CGPoint(x:x,y:450));c.addLine(to:CGPoint(x:x+600,y:1920))
    }
    c.strokePath();c.restoreGState()
}
func intro(_ c: CGContext, _ s: Double) {
    let p=clamp(s/1.875)
    let source=hockeyFrames.isEmpty ? hockey:hockeyFrames[min(hockeyFrames.count-1,Int(p*Double(hockeyFrames.count-1)))]
    let zoom=hockeyFrames.isEmpty ? 1.08+0.11*p+0.15*pow(clamp((s-1.5)/0.375),2):1.04
    let scale=max(1080/Double(source.width),1920/Double(source.height))*zoom
    let iw=Double(source.width)*scale,ih=Double(source.height)*scale
    image(c,source,CGRect(x:(1080-iw)/2,y:(1920-ih)/2,width:iw,height:ih))
    gradient(c,color(0x09090F,0.78),color(0x09090F,0),from:CGPoint(x:0,y:100),to:CGPoint(x:0,y:990))
    brand(c)
    kinetic(c,"YOUR BENCH",y:290,size:113,t:s+0.12)
    kinetic(c,"IS COSTING",y:430,size:113,t:s,delay:0.15)
    kinetic(c,"YOU.",y:565,size:154,t:s,delay:0.30,fill:red)
    scoped(c,alpha:ease((s-0.6)/0.3)) {
        rect(c,CGRect(x:83,y:1540,width:285,height:57),color(0xF2F0EC,0.94),radius:5)
        text(c,"FANTASY HOCKEY",x:101,y:1554,size:22,fill:ink,spacing:1)
    }
    // Sparse drifting ice glints, integrated with the still's slow camera push.
    for i in 0..<24 {
        let seed=Double(i), x=(seed*193.3+s*(18+seed*2)).truncatingRemainder(dividingBy:1080)
        let y=920+(seed*79.1-s*70).truncatingRemainder(dividingBy:780)
        let a=0.08+0.17*pow(sin(seed*2+s*3),2)
        rect(c,CGRect(x:x,y:y,width:i%4 == 0 ? 3:1.4,height:i%4 == 0 ? 3:1.4),color(0xFFFFFF,a),radius:2)
    }
}
func mathScene(_ c: CGContext, _ s: Double) {
    rect(c,CGRect(x:0,y:0,width:W,height:H),paper);brand(c,dark:true,step:"01 / WEEK")
    kinetic(c,"THE GAMES",y:277,size:99,t:s,fill:ink)
    kinetic(c,"THAT COUNT.",y:395,size:100,t:s,delay:0.07,fill:ink)
    let tick=(s-0.875)/0.15
    let lost=s<0.875 ? 0:min(7,1+Int(tick)), count=48-lost
    let bounce = lost < 7 && lost > 0 ? sin((tick-floor(tick))*Double.pi)*10:0
    scoped(c,alpha:ease(s/0.25)) {
        text(c,String(count),x:67,y:516-bounce,size:375,fill:ink,italic:true,maxWidth:650)
        text(c,"GAMES",x:88,y:955,size:33,fill:color(0x61616B),spacing:3)
    }
    let badge=ease((s-0.9)/0.3)
    scoped(c,alpha:badge) {
        c.translateBy(x:30*(1-badge),y:0)
        rect(c,CGRect(x:728,y:655,width:208,height:208),red,radius:104)
        text(c,"−7",x:833,y:695,size:98,fill:paper,italic:true,maxWidth:190,align:"center")
        text(c,"BENCHED",x:832,y:893,size:24,fill:red,spacing:2,maxWidth:250,align:"center")
    }
    let gw=106.0,gh=54.0,gap=11.0
    for i in 0..<48 {
        let row=i/8,col=i%8
        let x=82+Double(col)*(gw+gap), y=1074+Double(row)*(gh+gap)
        rect(c,CGRect(x:x,y:y,width:gw,height:gh),color(0xDEDBD6),radius:8)
        let arrival=ease((s-Double(i)*0.007)/0.25)
        if i<41 {
            scoped(c,alpha:arrival) {rect(c,CGRect(x:x,y:y+22*(1-arrival),width:gw,height:gh),ink,radius:8)}
        } else {
            let q=clamp((s-0.875-Double(i-41)*0.15)/0.34)
            scoped(c,alpha:arrival*(1-q)) {
                c.translateBy(x:x+gw/2+pow(q,2)*Double(i%2 == 0 ? 80:-55),y:y+gh/2+pow(q,2)*410)
                c.rotate(by:q*Double(i%2 == 0 ? 0.35:-0.26))
                rect(c,CGRect(x:-gw/2,y:-gh/2,width:gw,height:gh),q>0 ? red:ink,radius:8)
            }
        }
    }
    scoped(c,alpha:ease((s-1.78)/0.30)) {
        text(c,"48 scheduled. 41 usable.",x:82,y:1513,size:40,fill:ink,maxWidth:920)
    }
    note(c,dark:true)
}
func weekScene(_ c: CGContext, _ s: Double) {
    ambient(c,s);brand(c,step:"02 / SEE IT")
    kinetic(c,"SEE WHAT",y:284,size:122,t:s)
    kinetic(c,"YOU'RE LOSING.",y:431,size:98,t:s,delay:0.08,fill:red)
    let enter=ease(s/0.5), z=ease((s-0.85)/0.62)
    let viewport=CGRect(x:67,y:703,width:946,height:850)
    scoped(c,alpha:enter) {
        c.translateBy(x:380*(1-enter),y:75*(1-enter))
        c.setShadow(offset:CGSize(width:0,height:22),blur:45,color:color(0x000000,0.5))
        rect(c,viewport,color(0x070709),radius:42,stroke:color(0x444450),line:2)
        c.setShadow(offset:.zero,blur:0)
        c.addPath(CGPath(roundedRect:viewport,cornerWidth:42,cornerHeight:42,transform:nil));c.clip()
        let width=interp(640,1060,z), x=interp(220,10,z), y=interp(732,316,z)
        if z < 0.97 { phone(c,week,cx:x+width/2,cy:y+width*2868/1320/2,width:width,angle:-0.05*(1-z)) }
        else {image(c,week,CGRect(x:x,y:y,width:width,height:width*2868/1320))}
    }
    // The close-up is the real Week screen, with a separate editorial callout.
    let q=ease((s-1.48)/0.25)
    scoped(c,alpha:q) {
        bracket(c,CGRect(x:375,y:1095,width:246,height:130),progress:1)
    }
    note(c)
}
func pickupScene(_ c: CGContext, _ s: Double) {
    rect(c,CGRect(x:0,y:0,width:W,height:H),paper);brand(c,dark:true,step:"03 / FIX IT")
    kinetic(c,"FIND GAMES",y:279,size:117,t:s,fill:ink)
    kinetic(c,"THAT FIT.",y:424,size:152,t:s,delay:0.07,fill:red)
    let e=ease((s-0.12)/0.5)
    scoped(c,alpha:e) {
        c.translateBy(x:540,y:939+220*(1-e));c.rotate(by:-0.065*(1-e));c.translateBy(x:-540,y:-939)
        panel(c,pickupCard,x:67,y:738,width:946,t:2,delay:0,zoom:0)
    }
    scoped(c,alpha:ease((s-0.75)/0.30)) {
        bracket(c,CGRect(x:86,y:1038,width:252,height:59),progress:1)
    }
    let dayY=1260.0
    for (i,day) in ["WED","SAT"].enumerated() {
        let p=ease((s-0.9-Double(i)*0.20)/0.40),x=82.0+Double(i)*478
        scoped(c,alpha:0.35) {rect(c,CGRect(x:x,y:dayY,width:437,height:170),color(0xDCD9D4),radius:16)}
        scoped(c,alpha:p) {
            c.translateBy(x:0,y:90*(1-p));rect(c,CGRect(x:x,y:dayY,width:437,height:170),ink,radius:16,stroke:green,line:4)
            text(c,day,x:x+29,y:dayY+22,size:48,fill:paper,italic:true,maxWidth:350)
            text(c,"AN OPEN NIGHT",x:x+29,y:dayY+101,size:24,fill:color(0x8BC6AB),spacing:1,maxWidth:375)
            let cx=x+376,cy=dayY+51
            line(c,CGPoint(x:cx-11,y:cy),CGPoint(x:cx-3,y:cy+9),fill:color(0x7ADDAC),width:5)
            line(c,CGPoint(x:cx-3,y:cy+9),CGPoint(x:cx+13,y:cy-11),fill:color(0x7ADDAC),width:5)
        }
    }
    scoped(c,alpha:ease((s-1.7)/0.4)) {text(c,"One pickup. Two open nights.",x:82,y:1513,size:39,fill:ink,maxWidth:930)}
    note(c,dark:true)
}
func endScene(_ c: CGContext, _ s: Double) {
    rect(c,CGRect(x:0,y:0,width:W,height:H),red)
    gradient(c,color(0xE10600),color(0x990800),from:CGPoint(x:0,y:200),to:CGPoint(x:1080,y:1700))
    // An expanding rink circle links the game tiles to the product reveal.
    c.saveGState();c.setStrokeColor(color(0xFFFFFF,0.085));c.setLineWidth(2)
    for n in 0..<4 {let r=250.0+Double(n)*235+s*20;c.addEllipse(in:CGRect(x:540-r,y:1080-r,width:r*2,height:r*2))};c.strokePath();c.restoreGState()
    text(c,"PUCKIQ",x:80,y:149,size:44,fill:paper,italic:true)
    kinetic(c,"MAKE EVERY",y:252,size:116,t:s)
    kinetic(c,"GAME COUNT.",y:393,size:116,t:s,delay:0.09)
    let left=ease((s-0.08)/0.65),right=ease((s-0.15)/0.65),front=ease((s-0.22)/0.65)
    phone(c,week,cx:interp(-280,264,left),cy:interp(1400,1070,left),width:352,angle:interp(-0.38,-0.14,left),alpha:left,yaw:0.12)
    phone(c,pickups,cx:interp(1410,817,right),cy:interp(1430,1070,right),width:352,angle:interp(0.38,0.14,right),alpha:right,yaw:-0.12)
    phone(c,tonight,cx:540,cy:interp(1370,1038,front),width:440+8*sin(min(s,3.3)*0.6),angle:0,alpha:front)
    let p=ease((s-0.80)/0.35)
    scoped(c,alpha:p) {
        c.translateBy(x:0,y:35*(1-p))
        c.setShadow(offset:CGSize(width:0,height:9),blur:24,color:color(0x430200,0.4))
        rect(c,CGRect(x:104,y:1530,width:872,height:112),paper,radius:18)
        c.setShadow(offset:.zero,blur:0)
        text(c,"GET PUCKIQ",x:506,y:1555,size:46,fill:ink,italic:true,maxWidth:700,align:"center")
        line(c,CGPoint(x:812,y:1586),CGPoint(x:871,y:1586),fill:ink,width:5)
        line(c,CGPoint(x:852,y:1567),CGPoint(x:871,y:1586),fill:ink,width:5)
        line(c,CGPoint(x:852,y:1605),CGPoint(x:871,y:1586),fill:ink,width:5)
        text(c,"Your fantasy hockey coach · App Store",x:540,y:1680,size:27,fill:paper,heavy:false,maxWidth:920,align:"center")
    }
}
func scene(_ c: CGContext, _ t: Double) {
    let n=(0..<5).last(where:{t>=beats[$0]}) ?? 0,s=t-beats[n]
    switch n {case 0:intro(c,s);case 1:mathScene(c,s);case 2:weekScene(c,s);case 3:pickupScene(c,s);default:endScene(c,s)}
    // Brief directional transitions; no periodic flashing or repeated fades.
    for cut in beats.dropFirst().dropLast() {
        let d=t-cut
        if abs(d)<0.105 {
            let p=(d+0.105)/0.21,x=interp(-1600,1550,p)
            let path=CGMutablePath();path.move(to:CGPoint(x:x,y:0));path.addLine(to:CGPoint(x:x+1400,y:0));path.addLine(to:CGPoint(x:x+930,y:1920));path.addLine(to:CGPoint(x:x-470,y:1920));path.closeSubpath()
            c.addPath(path);c.setFillColor(red);c.fillPath()
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
    let times = [0.6,1.5,2.4,3.2,4.2,5.2,6.9,8.6,10.2,13.5]
    let cw = 270, ch = 480
    let c = context(nil,width:cw*5,height:ch*2,stride:cw*5*4)
    c.translateBy(x:0,y:CGFloat(ch*2));c.scaleBy(x:1,y:-1)
    for (n,t) in times.enumerated() {
        let im = frame(t)
        png(im,output+String(format:"/review/frame-%04.1f.png",t))
        image(c,im,CGRect(x:(n%5)*cw,y:(n/5)*ch,width:cw,height:ch))
    }
    png(c.makeImage()!,output+"/review/contact-sheet.png")
    png(frame(1.45),output+"/puckiq-bench-games-v2-cover.png")
    print("Preview frames ready")
}
func render() async throws {
    let url=URL(fileURLWithPath:output+"/source/picture.mp4")
    try? FileManager.default.removeItem(at:url)
    let writer=try AVAssetWriter(outputURL:url,fileType:.mp4)
    let input=AVAssetWriterInput(mediaType:.video,outputSettings:[AVVideoCodecKey:AVVideoCodecType.h264,AVVideoWidthKey:W,AVVideoHeightKey:H,AVVideoCompressionPropertiesKey:[AVVideoAverageBitRateKey:18_000_000,AVVideoProfileLevelKey:AVVideoProfileLevelH264HighAutoLevel,AVVideoExpectedSourceFrameRateKey:FPS,AVVideoMaxKeyFrameIntervalKey:FPS],AVVideoColorPropertiesKey:[AVVideoColorPrimariesKey:AVVideoColorPrimaries_ITU_R_709_2,AVVideoTransferFunctionKey:AVVideoTransferFunction_ITU_R_709_2,AVVideoYCbCrMatrixKey:AVVideoYCbCrMatrix_ITU_R_709_2]])
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
        if i % 90 == 0 {print("Rendered \(i)/900 frames")}
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
    let url=URL(fileURLWithPath:output+"/puckiq-bench-games-v2-15s.mp4")
    try? FileManager.default.removeItem(at:url)
    let export=AVAssetExportSession(asset:composition,presetName:AVAssetExportPresetHighestQuality)!
    export.shouldOptimizeForNetworkUse=true
    try await export.export(to:url,as:.mp4)
    print("Finished: \(url.path)")
}
let mode=CommandLine.arguments.dropFirst().first ?? "previews"
await prepareHockeyVideo()
switch mode {
case "previews":previews()
case "render":try await render()
case "mux":try await mux()
default:previews();try await render();try await mux()
}
