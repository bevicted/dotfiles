import QtQuick
import Quickshell.Io

Text {
    id: root

    readonly property string iface: "enp6s0"

    property real prevRx: -1
    property real prevTx: -1
    property string down: "0B"
    property string up: "0B"

    text: "↓ " + down + "  ↑ " + up
    color: "#89b4fa"
    font.family: "JetBrainsMono Nerd Font"
    font.pixelSize: 12

    function human(bps) {
        if (bps < 1024) return Math.round(bps) + "B"
        if (bps < 1048576) return Math.round(bps / 1024) + "K"
        return (bps / 1048576).toFixed(1) + "M"
    }

    function sample() {
        const txt = netFile.text()
        const lines = txt.split("\n")
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            if (line.indexOf(root.iface + ":") === -1) continue
            const f = line.split(":")[1].trim().split(/\s+/)
            const rx = parseInt(f[0])
            const tx = parseInt(f[8])
            if (root.prevRx >= 0) {
                root.down = human(Math.max(0, rx - root.prevRx))
                root.up = human(Math.max(0, tx - root.prevTx))
            }
            root.prevRx = rx
            root.prevTx = tx
            return
        }
    }

    FileView {
        id: netFile
        path: "/proc/net/dev"
        blockLoading: true
    }

    Timer {
        interval: 1000
        running: true
        repeat: true
        triggeredOnStart: true
        onTriggered: {
            netFile.reload()
            root.sample()
        }
    }
}
