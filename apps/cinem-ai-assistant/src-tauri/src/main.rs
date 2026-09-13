// Cinem AI Assistant — entry point. Keeps the Windows console hidden in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    cinem_ai_assistant_lib::run()
}
