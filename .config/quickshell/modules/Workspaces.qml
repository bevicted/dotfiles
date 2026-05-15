import QtQuick
import QtQuick.Layouts
import Quickshell.Hyprland

RowLayout {
    spacing: 10

    Repeater {
        model: Hyprland.workspaces

        delegate: Text {
            id: ws
            required property var modelData

            readonly property bool focused: modelData.focused
            readonly property bool occupied: (modelData.toplevels?.values?.length ?? 0) > 0

            text: modelData.id
            font.family: "JetBrainsMono Nerd Font"
            font.pixelSize: 12
            font.weight: focused ? Font.Bold : Font.Normal
            color: focused
                ? "#cdd6f4"
                : occupied ? "#a6adc8" : "#6c7086"

            Behavior on color {
                ColorAnimation { duration: 120 }
            }

            MouseArea {
                anchors.fill: parent
                cursorShape: Qt.PointingHandCursor
                onClicked: Hyprland.dispatch("workspace " + ws.modelData.id)
            }
        }
    }
}
