import QtQuick
import QtQuick.Layouts
import Quickshell

RowLayout {
    spacing: 10

    SystemClock {
        id: clock
        precision: SystemClock.Minutes
    }

    Text {
        text: Qt.formatDateTime(clock.date, "ddd dd MMM")
        color: "#bac2de"
        font.family: "JetBrainsMono Nerd Font"
        font.pixelSize: 12
    }

    Text {
        text: Qt.formatDateTime(clock.date, "HH:mm")
        color: "#cdd6f4"
        font.family: "JetBrainsMono Nerd Font"
        font.pixelSize: 13
        font.weight: Font.Medium
    }
}
