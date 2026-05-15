import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Wayland
import Quickshell.Services.Notifications

PanelWindow {
    id: root

    required property var server

    anchors {
        top: true
        right: true
    }
    margins {
        top: 32
        right: 8
    }

    implicitWidth: 360
    implicitHeight: Math.max(1, column.implicitHeight)
    color: "transparent"
    exclusionMode: ExclusionMode.Ignore
    WlrLayershell.layer: WlrLayer.Overlay
    focusable: false
    visible: toasts.count > 0

    ListModel { id: toasts }

    function pushToast(n) {
        toasts.append({ notif: n })
    }

    Connections {
        target: root.server
        function onNotification(n) {
            n.tracked = true
            root.pushToast(n)
        }
    }

    ColumnLayout {
        id: column
        anchors.fill: parent
        spacing: 8

        Repeater {
            model: toasts

            delegate: Rectangle {
                id: toast
                required property int index
                required property var notif

                readonly property int urgency: notif.urgency
                readonly property color accent:
                    urgency === NotificationUrgency.Critical ? "#f38ba8"
                    : urgency === NotificationUrgency.Low ? "#6c7086"
                    : "#89b4fa"

                Layout.fillWidth: true
                implicitHeight: body.y + body.implicitHeight + 12
                radius: 10
                color: "#1e1e2e"
                opacity: 0.92
                border.width: 1
                border.color: accent

                Rectangle {
                    width: 3
                    height: parent.height - 16
                    x: 0
                    y: 8
                    radius: 2
                    color: toast.accent
                }

                Text {
                    id: appName
                    x: 14
                    y: 10
                    text: toast.notif.appName
                    color: toast.accent
                    font.family: "JetBrainsMono Nerd Font"
                    font.pixelSize: 10
                    font.weight: Font.Medium
                }

                Text {
                    id: summary
                    anchors {
                        top: appName.bottom
                        topMargin: 2
                        left: appName.left
                        right: parent.right
                        rightMargin: 12
                    }
                    text: toast.notif.summary
                    color: "#cdd6f4"
                    font.family: "JetBrainsMono Nerd Font"
                    font.pixelSize: 12
                    font.weight: Font.Bold
                    wrapMode: Text.WordWrap
                }

                Text {
                    id: body
                    anchors {
                        top: summary.bottom
                        topMargin: 3
                        left: appName.left
                        right: parent.right
                        rightMargin: 12
                    }
                    text: toast.notif.body
                    visible: text.length > 0
                    color: "#bac2de"
                    font.family: "JetBrainsMono Nerd Font"
                    font.pixelSize: 11
                    wrapMode: Text.WordWrap
                    maximumLineCount: 4
                    elide: Text.ElideRight
                }

                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: toasts.remove(toast.index)
                }

                Timer {
                    interval: toast.urgency === NotificationUrgency.Critical ? 12000 : 5000
                    running: true
                    onTriggered: {
                        if (toast.index >= 0 && toast.index < toasts.count)
                            toasts.remove(toast.index)
                    }
                }
            }
        }
    }
}
