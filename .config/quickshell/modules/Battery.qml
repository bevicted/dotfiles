import QtQuick
import Quickshell.Services.UPower

Text {
    id: root

    readonly property var battery: UPower.displayDevice
    readonly property int percentage: Math.round(battery.percentage * 100)

    visible: battery.ready && battery.isPresent && battery.isLaptopBattery
    text: "BAT " + percentage + "%"
    color: percentage <= 20 ? "#f38ba8" : "#a6e3a1"
    font.family: "JetBrainsMono Nerd Font"
    font.pixelSize: 12
}
