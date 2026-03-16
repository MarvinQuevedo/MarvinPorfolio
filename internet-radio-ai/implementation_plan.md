# Internet Radio AI Implementation Plan

This project aims to create an automated internet radio station that integrates YouTube Music, user requests, real-time messaging, and automated advertising.

## User Review Required

> [!IMPORTANT]
> **Streaming Server Requirements**: This project relies on `liquidsoap` and `icecast2`. These need to be installed on the host system. I will provide instructions for simulation/setup.
> **YouTube Music Integration**: We will use `yt-dlp` to fetch audio from YouTube. This requires the `yt-dlp` binary to be present.

## Proposed Changes

### [Backend]
Summary: A Node.js server to manage requests, ads, and orchestration, alongside a Liquidsoap script for the core audio engine.

#### [NEW] [radio.liq](file:///Users/marvin/Projects/MarvinPorfolio/internet-radio-ai/server/radio.liq)
Liquidsoap script to:
- Define the main playlist (fallback).
- Handle a dynamic queue for user requests.
- Schedule advertising breaks.
- Output an Icecast-compatible stream.

#### [NEW] [server.ts](file:///Users/marvin/Projects/MarvinPorfolio/internet-radio-ai/server/src/server.ts)
Node.js entry point using Express and Socket.io to:
- Expose an API for song requests.
- Handle real-time user messages.
- Communicate with Liquidsoap (via telnet/socket) to push new tracks.

### [Frontend]
Summary: A modern, premium React application for the radio listener.

#### [MODIFY] [App.tsx](file:///Users/marvin/Projects/MarvinPorfolio/internet-radio-ai/client/src/App.tsx)
- Add a sleek audio player that connects to the stream.
- Implement a "Request Song" form.
- Implement a "Live Chat" component.

## Verification Plan

### Automated Tests
- Run `npm test` in the server directory (once tests are added) to verify metadata parsing and request handling logic.
- Basic smoke test for the Liquidsoap script: `liquidsoap --check server/radio.liq`.

### Manual Verification
1.  Start the Liquidsoap engine and verify the stream URL is accessible via VLC or another player.
2.  Open the web client, send a song request, and verify it appears in the queue.
3.  Observe the ad insertion logic by lowering the ad interval for testing.
4.  Verify messages are broadcasted to all connected clients in real-time.
