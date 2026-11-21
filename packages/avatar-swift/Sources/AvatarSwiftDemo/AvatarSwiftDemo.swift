import AvatarSwift
import SwiftUI

enum DemoFiles {
    static let strobi: AvatarCharacter = load { try createAvatar(data("Strobi.avatar")) }
    static let clover: AvatarCharacter = load { try createAvatar(data("Clover.avatar")) }
    static let library: AvatarLibrary = load {
        let result = try readAvatarLibrary(data("DemoLibrary"))
        precondition(result.problems.isEmpty, result.problems.joined(separator: "\n"))
        return result.library
    }

    private static func data(_ name: String) throws -> Data {
        guard let url = Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Resources") else {
            throw CocoaError(.fileNoSuchFile)
        }
        return try Data(contentsOf: url)
    }

    private static func load<T>(_ load: () throws -> T) -> T {
        do { return try load() }
        catch { preconditionFailure("Invalid packaged demo file: \(error)") }
    }
}

@main
enum AvatarSwiftDemo {
    @MainActor
    static func main() {
        #if os(macOS)
        let arguments = CommandLine.arguments
        if arguments.count > 1 {
            guard arguments.count == 3, arguments[1] == "--export" else {
                FileHandle.standardError.write(Data("Usage: AvatarSwiftDemo [--export output.mp4]\n".utf8))
                exit(EXIT_FAILURE)
            }
            do { try DemoReel.write(to: URL(fileURLWithPath: arguments[2])) }
            catch {
                FileHandle.standardError.write(Data((error.localizedDescription + "\n").utf8))
                exit(EXIT_FAILURE)
            }
            return
        }
        #endif
        DemoWindow.main()
    }
}

private struct DemoWindow: App {
    var body: some Scene {
        WindowGroup("AvatarSwift") { AvatarWorkbench() }
        #if os(macOS)
        .defaultSize(width: 710, height: 660)
        #endif
    }
}

private struct AvatarWorkbench: View {
    @State private var usesStrobi = true
    @State private var state: String? = "idle"
    @State private var clip = "Idle_A"
    @State private var face: String?
    @State private var shownState: String? = "idle"
    @State private var follows = false
    @State private var isPaused = false
    @State private var isMuted = false
    @State private var angle = 0.0
    @State private var manual = false
    @State private var handle = AvatarHandle()

    var body: some View {
        VStack(spacing: 17) {
            Picker("Character", selection: $usesStrobi) {
                Text("Strobi").tag(true)
                Text("Clover").tag(false)
            }
            .pickerStyle(.segmented)

            AvatarView(character: usesStrobi ? DemoFiles.strobi : DemoFiles.clover,
                       state: state, clip: clip, face: face, library: DemoFiles.library,
                       pose: manual ? .init(rotation: SIMD3(0, angle, 0)) : nil,
                       paused: isPaused, followPointer: follows, muted: isMuted,
                       size: nil, accessibilityLabel: usesStrobi ? "Strobi avatar" : "Clover avatar",
                       handle: handle) { shownState = $0 }
                .frame(maxWidth: 405, maxHeight: 405)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(red: 0.94, green: 0.95, blue: 0.97), in: .rect(cornerRadius: 16))

            HStack {
                Picker("State", selection: $state) {
                    Text("Play Clip").tag(nil as String?)
                    ForEach(AvatarCatalogue.stateNames + DemoFiles.library.states.keys.sorted(), id: \.self) {
                        Text($0).tag(Optional($0))
                    }
                }
                if state == nil {
                    Picker("Clip", selection: $clip) {
                        ForEach(AvatarCatalogue.clipNames + DemoFiles.library.clips.keys.sorted(), id: \.self) { Text($0) }
                    }
                }
                Picker("Face", selection: $face) {
                    Text("Automatic").tag(nil as String?)
                    ForEach(AvatarCatalogue.faceNames + DemoFiles.library.faces.keys.sorted(), id: \.self) {
                        Text($0).tag(Optional($0))
                    }
                }
                Spacer()
                Text(shownState ?? (state == nil ? clip : ""))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            HStack {
                Button("Nod") { handle.poke(.nod) }
                Button("Bounce") { handle.poke(.bounce) }
                Button("Spin") { handle.poke(.spin) }
                Spacer()
                Toggle("Follow Pointer", isOn: $follows)
                Toggle("Grayscale", isOn: $isMuted)
                Toggle("Pause", isOn: $isPaused)
            }
            HStack {
                Toggle("Hold Pose", isOn: $manual)
                Slider(value: $angle, in: -180...180) { Text("Yaw") }
                    .disabled(!manual)
            }
        }
        .padding(16)
    }
}
