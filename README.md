# viv

![viv](assets/images/viv_logo.png)

An infinite canvas whiteboard for video and image annotation, built with Tauri 2 + React 19.

## Features

### Whiteboard
- Infinite canvas with smooth pan and zoom
- Node types: **video**, **image**, **text**, **markdown**
- Drag-and-drop or URL-paste to add media
- Multi-select, alignment (horizontal / vertical / grid), and focus
- Backdrop groups: press **B** to wrap selected nodes in a labeled backdrop
- Connections between nodes with customizable style (color, width, dash pattern, arrows)
- Pureref-style board save / load (`.viv` archive format, embeds media)
- Dark / light theme

### Video / Image Annotation
- Full-screen overlay for video or image review
- **Drawing tools**: Brush, Grunge brush (texture stamp), Eraser — per-tool size, opacity, color
- **Onion skin**: ghosting of previous frames (1–5 frames)
- Per-frame annotations stored in the node, with undo / redo
- Quick color correction panel (saturation, contrast, brightness)
- Flip horizontal, reset view, zoom and pan
- Comments with optional frame tagging and seek-on-click
- Export snapshot (with color correction) back to whiteboard
- Export PDF with annotation baked in

### Video Player
- Frame-accurate playback
- A-B loop with in / out point markers on timeline
- Playback rate control

### Plugins
- **yt-dlp integration**: paste a video URL to download and add to the board
- **Nano Banana** (Google Gemini): AI image generation from selected nodes, requires API key

## Controls

### Mouse
| Action | Result |
|---|---|
| Middle drag | Pan the board |
| Right drag | Zoom in / out |
| Scroll wheel | Zoom in / out |
| Drag background | Box select |
| Double-click node | Focus / edit text |

### Keyboard
| Key | Action |
|---|---|
| `Delete` / `Backspace` | Delete selected nodes |
| `F` | Focus on selected nodes |
| `Enter` | Open selected video / image |
| `B` | Create backdrop around selection |
| `Alt + H` | Align nodes horizontally |
| `Alt + V` | Align nodes vertically |
| `Alt + G` | Arrange nodes in grid |
| `Ctrl + S` | Save board |
| `Ctrl + Shift + S` | Save board as… |
| `Ctrl + O` | Load board |
| `Ctrl + T` | Toggle always on top |
| `Ctrl + Q` | Close application |
| `?` | Show shortcut cheat sheet |

## Development

```bash
# Install dependencies
npm install

# Start dev server (opens Tauri window)
npm run tauri dev

# Build
npm run tauri build
```

## License

[MIT](LICENSE)