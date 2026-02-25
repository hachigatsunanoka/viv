use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

/// Helper to get the app data directory, deduplicating error handling.
fn get_app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))
}

#[tauri::command]
pub async fn download_video(
    app: AppHandle,
    url: String,
    yt_dlp_path: Option<String>,
) -> Result<String, String> {
    if url.starts_with('-') {
        return Err("Invalid URL: cannot start with a dash".to_string());
    }

    let app_data_dir = get_app_data_dir(&app)?;
    let download_dir = app_data_dir.join("downloads");
    std::fs::create_dir_all(&download_dir)
        .map_err(|e| format!("download_video: failed to create download dir: {}", e))?;

    // Use a timestamp-based filename so we know exactly where the file ends up
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let output_path = download_dir.join(format!("{}.mp4", timestamp));
    let output_path_str = output_path.to_string_lossy().to_string();

    // Use configured path or fall back to "yt-dlp" in PATH
    let binary = yt_dlp_path.unwrap_or_else(|| "yt-dlp".to_string());

    let output = app
        .shell()
        .command(&binary)
        .args([
            "-f",
            "bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4/best",
            "--merge-output-format",
            "mp4",
            "-o",
            &output_path_str,
            "--no-playlist",
            &url,
        ])
        .output()
        .await
        .map_err(|e| format!("yt-dlp execution failed: {}. Is yt-dlp installed?", e))?;

    if output.status.success() {
        // Verify the file actually exists
        if output_path.exists() {
            Ok(output_path_str)
        } else {
            // Try to find any file with our timestamp prefix
            let prefix = format!("{}.", timestamp);
            if let Ok(entries) = std::fs::read_dir(&download_dir) {
                for entry in entries.flatten() {
                    if let Some(name) = entry.file_name().to_str() {
                        if name.starts_with(&prefix) {
                            return Ok(entry.path().to_string_lossy().to_string());
                        }
                    }
                }
            }
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!(
                "yt-dlp completed but output file not found. stderr: {}",
                stderr
            ))
        }
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("yt-dlp failed: {}", stderr))
    }
}

#[tauri::command]
pub async fn get_config(app: AppHandle) -> Result<String, String> {
    let app_data_dir = get_app_data_dir(&app)?;
    let config_path = app_data_dir.join("config.json");

    if config_path.exists() {
        std::fs::read_to_string(&config_path).map_err(|e| format!("Failed to read config: {}", e))
    } else {
        Ok("{}".to_string())
    }
}

#[tauri::command]
pub async fn save_config(app: AppHandle, config: String) -> Result<(), String> {
    let app_data_dir = get_app_data_dir(&app)?;
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("save_config: failed to create config dir: {}", e))?;
    let config_path = app_data_dir.join("config.json");

    std::fs::write(&config_path, config).map_err(|e| format!("Failed to write config: {}", e))
}

#[derive(serde::Deserialize)]
pub struct MediaEntry {
    pub id: String,
    #[serde(rename = "sourcePath")]
    pub source_path: String,
}

#[derive(serde::Serialize)]
pub struct LoadedMedia {
    pub id: String,
    #[serde(rename = "tempPath")]
    pub temp_path: String,
}

#[derive(serde::Serialize)]
pub struct LoadBoardResult {
    pub json: String,
    pub media: Vec<LoadedMedia>,
}

