import QtQuick
import QtQuick.Layouts
import Quickshell

PanelWindow {
    id: bar

    required property var modelData
    screen: modelData

    // matches hyprland gaps_in / rounding / border_size
    readonly property int gap: 3
    readonly property int barHeight: 30
    readonly property int rounding: 10

    anchors {
        top: true
        left: true
        right: true
    }

    margins {
        top: gap
        left: gap
        right: gap
    }

    implicitHeight: barHeight
    exclusiveZone: barHeight + gap * 2
    color: "transparent"

    Rectangle {
        anchors.fill: parent
        color: "#1e1e2e"
        opacity: 0.96
        radius: bar.rounding
        border.width: 1
        border.color: "#595959"

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 14
            anchors.rightMargin: 14
            spacing: 12

            Workspaces {
                Layout.alignment: Qt.AlignVCenter
            }

            Item { Layout.fillWidth: true }

            Clock {
                Layout.alignment: Qt.AlignVCenter
            }
        }
    }
}
