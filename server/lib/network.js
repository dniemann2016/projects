import os from "node:os";

// Finds this machine's LAN IPv4 address (e.g. 192.168.1.23) so the app can
// be opened from other devices — phone, tablet, another laptop — on the
// same WiFi/network, without any cloud server involved.
export function getLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}
