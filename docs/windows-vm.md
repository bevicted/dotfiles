# Windows VM

## Arch host setup

This is an opt-in host setup, not part of `make arch-init`. It does not create
VMs, download installation media, or change existing guest/network definitions.
Windows licensing and guest installation are separate steps.

### Check the host first

```sh
lscpu
ls -l /dev/kvm
test -r /dev/kvm && test -w /dev/kvm
free -h
df -h /var/lib /home
```

Use an x86_64 host with Intel VT-x or AMD-V enabled in firmware and working KVM.
If `/dev/kvm` is absent, check firmware virtualization settings and the
`kvm_intel` or `kvm_amd` module before proceeding. Do not fix access by making
devices world-writable or running virt-manager as root; inspect the host's
udev/logind device-access policy instead.

Hardware virtualization alone does not establish Windows 11 eligibility.
Check Microsoft's [VM requirements](https://learn.microsoft.com/en-us/windows/whats-new/windows-11-requirements#virtual-machine-support)
and the applicable [supported processor lists](https://learn.microsoft.com/en-us/windows-hardware/design/minimum/windows-processor-requirements).
Windows 11 VMs require at least two virtual processors, 4 GiB RAM, 64 GiB disk,
UEFI with Secure Boot capability, and virtual TPM 2.0; the host processor must
also meet Microsoft's requirements. Do not bypass Windows eligibility checks.
The intended guest budget is one socket/four cores, 6 GiB RAM and a 128 GiB
sparse disk outside this repository. Leave RAM for the host; sparse disks can
grow to their full allocation, so monitor free space on the actual image
filesystem. Do not create the guest until that budget is available.

### Install and start libvirt

This guide uses the monolithic daemon arrangement documented by
[Arch's libvirt guide](https://wiki.archlinux.org/title/Libvirt).
Before running the target on an existing virtualization host, inspect:

```sh
systemctl list-units --all 'virt*d.service' 'virt*d.socket' 'libvirtd*'
systemctl list-unit-files 'virt*d.service' 'virt*d.socket' 'libvirtd*'
```

If modular drivers such as `virtqemud` or `virtnetworkd` are active or enabled,
stop here and plan a deliberate daemon migration; do not mix arrangements.
`virtlogd` and `virtlockd` are helpers used by the monolithic arrangement too.

From the repository root:

```sh
make vm-setup
make vm-setup
systemctl is-enabled libvirtd.service virtlogd.service
systemctl is-active libvirtd.service virtlogd.service
virt-host-validate qemu
```

The target uses pacman's `--needed`, verifies that both service unit files
exist, then enables/starts them. Repeating it does not redefine any VM or
network. If unit verification fails, inspect `pacman -Ql libvirt` and
`systemctl cat libvirtd.service virtlogd.service`; resolve package/daemon
compatibility rather than substituting modular units piecemeal. Interpret
`virt-host-validate` findings individually: KVM support is required, while
optional features such as IOMMU passthrough are not needed for this guest.
Packaged `libvirtd` may exit when idle and reactivate through its sockets;
after the successful system connection below, recheck its active state before
treating inactivity as a startup failure.

`dnsmasq` supplies libvirt-managed DHCP/DNS; do not enable `dnsmasq.service`.
`edk2-ovmf` supplies UEFI and `swtpm` supplies software TPM support. Arch's
Secure Boot firmware descriptor currently provides
`/usr/share/edk2/x64/OVMF_CODE.secboot.4m.fd` and the unpopulated
`/usr/share/edk2/x64/OVMF_VARS.4m.fd` template, not enrolled Microsoft keys.
Therefore this package list also includes `virt-firmware`: the selected
[offline key-enrollment method](https://wiki.archlinux.org/title/KVM#Secure_Boot)
is `virt-fw-vars --secure-boot --enroll-microsoft`, with `--input` pointing to
that template and `--output` to a **new, per-guest** VARS file outside Git.
Guest creation must attach that file with Secure Boot firmware and confirm
enrolled keys, not merely select a firmware name containing "secure". Do not
modify the shared template or overwrite an existing guest's NVRAM. Inspect
installed firmware descriptors and `virt-fw-vars --help` if package versions
change. No NVRAM or TPM state is created by this host target.

### Authorize the system connection

Use the desktop's polkit authentication agent, with the normal user account.
On Hyprland with `hyprpolkitagent` installed, if no authentication agent is
already running, start its installed user service from a terminal in the active
graphical session (no sudo):

```sh
systemctl --user start hyprpolkitagent.service
systemctl --user status hyprpolkitagent.service
journalctl --user -b -u hyprpolkitagent.service --no-pager -n 10
```

Expect `active (running)` and a `registered polkit agent for session` log entry.
This starts it for the current session only, not future logins. Logging out and
back in does not enable a disabled service; arrange one desktop agent's startup
separately if needed. Do not start a second agent alongside an existing one.
Then retry the system connection:

```sh
virsh -c qemu:///system list --all
virt-manager --connect qemu:///system
```

Confirm virt-manager displays the system QEMU/KVM connection, not
`qemu:///session`, and the same guest inventory as virsh. Arch's default polkit
policy prompts an administrator (normally a `wheel` member) for authentication.
If a terminal cannot show a prompt, use virt-manager in the desktop session
with a working polkit agent. If authorization fails, check `id`, the agent's
status, and `journalctl -b -u libvirtd.service -u polkit.service`. A newly changed
login/group state may require logging out and back in. Do not grant blanket
passwordless polkit access, change libvirt socket permissions, or add broad
group privileges just to silence an authorization failure.

### Start the default NAT network

First obtain a successful, authorized inventory:

```sh
virsh -c qemu:///system net-list --all
virsh -c qemu:///system net-info default
```

An authorization or connection error is **not** evidence that a network is
missing. If `default` exists, preserve its definition. Inspect
`virsh -c qemu:///system net-dumpxml default` and confirm it is the intended NAT
network before using it; do not replace a customized network with stock XML.

Only if the successful inventory has no `default` network, restore the packaged
definition (Arch currently installs it at the following path):

```sh
pacman -Ql libvirt | grep '/networks/default.xml$'
sudo virsh -c qemu:///system net-define /etc/libvirt/qemu/networks/default.xml
```

The installed XML may be readable only by root; authenticate with sudo for
this absent-network-only restoration rather than broadening file permissions.
If that XML is also missing, do not invent a network or copy another machine's
configuration. Inspect `pacman -Qkk libvirt`; extract only
`etc/libvirt/qemu/networks/default.xml` from the matching, verified libvirt
package archive into a temporary file outside Git, inspect it, then pass that
file to `net-define`. Use `mktemp -d` for a private extraction directory and
`bsdtar -xOf` to extract just that archive member, not the whole package into
the system. Never redefine an existing network, and do not reinstall
configuration over local changes.

For the intended NAT network, in virt-manager select the system connection,
open **Edit > Connection Details > Virtual Networks**, and select `default`.
Use **Start Network** if inactive, and enable **Autostart: On Boot**, then
**Apply**, if not already enabled. Preserve its existing XML. Equivalent CLI
operations follow; run only those not already satisfied:

```sh
# If net-info reports Active: no
virsh -c qemu:///system net-start default
# If net-info reports Autostart: no
virsh -c qemu:///system net-autostart default
virsh -c qemu:///system net-info default
virsh -c qemu:///system net-dumpxml default
ip address show virbr0
```

Expect an active, autostarted network with `<forward mode='nat'>` and a bridge
(normally `virbr0`; use the bridge in the actual XML). The packaged definition
uses `192.168.122.0/24`; check `ip route` for conflicts with LAN/VPN routes
before starting it. Libvirt manages its own dnsmasq process and NAT rules.
If startup fails, inspect `journalctl -b -u libvirtd.service`,
`sudo ss -luntp`, `ip route`, and the host's firewall rules (for nftables,
`sudo nft list ruleset`). Check port conflicts, subnet overlap, forwarding and
libvirt's firewall backend rather than disabling the firewall, flushing rules,
or starting standalone dnsmasq. See
[libvirt virtual networking](https://wiki.libvirt.org/VirtualNetworking.html).
Host-side checks cannot prove guest DHCP or outbound connectivity until a
guest exists; those checks belong to guest setup.

Before and after repeating setup, compare `virsh -c qemu:///system list --all`,
`virsh -c qemu:///system net-list --all`, and XML dumps of existing guests and
networks. Names and definitions must remain unchanged; verify services,
KVM validation, system connection and default NAT again. Dry runs or successful
package installation alone are not proof that the host is ready.
