# home network

debugging notes for the LAN at `192.168.1.0/24`. verify values before pasting blindly — MACs, prefixes, and the v6 prefix rotate.

## topology

| device | ip | mac | role |
|---|---|---|---|
| router (ISP-supplied gateway, limited firmware) | `192.168.1.1` | `<router MAC>` | gateway, DHCP, DHCP option 6 advertises HA as DNS |
| home assistant (raspberry pi) | `192.168.1.254` | `<HA MAC>` | HA + AdGuard add-on (v4-only on `:53`) |

`192.168.1.254` is statically reserved for HA in the router (`Local Network → Static leases`, keyed on MAC). DHCP pool starts at `.100`, ends well below `.254`. the router's DHCP DNS option points at `192.168.1.254`, so every v4 client uses AdGuard.

ipv6 is **disabled at the router**. the firmware doesn't expose RDNSS or the local forwarder, so an enabled v6 stack means the router advertises itself as v6 DNS and forwards to the ISP, bypassing AdGuard. disabling v6 wholesale is the only LAN-wide fix this firmware allows. if you re-enable v6 later (matter/thread), expect ad-blocking to leak on v6 paths.

## discovering values

```sh
ip route | grep default        # v4 gateway
ip -6 route | grep default     # v6 gateway (none if v6 off)
ip -br addr                    # interface summary
ip neigh show                  # ARP / v6 neighbor cache → MACs of recent peers
```

a host's MAC after a single ping (populates the neighbor cache):

```sh
ping -c1 -W1 192.168.1.X >/dev/null; ip neigh show 192.168.1.X
ping -6 -c1 <v6-addr> >/dev/null; ip neigh show <v6-addr>
```

raspberry pi OUIs include `dc:a6:32:`, `b8:27:eb:`, `e4:5f:01:`.

finding HA without knowing its ip:

```sh
getent hosts homeassistant.local
resolvectl query homeassistant.local
```

quick LAN service sweep (no nmap needed):

```sh
for i in $(seq 1 254); do (timeout 0.5 bash -c "echo > /dev/tcp/192.168.1.$i/8123" 2>/dev/null && echo ".$i HA UI") & done; wait
for i in $(seq 1 254); do (timeout 0.5 bash -c "echo > /dev/tcp/192.168.1.$i/53"   2>/dev/null && echo ".$i DNS")   & done; wait
```

## common diagnostics

```sh
networkctl status enp6s0                 # active .network file, addresses, gateway
resolvectl status                        # current resolver per link, RA-supplied DNS
journalctl -u systemd-networkd -n 50     # rename events, lease changes, reconfigures
```

## escape hatch: static IP

DHCP can hand out the wrong lease (e.g. some persistent client identifier ends up matching HA's reservation, and you get `.254` — colliding with HA, blackholing traffic to the router UI and AdGuard). drop a static config that wins lex order over the catch-all `20-ethernet.network`.

`/etc/systemd/network/10-enp6s0.network`:

```ini
[Match]
Name=enp6s0

[Link]
RequiredForOnline=routable

[Network]
Address=192.168.1.50/24
DNS=192.168.1.254
MulticastDNS=yes
IPv6AcceptRA=yes

[Route]
Gateway=192.168.1.1
Metric=100

[IPv6AcceptRA]
RouteMetric=100
```

apply:

```sh
sudo networkctl reload                              # re-scan .network files from disk
sudo networkctl reconfigure enp6s0                  # re-apply to interface
networkctl status enp6s0 | grep 'Network File'      # confirm 10-enp6s0.network is active
```

`reconfigure` alone does **not** pick up new files; `reload` is required first. `systemctl restart systemd-networkd` re-scans on restart but keeps existing DHCP leases until they expire on their own — also insufficient when fighting an active conflict.

revert when done:

```sh
sudo rm /etc/systemd/network/10-enp6s0.network
sudo networkctl reload && sudo networkctl reconfigure enp6s0
```

## verifying AdGuard is actually filtering

`resolvectl query` goes through whatever resolver the system picked, which may bypass AdGuard. query AdGuard directly over UDP/53:

```sh
python3 - <<'PY'
import socket, struct
def q(srv, name):
    h = struct.pack('!HHHHHH', 0x1234, 0x0100, 1,0,0,0)
    qn = b''.join(bytes([len(p)])+p.encode() for p in name.split('.'))+b'\x00'
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.settimeout(2)
    s.sendto(h+qn+struct.pack('!HH',1,1), (srv,53))
    d,_ = s.recvfrom(512)
    rc = {0:'NOERROR',2:'SERVFAIL',3:'NXDOMAIN'}.get(d[3]&0xF, '?')
    ip = ''
    if (d[3]&0xF)==0 and struct.unpack('!H',d[6:8])[0]:
        i=12
        while d[i]: i+=d[i]+1
        i+=5
        while d[i] and d[i]<0xc0: i+=d[i]+1
        i+=10
        rdlen = struct.unpack('!H',d[i:i+2])[0]; i+=2
        if rdlen==4: ip='.'.join(str(b) for b in d[i:i+4])
    print(f'{name:42s} {rc:10s} {ip}')
for name in ['github.com','pagead2.googlesyndication.com','track.adform.net','google-analytics.com']:
    q('192.168.1.254', name)
PY
```

expected: `github.com` → real ip; tracker domains → `0.0.0.0`.

caveat: do not use `doubleclick.net` alone — google now serves it from their own CDN, so an unfiltered answer still looks like a google ip. include a non-google tracker like `track.adform.net`.

## known quirks

- **router firmware exposes only**: device v4 / subnet / v6 on-off / DHCP toggle / DNS option / pool / lease time / static leases. no DNS forwarder, no RDNSS, no per-zone firewall.
- **HA OS auto-merges RA-supplied DNS** into v6 settings on save. setting v6 DNS to `::1` will silently regain the router's v6 next save. harmless if v6 is off (or if the router is forwarding to AdGuard).
- **AdGuard add-on listens v4-only** by default. v6 path tests against HA hit `connection refused`. fix would be `bind_hosts` in `AdGuardHome.yaml` inside the addon data dir, accessed via the File Editor / SSH addon. not done while v6 is off.
- **ISP rotates IPv6 prefix.** HA accumulates stale v6 DNS entries from previous prefixes (`Settings → System → Network → IPv6 → DNS Servers`). prune periodically if v6 is back on.
- **systemd-networkd sends a DUID, not the MAC,** as DHCP client identifier. routers that key reservations on DUID can hand HA's lease to a freshly-installed machine if the DUID happens to match. this router keys on MAC, so verify the static lease MAC field matches HA's actual MAC rather than a previous install's identifier — that bug was the root cause of the whole IP-conflict episode.
- **Path MTU is 1492 (PPPoE WAN).** kernel PMTU discovery handles it for v4; if TLS handshakes start aborting with `unexpected eof while reading`, suspect MSS clamping isn't happening on the router and lower local MTU as a workaround: `ip link set enp6s0 mtu 1492`.
