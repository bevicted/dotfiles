import QtQuick
import Quickshell
import Quickshell.Io

Text {
    id: root

    property int volume: 0
    property bool muted: false

    text: (muted ? "󰝟 " : "󰕾 ") + volume + "%"
    color: muted ? "#6c7086" : "#f5c2e7"
    font.family: "JetBrainsMono Nerd Font"
    font.pixelSize: 12

    Process {
        id: getVol
        command: ["wpctl", "get-volume", "@DEFAULT_AUDIO_SINK@"]
        stdout: StdioCollector {
            onStreamFinished: {
                const t = this.text.trim()
                root.muted = t.indexOf("MUTED") !== -1
                const m = t.match(/Volume: ([0-9.]+)/)
                root.volume = m ? Math.round(parseFloat(m[1]) * 100) : 0
            }
        }
    }

    Timer {
        interval: 1000
        running: true
        repeat: true
        triggeredOnStart: true
        onTriggered: getVol.running = true
    }

    MouseArea {
        anchors.fill: parent
        acceptedButtons: Qt.LeftButton
        cursorShape: Qt.PointingHandCursor

        onClicked: {
            Quickshell.execDetached(["wpctl", "set-mute", "@DEFAULT_AUDIO_SINK@", "toggle"])
            getVol.running = true
        }
        onWheel: (wheel) => {
            const step = wheel.angleDelta.y > 0 ? "5%+" : "5%-"
            Quickshell.execDetached(["wpctl", "set-volume", "@DEFAULT_AUDIO_SINK@", step, "-l", "1.0"])
            getVol.running = true
        }
    }
}
