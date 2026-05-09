import QtQuick
import QtQuick.Layouts
import Quickshell.Hyprland

RowLayout {
    spacing: 6

    Repeater {
        model: Hyprland.workspaces

        delegate: Rectangle {
            id: pill
            required property var modelData

            implicitWidth: modelData.focused ? 26 : 10
            implicitHeight: 10
            radius: 5
            color: modelData.focused
                ? "#b4befe"
                : modelData.hasFullscreen ? "#cba6f7" : "#585b70"

            Behavior on implicitWidth {
                NumberAnimation { duration: 160; easing.type: Easing.OutCubic }
            }
            Behavior on color {
                ColorAnimation { duration: 160 }
            }

            MouseArea {
                anchors.fill: parent
                cursorShape: Qt.PointingHandCursor
                onClicked: Hyprland.dispatch("workspace " + pill.modelData.id)
            }
        }
    }
}
