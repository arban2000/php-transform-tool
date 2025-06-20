// public/app.js
document.addEventListener('DOMContentLoaded', () => {
    // Načteme všechny potřebné HTML prvky
    const startButton = document.getElementById('start-analysis-btn');
    const resultsDiv = document.getElementById('analysis-results');
    const controlsDiv = document.getElementById('analysis-controls');
    const statusSpan = document.getElementById('analysis-status');
    const spinner = document.getElementById('analysis-spinner');
    const summaryOk = document.getElementById('summary-ok');
    const summaryError = document.getElementById('summary-error');
    const summaryTotal = document.getElementById('summary-total');
    const filterButtons = document.querySelectorAll('.filter-btn');

    if (!startButton) return;

    startButton.addEventListener('click', startSyntaxCheck);

    let currentIndex = 0;
    let okCount = 0;
    let errorCount = 0;

    function startSyntaxCheck() {
        if (typeof filesToLint === 'undefined' || filesToLint.length === 0) {
            resultsDiv.innerHTML = '<p>Nenalezeny žádné soubory k analýze.</p>';
            return;
        }
        
        // Resetujeme a připravíme rozhraní
        currentIndex = 0;
        okCount = 0;
        errorCount = 0;
        resultsDiv.innerHTML = '';
        controlsDiv.style.display = 'block';
        spinner.style.display = 'inline-block';
        startButton.disabled = true;
        summaryTotal.textContent = filesToLint.length;
        summaryOk.textContent = '0';
        summaryError.textContent = '0';

        // Spustíme kontrolu
        checkNextFile();
    }

    async function checkNextFile() {
        statusSpan.textContent = `Kontroluji ${currentIndex + 1} / ${filesToLint.length}...`;

        if (currentIndex >= filesToLint.length) {
            spinner.style.display = 'none';
            startButton.disabled = false;
            statusSpan.textContent = `Hotovo!`;
            return;
        }

        const file = filesToLint[currentIndex];
        const formData = new FormData();
        formData.append('project', selectedProject);
        formData.append('file', file);
        
        try {
            const response = await fetch('../api/linter.php', { method: 'POST', body: formData });
            const result = await response.json();
            updateUI(result);
        } catch (error) {
            updateUI({ status: 'error', file: file, message: `Chyba komunikace: ${error.message}` });
        }
        
        currentIndex++;
        checkNextFile();
    }
    
    function updateUI(result) {
        const resultItem = document.createElement('div');
        if (result.status === 'ok') {
            okCount++;
            summaryOk.textContent = okCount;
            resultItem.className = 'result-ok';
            resultItem.innerHTML = `✅ <strong>OK:</strong> ${result.file}`;
        } else {
            errorCount++;
            summaryError.textContent = errorCount;
            resultItem.className = 'result-error';
            resultItem.innerHTML = `❌ <strong>Chyba:</strong> ${result.file}<pre>${result.message}</pre>`;
        }
        resultsDiv.appendChild(resultItem);
        resultsDiv.scrollTop = resultsDiv.scrollHeight;
    }

    // PŘIDANÁ LOGIKA PRO FILTROVÁNÍ
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Změníme aktivní tlačítko
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const filter = button.dataset.filter;
            const allResults = resultsDiv.querySelectorAll('.result-ok, .result-error');

            allResults.forEach(result => {
                if (filter === 'all') {
                    result.style.display = 'block';
                } else if (filter === 'ok') {
                    result.style.display = result.classList.contains('result-ok') ? 'block' : 'none';
                } else if (filter === 'error') {
                    result.style.display = result.classList.contains('result-error') ? 'block' : 'none';
                }
            });
        });
    });
});