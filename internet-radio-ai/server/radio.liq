#!/usr/bin/env liquidsoap

# --- Settings ---
set("log.file.path", "radio.log")
set("server.telnet", true)
set("server.telnet.bind_addr", "127.0.0.1")
set("server.telnet.port", 1234)

# --- Sources ---

# Fallback playlist (songs for when no requests exist)
default_playlist = playlist("/Users/marvin/Music/radio-fallback")

# Dynamic queue for user requests (filled via telnet/API)
request_queue = request.queue(id="requests")

# Advertising source
# This will play files from the ads directory
ads = playlist("/Users/marvin/Music/radio-ads")

# --- Scheduling Logic ---

# We want to mix requests and fallbacks
# If request_queue is empty, play from default_playlist
radio = fallback(track_sensitive=false, [request_queue, default_playlist])

# Schedule ads every 15 minutes (approx)
# For simplicity, we can use a randomized switch or a time-based one
# Here we use a switch to play an ad after every 4 tracks from the main source
radio = rotate(weights=[1, 4], [ads, radio])

# --- Output ---

# Output to an Icecast server (assuming one is running locally)
output.icecast(%mp3,
  host = "localhost", port = 8000,
  password = "hackme", mount = "radio.mp3",
  radio)

# Also output to local speaker for monitoring (optional)
# output.ao(radio)