fn write_board_zip(
    file_path: &PathBuf,
    board_json: &str,
    media: &[MediaEntry],
) -> Result<(), String> {
    use std::io::{BufWriter, Write};
    use zip::write::SimpleFileOptions;
    use zip::ZipWriter;

    let file =
        std::fs::File::create(file_path).map_err(|e| format!("failed to create file: {}", e))?;
    let mut zip = ZipWriter::new(BufWriter::new(file));
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);

    // Write board.json
    zip.start_file("board.json", options)
        .map_err(|e| format!("Failed to start board.json: {}", e))?;
    zip.write_all(board_json.as_bytes())
        .map_err(|e| format!("Failed to write board.json: {}", e))?;

    // Write media files
    for entry in media {
        let source = PathBuf::from(&entry.source_path);
        if !source.exists() {
            eprintln!(
                "Warning: media source not found, skipping: {}",
                entry.source_path
            );
            continue;
        }

        let ext = source
            .extension()
            .map(|e| e.to_string_lossy().to_string())
            .unwrap_or_else(|| "bin".to_string());
        let archive_name = format!("media/{}.{}", entry.id, ext);

        zip.start_file(&archive_name, options)
            .map_err(|e| format!("Failed to start {}: {}", archive_name, e))?;

        let data = std::fs::read(&source)
            .map_err(|e| format!("Failed to read {}: {}", entry.source_path, e))?;
        zip.write_all(&data)
            .map_err(|e| format!("Failed to write {}: {}", archive_name, e))?;
    }

    zip.finish()
        .map_err(|e| format!("Failed to finalize ZIP: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn save_board_archive(
    app: AppHandle,
    state: tauri::State<'_, crate::AppState>,
    board_json: String,
    media: Vec<MediaEntry>,
) -> Result<(), String> {
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = tokio::sync::oneshot::channel::<Option<tauri_plugin_dialog::FilePath>>();
    app.dialog()
        .file()
        .add_filter("Viv Board", &["viv"])
        .save_file(move |path| {
            let _ = tx.send(path);
        });

    let file_path = match rx.await.unwrap_or(None) {
        Some(path) => match path.into_path() {
            Ok(p) => p,
            Err(_) => return Err("Failed to resolve save dialog path".to_string()),
        },
        None => return Err("User cancelled save dialog".to_string()),
    };

    write_board_zip(&file_path, &board_json, &media)?;

    // Store the successfully saved path to AppState
    if let Ok(mut current_path) = state.current_board_path.lock() {
        *current_path = Some(file_path.clone());
    }

    Ok(())
}

#[tauri::command]
pub async fn save_current_board(
    app: AppHandle,
    state: tauri::State<'_, crate::AppState>,
    board_json: String,
    media: Vec<MediaEntry>,
) -> Result<(), String> {
    let file_path = {
        let path_guard = state
            .current_board_path
            .lock()
            .map_err(|_| "Failed to lock state")?;
        path_guard.clone()
    };

    // If no path is saved, fallback to 'save as' dialog behavior by delegating to save_board_archive
    let file_path = match file_path {
        Some(path) => path,
        None => return save_board_archive(app, state, board_json, media).await,
    };

    write_board_zip(&file_path, &board_json, &media)?;

    Ok(())
}

#[tauri::command]
pub async fn load_board_archive(
    app: AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<LoadBoardResult, String> {
    use std::io::Read;
    use tauri_plugin_dialog::DialogExt;
    use zip::ZipArchive;

    let (tx, rx) = tokio::sync::oneshot::channel::<Option<tauri_plugin_dialog::FilePath>>();
    app.dialog()
        .file()
        .add_filter("Viv Board", &["viv"])
        .pick_file(move |path| {
            let _ = tx.send(path);
        });

    let file_path = match rx.await.unwrap_or(None) {
        Some(path) => match path.into_path() {
            Ok(p) => p,
            Err(_) => return Err("Failed to resolve open dialog path".to_string()),
        },
        None => return Err("User cancelled open dialog".to_string()),
    };

    let file =
        std::fs::File::open(&file_path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mut archive =
        ZipArchive::new(file).map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

    // Read board.json
    let board_json = {
        let mut entry = archive
            .by_name("board.json")
            .map_err(|e| format!("board.json not found in archive: {}", e))?;
        let mut contents = String::new();
        entry
            .read_to_string(&mut contents)
            .map_err(|e| format!("Failed to read board.json: {}", e))?;
        contents
    };

    // Extract media files to temp directory
    let app_data_dir = get_app_data_dir(&app)?;
    let media_dir = app_data_dir.join("temp_media");
    std::fs::create_dir_all(&media_dir)
        .map_err(|e| format!("Failed to create temp media dir: {}", e))?;

    let mut loaded_media = Vec::new();

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read archive entry: {}", e))?;

        let name = entry.name().to_string();
        if !name.starts_with("media/") || name == "media/" {
            continue;
        }

        // Extract filename from "media/<id>.<ext>"
        let file_name = name.strip_prefix("media/").unwrap_or(&name);
        let id = file_name
            .rsplit_once('.')
            .map(|(stem, _)| stem.to_string())
            .unwrap_or_else(|| file_name.to_string());

        let temp_path = media_dir.join(file_name);
        let mut data = Vec::new();
        entry
            .read_to_end(&mut data)
            .map_err(|e| format!("Failed to read media {}: {}", name, e))?;

        std::fs::write(&temp_path, &data)
            .map_err(|e| format!("Failed to write temp media {}: {}", file_name, e))?;

        loaded_media.push(LoadedMedia {
            id,
            temp_path: temp_path.to_string_lossy().to_string(),
        });
    }

    // Update currently opened path
    if let Ok(mut current_path) = state.current_board_path.lock() {
        *current_path = Some(file_path.clone());
    }

    Ok(LoadBoardResult {
        json: board_json,
        media: loaded_media,
    })
}

#[tauri::command]
pub fn get_current_file_path(state: tauri::State<'_, crate::AppState>) -> Option<String> {
    if let Ok(path) = state.current_board_path.lock() {
        path.as_ref().map(|p| p.to_string_lossy().to_string())
    } else {
        None
    }
}
