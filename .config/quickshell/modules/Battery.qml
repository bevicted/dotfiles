import QtQuick
import Quickshell.Services.UPower

Text {
    id: root

    readonly property var battery: UPower.displayDevice

    visible: battery.ready && battery.isPresent && battery.isLaptopBattery
    text: "BAT " + Math.round(battery.percentage) + "%"
    color: battery.percentage <= 20 ? "#f38ba8" : "#a6e3a1"
    font.family: "JetBrainsMono Nerd Font"
    font.pixelSize: 12
}
