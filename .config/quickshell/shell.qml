import Quickshell
import Quickshell.Hyprland
import Quickshell.Services.Notifications
import "modules"

Scope {
    id: app

    NotificationServer {
        id: notifServer
        bodySupported: true
        imageSupported: true
        actionsSupported: true
    }

    Variants {
        model: Quickshell.screens

        Bar {}
    }

    NotificationToasts {
        server: notifServer
    }

    ControlCenter {
        id: controlCenter
        server: notifServer
    }

    GlobalShortcut {
        appid: "quickshell"
        name: "controlcenter"
        onPressed: controlCenter.toggle()
    }
}
