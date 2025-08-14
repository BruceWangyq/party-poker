// swift-tools-version: 5.8
import PackageDescription

let package = Package(
    name: "party-poker",
    platforms: [
        .iOS(.v14)
    ],
    dependencies: [
        .package(url: "https://github.com/socketio/socket.io-client-swift.git", from: "16.1.0")
    ],
    targets: [
        .target(
            name: "party-poker",
            dependencies: [
                .product(name: "SocketIO", package: "socket.io-client-swift")
            ]
        )
    ]
)