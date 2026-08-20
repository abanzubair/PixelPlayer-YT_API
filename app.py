import sys
import json
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os
import subprocess
import time

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

STREAM_CACHE = {}

def get_audio_stream_url(video_id):
    now = time.time()
    if video_id in STREAM_CACHE:
        cached_url, cached_time = STREAM_CACHE[video_id]
        if now - cached_time < 3600:
            return cached_url

    yt_dlp_path = os.path.join(CURRENT_DIR, "yt-dlp")
    cmd = [yt_dlp_path, "-g", "-f", "bestaudio/best", f"https://www.youtube.com/watch?v={video_id}"]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if result.returncode == 0:
            urls = [line.strip() for line in result.stdout.strip().split("\n") if line.strip().startswith("http")]
            if urls:
                url = urls[0]
                STREAM_CACHE[video_id] = (url, now)
                return url
    except Exception as e:
        print(f"Error resolving stream for {video_id}: {e}")
    return None

from ytmusicapi import YTMusic

try:
    if os.path.exists("browser.json"):
        yt = YTMusic("browser.json")
        print("Initialized YTMusic with browser.json authentication.")
    elif os.path.exists("oauth.json"):
        yt = YTMusic("oauth.json")
        print("Initialized YTMusic with oauth.json authentication.")
    else:
        yt = YTMusic()
        print("Initialized YTMusic in unauthenticated mode.")
except Exception as e:
    print(f"Warning initializing auth: {e}. Falling back to unauthenticated YTMusic.")
    yt = YTMusic()


def extract_thumbnail(thumbnails):
    if not thumbnails:
        return ""
    return thumbnails[-1].get("url", "")


def format_track_item(item):
    if not item or not isinstance(item, dict):
        return None
    
    video_id = item.get("videoId")
    if not video_id:
        return None

    artists = item.get("artists")
    artist_names = []
    if isinstance(artists, list):
        artist_names = [a.get("name", "") for a in artists if isinstance(a, dict) and a.get("name")]
    elif isinstance(artists, str):
        artist_names = [artists]

    album_name = ""
    album = item.get("album")
    if isinstance(album, dict):
        album_name = album.get("name", "")
    elif isinstance(album, str):
        album_name = album

    thumbnails = item.get("thumbnails", [])
    thumbnail_url = extract_thumbnail(thumbnails)
    if "w60-h60" in thumbnail_url or "w120-h120" in thumbnail_url:
        thumbnail_url = thumbnail_url.replace("w60-h60", "w540-h540").replace("w120-h120", "w540-h540")

    return {
        "videoId": video_id,
        "title": item.get("title", "Unknown Title"),
        "artist": ", ".join(artist_names) if artist_names else "Unknown Artist",
        "artists": artist_names,
        "album": album_name,
        "duration": item.get("duration", "--:--"),
        "duration_seconds": item.get("duration_seconds", 0),
        "thumbnail": thumbnail_url,
        "isExplicit": item.get("isExplicit", False),
        "views": item.get("views", "")
    }


class MusicPlayerHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def send_json_response(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        body = json.dumps(data).encode("utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/api/stream":
            video_id = query.get("videoId", [""])[0].strip() or query.get("id", [""])[0].strip()
            if not video_id:
                self.send_json_response({"error": "videoId required"}, status=400)
                return
            url = get_audio_stream_url(video_id)
            if url:
                if query.get("redirect", ["0"])[0] == "1":
                    self.send_response(302)
                    self.send_header("Location", url)
                    self.end_headers()
                else:
                    self.send_json_response({"videoId": video_id, "url": url})
            else:
                self.send_json_response({"error": "Failed to resolve stream"}, status=404)
            return

        elif path == "/api/search":
            q = query.get("q", [""])[0].strip()
            filter_type = query.get("filter", ["songs"])[0].strip()
            if not q:
                self.send_json_response({"results": []})
                return

            try:
                valid_filter = filter_type if filter_type in ["songs", "videos"] else "songs"
                raw_results = yt.search(q, filter=valid_filter)
                results = []
                for item in raw_results:
                    formatted = format_track_item(item)
                    if formatted:
                        results.append(formatted)
                self.send_json_response({"results": results})
            except Exception as e:
                print(f"Error in /api/search: {e}")
                self.send_json_response({"error": str(e), "results": []}, status=500)
            return

        elif path == "/api/suggestions":
            q = query.get("q", [""])[0].strip()
            if not q:
                self.send_json_response({"suggestions": []})
                return
            try:
                suggestions = yt.get_search_suggestions(q)
                self.send_json_response({"suggestions": suggestions})
            except Exception as e:
                self.send_json_response({"suggestions": []})
            return

        elif path == "/api/trending":
            genre = query.get("genre", ["Top Hits"])[0].strip()
            try:
                search_query = f"{genre} popular songs" if genre != "Top Hits" else "Top trending songs"
                raw_results = yt.search(search_query, filter="songs")
                results = []
                for item in raw_results:
                    formatted = format_track_item(item)
                    if formatted:
                        results.append(formatted)
                self.send_json_response({"results": results})
            except Exception as e:
                print(f"Error in /api/trending: {e}")
                self.send_json_response({"error": str(e), "results": []}, status=500)
            return

        elif path == "/api/home":
            try:
                raw_home = yt.get_home(limit=10)
                sections = []
                for section in raw_home:
                    title = section.get("title") or "Recommended"
                    contents = section.get("contents", [])
                    items = []
                    for item in contents:
                        formatted = format_track_item(item)
                        if formatted:
                            items.append(formatted)
                    if items:
                        sections.append({
                            "title": title,
                            "items": items
                        })
                self.send_json_response({"sections": sections})
            except Exception as e:
                print(f"Error in /api/home: {e}")
                self.send_json_response({"error": str(e), "sections": []}, status=500)
            return

        elif path == "/api/queue":
            video_id = query.get("videoId", [""])[0].strip() or query.get("id", [""])[0].strip()
            if not video_id:
                self.send_json_response({"tracks": []})
                return
            try:
                radio = query.get("radio", ["1"])[0] == "1"
                watch_data = yt.get_watch_playlist(videoId=video_id, limit=50, radio=radio)
                tracks = []
                for item in watch_data.get("tracks", []):
                    formatted = format_track_item(item)
                    if formatted and formatted["videoId"] != video_id:
                        tracks.append(formatted)
                
                lyrics_browse_id = watch_data.get("lyrics")
                self.send_json_response({
                    "tracks": tracks,
                    "lyricsBrowseId": lyrics_browse_id
                })
            except Exception as e:
                print(f"Error in /api/queue: {e}")
                self.send_json_response({"tracks": []})
            return

        elif path == "/api/lyrics":
            video_id = query.get("videoId", [""])[0].strip()
            lyrics_id = query.get("lyricsId", [""])[0].strip()
            
            try:
                if not lyrics_id and video_id:
                    watch_data = yt.get_watch_playlist(videoId=video_id)
                    lyrics_id = watch_data.get("lyrics")
                
                if lyrics_id:
                    lyrics_data = yt.get_lyrics(lyrics_id)
                    self.send_json_response({"lyrics": lyrics_data.get("lyrics", ""), "source": lyrics_data.get("source", "")})
                else:
                    self.send_json_response({"lyrics": "No lyrics available for this song."})
            except Exception as e:
                print(f"Error in /api/lyrics: {e}")
                self.send_json_response({"lyrics": "Unable to load lyrics."})
            return

        if path == "/" or path == "/index.html":
            self.path = "/static/index.html"
        
        return super().do_GET()


def run(port=8000):
    os.chdir(CURRENT_DIR)
    server_address = ("0.0.0.0", port)
    httpd = HTTPServer(server_address, MusicPlayerHandler)
    print(f"\n=======================================================")
    print(f"🎵 YouTube Music Player Web App is running!")
    print(f"👉 Listening on http://0.0.0.0:{port}")
    print(f"=======================================================\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    run(port)
