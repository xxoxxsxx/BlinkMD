use serde::Serialize;
use std::{fs, io, path::PathBuf};

#[tauri::command]
pub fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FilePayload {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileCommandError {
    pub code: &'static str,
    pub message: String,
}

type FileCommandResult<T> = Result<T, FileCommandError>;

fn invalid_path_error() -> FileCommandError {
    FileCommandError {
        code: "INVALID_PATH",
        message: "Invalid file path. Please choose a valid path.".to_string(),
    }
}

fn normalize_path(path: String) -> FileCommandResult<PathBuf> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(invalid_path_error());
    }
    Ok(PathBuf::from(trimmed))
}

fn to_io_error(action: &'static str, error: io::Error) -> FileCommandError {
    let (code, detail) = match error.kind() {
        io::ErrorKind::NotFound => ("FILE_NOT_FOUND", "File does not exist."),
        io::ErrorKind::PermissionDenied => ("PERMISSION_DENIED", "Permission denied."),
        io::ErrorKind::InvalidData => ("INVALID_TEXT", "File is not valid UTF-8 text."),
        io::ErrorKind::AlreadyExists => ("ALREADY_EXISTS", "Target file already exists."),
        io::ErrorKind::WriteZero => ("WRITE_FAILED", "Failed to write file."),
        _ => ("IO_ERROR", "I/O error occurred."),
    };

    FileCommandError {
        code,
        message: format!("{}{}", action, detail),
    }
}

#[tauri::command]
pub fn open_file(path: String) -> FileCommandResult<FilePayload> {
    let path_buf = normalize_path(path)?;
    let content = fs::read_to_string(&path_buf).map_err(|error| to_io_error("Open failed: ", error))?;

    Ok(FilePayload {
        path: path_buf.to_string_lossy().to_string(),
        content,
    })
}

#[tauri::command]
pub fn save_file(path: String, content: String) -> FileCommandResult<String> {
    let path_buf = normalize_path(path)?;
    fs::write(&path_buf, content).map_err(|error| to_io_error("Save failed: ", error))?;
    Ok(path_buf.to_string_lossy().to_string())
}

#[tauri::command]
pub fn save_file_as(path: String, content: String) -> FileCommandResult<String> {
    let path_buf = normalize_path(path)?;
    fs::write(&path_buf, content).map_err(|error| to_io_error("Save As failed: ", error))?;
    Ok(path_buf.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::fs;

    // --- normalize_path ---

    #[test]
    fn normalize_path_empty_string_returns_invalid_path() {
        let result = normalize_path(String::new());
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code, "INVALID_PATH");
    }

    #[test]
    fn normalize_path_whitespace_only_returns_invalid_path() {
        let result = normalize_path("   \t\n  ".to_string());
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code, "INVALID_PATH");
    }

    #[test]
    fn normalize_path_valid_returns_pathbuf() {
        let result = normalize_path("/tmp/test.md".to_string());
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), PathBuf::from("/tmp/test.md"));
    }

    // --- open_file ---

    #[test]
    fn open_file_nonexistent_returns_file_not_found() {
        let result = open_file("/tmp/__blinkmd_nonexistent_test_file__.md".to_string());
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code, "FILE_NOT_FOUND");
    }

    #[test]
    fn open_file_reads_content_correctly() {
        let path = env::temp_dir().join("blinkmd_test_open.md");
        fs::write(&path, "# Hello BlinkMD").unwrap();

        let result = open_file(path.to_string_lossy().to_string());
        assert!(result.is_ok());
        let payload = result.unwrap();
        assert_eq!(payload.content, "# Hello BlinkMD");
        assert!(payload.path.contains("blinkmd_test_open.md"));

        fs::remove_file(&path).ok();
    }

    // --- save_file ---

    #[test]
    fn save_file_empty_path_returns_invalid_path() {
        let result = save_file(String::new(), "content".to_string());
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().code, "INVALID_PATH");
    }

    #[test]
    fn save_file_writes_and_reads_back() {
        let path = env::temp_dir().join("blinkmd_test_save.md");
        let content = "Saved content 保存测试";

        let result = save_file(path.to_string_lossy().to_string(), content.to_string());
        assert!(result.is_ok());

        let read_back = fs::read_to_string(&path).unwrap();
        assert_eq!(read_back, content);

        fs::remove_file(&path).ok();
    }

    // --- save_file_as ---

    #[test]
    fn save_file_as_writes_and_reads_back() {
        let path = env::temp_dir().join("blinkmd_test_save_as.md");
        let content = "Save As content";

        let result = save_file_as(path.to_string_lossy().to_string(), content.to_string());
        assert!(result.is_ok());

        let read_back = fs::read_to_string(&path).unwrap();
        assert_eq!(read_back, content);

        fs::remove_file(&path).ok();
    }
}
