# macOS Auto-Start

Arc Networth can run as a LaunchAgent so the LAN app comes back after login.

This is optional and intended for a trusted personal machine on a trusted local
network.

## Example

Create `~/Library/LaunchAgents/com.example.arc-networth.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.example.arc-networth</string>

  <key>WorkingDirectory</key>
  <string>/absolute/path/to/arc-networth</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>cd /absolute/path/to/arc-networth &amp;&amp; npm run serve:lan</string>
  </array>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
```

Load it:

```bash
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.example.arc-networth.plist
launchctl enable "gui/$(id -u)/com.example.arc-networth"
launchctl kickstart -k "gui/$(id -u)/com.example.arc-networth"
```
