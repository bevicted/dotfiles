import QtQuick
import QtQuick.Layouts
import Quickshell

RowLayout {
    spacing: 8

    SystemClock {
        id: clock
        precision: SystemClock.Minutes
    }

    Text {
        text: Qt.formatDateTime(clock.date, "ddd dd MMM")
        color: "#a6adc8"
        font.family: "JetBrainsMono Nerd Font"
        font.pixelSize: 12
    }

    Text {
        text: Qt.formatDateTime(clock.date, "HH:mm")
        color: "#fab387"
        font.family: "JetBrainsMono Nerd Font"
        font.pixelSize: 12
        font.weight: Font.Medium
    }
}
