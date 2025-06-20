<?php
// public/index.php

require_once __DIR__ . '/../src/config.php';
require_once __DIR__ . '/../src/functions.php';

// Zpracování akcí
$message = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['save_project'])) {
    $project_to_save = $_POST['project_name'] ?? '';
    if ($project_to_save) {
        if (save_project_snapshot($project_to_save)) {
            $message = "Snímek projektu '{$project_to_save}' byl úspěšně vytvořen.";
        } else {
            $message = "Chyba: Nepodařilo se vytvořit snímek projektu '{$project_to_save}'.";
        }
    }
}


// Načtení dat pro zobrazení
$projects = get_projects();
$selected_project = $_GET['project'] ?? null;
$php_files = [];

if ($selected_project && in_array($selected_project, $projects)) {
    $php_files = get_php_files($selected_project);
}

?>
<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <title>Transformační Nástroj</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h1>Transformační Nástroj</h1>

    <?php if ($message): ?>
        <div class="container message">
            <p><?= htmlspecialchars($message) ?></p>
        </div>
    <?php endif; ?>

    <div class="container project-selector">
        <h2>Vyberte projekt</h2>
        <nav>
            <ul>
                <?php foreach ($projects as $project): ?>
                    <li class="<?= ($project === $selected_project) ? 'active' : '' ?>">
                        <a href="index.php?project=<?= urlencode($project) ?>">
                            📁 <?= htmlspecialchars($project) ?>
                        </a>
                    </li>
                <?php endforeach; ?>
            </ul>
        </nav>
    </div>

    <?php if ($selected_project): ?>
        <div class="container file-viewer">
            
            <form method="POST" action="index.php?project=<?= urlencode($selected_project) ?>" class="save-form">
                <input type="hidden" name="project_name" value="<?= htmlspecialchars($selected_project) ?>">
                <button type="submit" name="save_project">
                    💾 Uložit snímek (zálohu) aktuálního stavu
                </button>
            </form>
            
            <h2>PHP soubory v projektu: <?= htmlspecialchars($selected_project) ?></h2>
            <p>Nalezeno souborů: <?= count($php_files) ?></p>
            <div class="file-list">
                <?php foreach ($php_files as $file): ?>
                    <code><?= htmlspecialchars($file) ?></code><br>
                <?php endforeach; ?>
            </div>
        </div>
    <?php endif; ?>

</body>
</html>