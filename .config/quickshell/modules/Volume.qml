import QtQuick
import Quickshell.Services.Pipewire

Text {
    id: root

    readonly property var node: Pipewire.defaultAudioSink
    readonly property bool muted: node?.audio?.muted ?? false
    readonly property int volume: Math.round((node?.audio?.volume ?? 0) * 100)

    text: (muted ? "󰝟 " : "󰕾 ") + volume + "%"
    color: muted ? "#6c7086" : "#f5c2e7"
    font.family: "JetBrainsMono Nerd Font"
    font.pixelSize: 12

    // Bind the node so its audio properties stay live.
    PwObjectTracker {
        objects: [root.node]
    }

    MouseArea {
        anchors.fill: parent
        acceptedButtons: Qt.LeftButton
        cursorShape: Qt.PointingHandCursor

        onClicked: {
            if (root.node?.audio)
                root.node.audio.muted = !root.node.audio.muted
        }
        onWheel: (wheel) => {
            if (!root.node?.audio)
                return
            const step = wheel.angleDelta.y > 0 ? 0.05 : -0.05
            root.node.audio.volume = Math.max(0, Math.min(1, root.node.audio.volume + step))
        }
    }
}
