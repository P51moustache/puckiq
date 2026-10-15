// Renders 9:16 social posts from JSON specs (see PostSpec.swift): meme-page header or TikTok-style
// caption, timed subtitles, found-footage chrome and an "AI-generated" tag. No branding. AVFoundation only; audio is kept.
//
//   swiftc -O scripts/social/caption/*.swift -o /tmp/caption_clip
//   /tmp/caption_clip marketing/social/x/specs/<post>.json [...]

import Foundation

let specs = CommandLine.arguments.dropFirst()
if specs.isEmpty {
    FileHandle.standardError.write("usage: caption_clip <spec.json> [...]\n".data(using: .utf8)!)
    exit(1)
}
for path in specs {
    do {
        let spec = try JSONDecoder().decode(PostSpec.self, from: Data(contentsOf: URL(fileURLWithPath: path)))
        try await Compositor(spec: spec).render()
        print("wrote \(spec.output)")
    } catch {
        FileHandle.standardError.write("\(path): \(error)\n".data(using: .utf8)!)
        exit(1)
    }
}
