import QtQuick
import QtQuick.Layouts
import Quickshell

PanelWindow {
    id: bar

    required property var modelData
    screen: modelData

    readonly property int barHeight: 24

    anchors {
        top: true
        left: true
        right: true
    }

    implicitHeight: barHeight
    exclusiveZone: barHeight
    color: "transparent"

    Rectangle {
        anchors.fill: parent
        color: "#1e1e2e"
        opacity: 0.85

        Rectangle {
            anchors {
                left: parent.left
                right: parent.right
                bottom: parent.bottom
            }
            height: 1
            color: "#45475a"
            opacity: 0.5
        }

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 10
            anchors.rightMargin: 10
            spacing: 16

            Workspaces {
                Layout.alignment: Qt.AlignVCenter
            }

            Item { Layout.fillWidth: true }

            Microphone {
                Layout.alignment: Qt.AlignVCenter
            }

            Volume {
                Layout.alignment: Qt.AlignVCenter
            }

            Clock {
                Layout.alignment: Qt.AlignVCenter
            }
        }
    }
}
