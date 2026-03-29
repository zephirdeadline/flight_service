use std::env;
use std::fs;
use std::path::Path;

fn main() {
    // Copier SimConnect.dll si disponible
    copy_simconnect_dll();

    tauri_build::build()
}

fn copy_simconnect_dll() {
    // Créer le chemin depuis la variable d'environnement (doit vivre assez longtemps)
    let env_path = format!(
        "{}\\lib\\SimConnect.dll",
        env::var("SIMCONNECT_SDK").unwrap_or_default()
    );

    // Chemins possibles pour SimConnect.dll
    let possible_paths = vec![
        // Flight Simulator 2024
        r"C:\Program Files\Microsoft Flight Simulator 2024\SimConnect SDK\lib\SimConnect.dll",
        // Flight Simulator 2020
        r"C:\MSFS SDK\SimConnect SDK\lib\SimConnect.dll",
        r"C:\Program Files (x86)\Microsoft Flight Simulator X SDK\SDK\Core Utilities Kit\SimConnect SDK\lib\SimConnect.dll",
        // Variable d'environnement personnalisée
        env_path.as_str(),
    ];

    // Trouver le premier chemin valide
    let source_dll = possible_paths.iter()
        .find(|path| Path::new(path).exists());

    if let Some(dll_path) = source_dll {
        println!("cargo:warning=Found SimConnect.dll at: {}", dll_path);

        // Déterminer le dossier de sortie
        let out_dir = env::var("OUT_DIR").unwrap();
        let target_dir = Path::new(&out_dir)
            .ancestors()
            .nth(3) // Remonter de OUT_DIR vers target/debug ou target/release
            .unwrap();

        let dest_dll = target_dir.join("SimConnect.dll");

        // Copier le DLL
        match fs::copy(dll_path, &dest_dll) {
            Ok(_) => println!("cargo:warning=SimConnect.dll copied to: {}", dest_dll.display()),
            Err(e) => println!("cargo:warning=Failed to copy SimConnect.dll: {}", e),
        }
    } else {
        println!("cargo:warning=SimConnect.dll not found in standard locations.");
        println!("cargo:warning=Please set SIMCONNECT_SDK environment variable or install Flight Simulator SDK.");
        println!("cargo:warning=The app will still build but SimConnect features won't work without the DLL.");
    }
}

