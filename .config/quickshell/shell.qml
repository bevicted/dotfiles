import QtQuick
import Quickshell
import "modules"

Scope {
    Variants {
        model: Quickshell.screens

        Bar {}
    }
}
