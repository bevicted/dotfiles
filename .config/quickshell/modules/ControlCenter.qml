import QtQuick
import QtQuick.Layouts
import QtQuick.Controls
import Quickshell
import Quickshell.Wayland
import Quickshell.Io
import Quickshell.Services.Pipewire

PanelWindow {
    id: root

    required property var server
    property bool shown: false

    function toggle() { shown = !shown }

    visible: shown
    anchors {
        top: true
        right: true
    }
    margins {
        top: 32
        right: 8
    }
    implicitWidth: 360
    implicitHeight: 560
    color: "transparent"
    exclusionMode: ExclusionMode.Ignore
    WlrLayershell.layer: WlrLayer.Overlay
    focusable: true

    readonly property string accent: "#b4befe"

    PwObjectTracker { objects: Pipewire.defaultAudioSink ? [Pipewire.defaultAudioSink] : [] }

    Item {
        anchors.fill: parent
        focus: true
        Keys.onEscapePressed: root.shown = false
    }

    Rectangle {
        anchors.fill: parent
        radius: 14
        color: "#1e1e2e"
        opacity: 0.94
        border.width: 1
        border.color: Qt.rgba(0.71, 0.75, 1.0, 0.35)

        ColumnLayout {
            anchors.fill: parent
            anchors.margins: 16
            spacing: 14

            // ---- Network ----
            ColumnLayout {
                Layout.fillWidth: true
                spacing: 4
                Text {
                    text: "NETWORK"
                    color: "#cdd6f4"; font.bold: true
                    font.family: "JetBrainsMono Nerd Font"; font.pixelSize: 11
                }
                Rectangle { Layout.fillWidth: true; height: 1; color: "#45475a"; opacity: 0.4 }
                Text {
                    text: net.iface + "   " + net.ip
                    color: "#bac2de"
                    font.family: "JetBrainsMono Nerd Font"; font.pixelSize: 12
                }
                Text {
                    text: "↓ " + net.down + "   ↑ " + net.up
                    color: "#89b4fa"
                    font.family: "JetBrainsMono Nerd Font"; font.pixelSize: 12
                }
            }

            // ---- Volume ----
            ColumnLayout {
                Layout.fillWidth: true
                spacing: 4
                Text {
                    text: "VOLUME"
                    color: "#cdd6f4"; font.bold: true
                    font.family: "JetBrainsMono Nerd Font"; font.pixelSize: 11
                }
                Rectangle { Layout.fillWidth: true; height: 1; color: "#45475a"; opacity: 0.4 }
                RowLayout {
                    Layout.fillWidth: true
                    spacing: 8
                    Text {
                        text: (Pipewire.defaultAudioSink && Pipewire.defaultAudioSink.audio.muted) ? "󰝟" : "󰕾"
                        color: "#f5c2e7"
                        font.family: "JetBrainsMono Nerd Font"; font.pixelSize: 14
                        MouseArea {
                            anchors.fill: parent
                            cursorShape: Qt.PointingHandCursor
                            onClicked: {
                                const s = Pipewire.defaultAudioSink
                                if (s) s.audio.muted = !s.audio.muted
                            }
                        }
                    }
                    Slider {
                        id: volSlider
                        Layout.fillWidth: true
                        from: 0; to: 1
                        value: Pipewire.defaultAudioSink ? Pipewire.defaultAudioSink.audio.volume : 0
                        onMoved: {
                            const s = Pipewire.defaultAudioSink
                            if (s) s.audio.volume = value
                        }
                    }
                    Text {
                        text: Math.round(volSlider.value * 100) + "%"
                        color: "#bac2de"
                        font.family: "JetBrainsMono Nerd Font"; font.pixelSize: 12
                    }
                }
                Text {
                    text: Pipewire.defaultAudioSink ? Pipewire.defaultAudioSink.description : "no sink"
                    color: "#6c7086"
                    font.family: "JetBrainsMono Nerd Font"; font.pixelSize: 10
                    elide: Text.ElideRight
                    Layout.fillWidth: true
                }
            }

            // ---- System ----
            ColumnLayout {
                Layout.fillWidth: true
                spacing: 6
                Text {
                    text: "SYSTEM"
                    color: "#cdd6f4"; font.bold: true
                    font.family: "JetBrainsMono Nerd Font"; font.pixelSize: 11
                }
                Rectangle { Layout.fillWidth: true; height: 1; color: "#45475a"; opacity: 0.4 }
                Repeater {
                    model: [
                        { label: "CPU ", frac: sys.cpu,  text: Math.round(sys.cpu * 100) + "%" },
                        { label: "RAM ", frac: sys.memFrac, text: sys.memText },
                        { label: "DISK", frac: sys.diskFrac, text: sys.diskText }
                    ]
                    delegate: RowLayout {
                        required property var modelData
                        Layout.fillWidth: true
                        spacing: 8
                        Text {
                            text: modelData.label
                            color: "#a6adc8"
                            font.family: "JetBrainsMono Nerd Font"; font.pixelSize: 11
                        }
                        Rectangle {
                            Layout.fillWidth: true
                            height: 8
                            radius: 4
                            color: "#313244"
                            Rectangle {
                                height: parent.height
                                radius: 4
                                width: parent.width * Math.max(0, Math.min(1, modelData.frac))
                                color: "#b4befe"
                            }
                        }
                        Text {
                            text: modelData.text
                            color: "#bac2de"
                            font.family: "JetBrainsMono Nerd Font"; font.pixelSize: 11
                            Layout.minimumWidth: 84
                            horizontalAlignment: Text.AlignRight
                        }
                    }
                }
            }

            // ---- Notifications ----
            RowLayout {
                Layout.fillWidth: true
                Text {
                    text: "NOTIFICATIONS"
                    color: "#cdd6f4"; font.bold: true
                    font.family: "JetBrainsMono Nerd Font"; font.pixelSize: 11
                }
                Item { Layout.fillWidth: true }
                Text {
                    text: "clear"
                    color: "#f38ba8"
                    font.family: "JetBrainsMono Nerd Font"; font.pixelSize: 11
                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: {
                            const list = root.server.trackedNotifications
                            for (let i = list.values.length - 1; i >= 0; i--)
                                list.values[i].dismiss()
                        }
                    }
                }
            }
            Rectangle { Layout.fillWidth: true; height: 1; color: "#45475a"; opacity: 0.4 }

            ScrollView {
                Layout.fillWidth: true
                Layout.fillHeight: true
                clip: true

                ColumnLayout {
                    width: parent.width
                    spacing: 6

                    Repeater {
                        model: root.server.trackedNotifications

                        delegate: Rectangle {
                            required property var modelData
                            Layout.fillWidth: true
                            implicitHeight: nbody.y + nbody.implicitHeight + 8
                            radius: 8
                            color: "#313244"

                            Text {
                                id: napp
                                x: 10; y: 6
                                text: modelData.appName
                                color: "#89b4fa"
                                font.family: "JetBrainsMono Nerd Font"; font.pixelSize: 9
                            }
                            Text {
                                id: nsum
                                anchors { top: napp.bottom; left: napp.left; right: parent.right; rightMargin: 10 }
                                text: modelData.summary
                                color: "#cdd6f4"; font.bold: true
                                font.family: "JetBrainsMono Nerd Font"; font.pixelSize: 11
                                wrapMode: Text.WordWrap
                            }
                            Text {
                                id: nbody
                                anchors { top: nsum.bottom; left: napp.left; right: parent.right; rightMargin: 10 }
                                text: modelData.body
                                visible: text.length > 0
                                color: "#bac2de"
                                font.family: "JetBrainsMono Nerd Font"; font.pixelSize: 10
                                wrapMode: Text.WordWrap
                                maximumLineCount: 3
                                elide: Text.ElideRight
                            }
                            MouseArea {
                                anchors.fill: parent
                                cursorShape: Qt.PointingHandCursor
                                onClicked: modelData.dismiss()
                            }
                        }
                    }

                    Text {
                        visible: root.server.trackedNotifications.values.length === 0
                        text: "no notifications"
                        color: "#6c7086"
                        font.family: "JetBrainsMono Nerd Font"; font.pixelSize: 11
                    }
                }
            }
        }
    }

    // ---- data: network ----
    QtObject {
        id: net
        property string iface: "enp6s0"
        property string ip: "—"
        property real prevRx: -1
        property real prevTx: -1
        property string down: "0B"
        property string up: "0B"
    }
    function human(bps) {
        if (bps < 1024) return Math.round(bps) + "B"
        if (bps < 1048576) return Math.round(bps / 1024) + "K"
        return (bps / 1048576).toFixed(1) + "M"
    }
    FileView { id: netFile; path: "/proc/net/dev"; blockLoading: true }
    Process {
        id: ipProc
        command: ["ip", "-4", "-o", "addr", "show", net.iface]
        stdout: StdioCollector {
            onStreamFinished: {
                const m = this.text.match(/inet\s+([0-9.]+)/)
                net.ip = m ? m[1] : "down"
            }
        }
    }
    Timer {
        interval: 1000; running: root.shown; repeat: true; triggeredOnStart: true
        onTriggered: {
            netFile.reload()
            const lines = netFile.text().split("\n")
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].indexOf(net.iface + ":") === -1) continue
                const f = lines[i].split(":")[1].trim().split(/\s+/)
                const rx = parseInt(f[0]); const tx = parseInt(f[8])
                if (net.prevRx >= 0) {
                    net.down = root.human(Math.max(0, rx - net.prevRx))
                    net.up = root.human(Math.max(0, tx - net.prevTx))
                }
                net.prevRx = rx; net.prevTx = tx
                break
            }
            ipProc.running = true
        }
    }

    // ---- data: system ----
    QtObject {
        id: sys
        property real cpu: 0
        property real prevIdle: -1
        property real prevTotal: -1
        property real memFrac: 0
        property string memText: "—"
        property real diskFrac: 0
        property string diskText: "—"
    }
    FileView { id: statFile; path: "/proc/stat"; blockLoading: true }
    FileView { id: memFile; path: "/proc/meminfo"; blockLoading: true }
    Process {
        id: dfProc
        command: ["df", "-B1", "--output=used,size", "/"]
        stdout: StdioCollector {
            onStreamFinished: {
                const ln = this.text.trim().split("\n")
                if (ln.length < 2) return
                const p = ln[1].trim().split(/\s+/)
                const used = parseFloat(p[0]); const size = parseFloat(p[1])
                if (size > 0) {
                    sys.diskFrac = used / size
                    sys.diskText = (used / 1e9).toFixed(0) + "G/" + (size / 1e9).toFixed(0) + "G"
                }
            }
        }
    }
    Timer {
        interval: 2000; running: root.shown; repeat: true; triggeredOnStart: true
        onTriggered: {
            statFile.reload()
            const c = statFile.text().split("\n")[0].trim().split(/\s+/)
            // c[0]="cpu", then user nice system idle iowait irq softirq ...
            let total = 0
            for (let i = 1; i < c.length; i++) total += parseFloat(c[i])
            const idle = parseFloat(c[4])
            if (sys.prevTotal >= 0) {
                const dt = total - sys.prevTotal
                const di = idle - sys.prevIdle
                sys.cpu = dt > 0 ? (1 - di / dt) : 0
            }
            sys.prevTotal = total; sys.prevIdle = idle

            memFile.reload()
            const mt = memFile.text()
            const mTotal = parseFloat(mt.match(/MemTotal:\s+(\d+)/)[1])
            const mAvail = parseFloat(mt.match(/MemAvailable:\s+(\d+)/)[1])
            const usedKb = mTotal - mAvail
            sys.memFrac = usedKb / mTotal
            sys.memText = (usedKb / 1048576).toFixed(1) + "G/" + (mTotal / 1048576).toFixed(0) + "G"

            dfProc.running = true
        }
    }
}
