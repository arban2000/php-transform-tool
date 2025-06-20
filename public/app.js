document.addEventListener('DOMContentLoaded', () => {
    // ---- 1. Načtení všech potřebných HTML prvků ----
    const startButton = document.getElementById('start-analysis-btn');
    const resultsDiv = document.getElementById('analysis-results');
    const controlsDiv = document.getElementById('analysis-controls');
    const statusSpan = document.getElementById('analysis-status');
    const spinner = document.getElementById('analysis-spinner');
    const summaryOk = document.getElementById('summary-ok');
    const summaryError = document.getElementById('summary-error');
    const summaryTotal = document.getElementById('summary-total');
    const filterButtons = document.querySelectorAll('.filter-btn');

    // Nové prvky pro dedikovaný prohlížeč kódu
    const codeDisplayContainer = document.getElementById('code-display-container');
    const codeDisplayContent = document.getElementById('code-display-content');
    const codeDisplayFilename = document.getElementById('code-display-filename');
    const codeDisplayCloseBtn = document.getElementById('code-display-close-btn');

    // Pokud na stránce není tlačítko, nic neděláme
    if (!startButton) {
        return;
    }

    // ---- 2. Přidání hlavních posluchačů událostí ----
    startButton.addEventListener('click', startSyntaxCheck);
    codeDisplayCloseBtn.addEventListener('click', () => {
        codeDisplayContainer.style.display = 'none';
    });

    // ---- 3. Deklarace proměnných pro řízení procesu ----
    let currentIndex = 0;
    let okCount = 0;
    let errorCount = 0;

    /**
     * Hlavní funkce, která spustí celý proces kontroly.
     */
    function startSyntaxCheck() {
        if (typeof filesToLint === 'undefined' || filesToLint.length === 0) {
            resultsDiv.innerHTML = '<p>Nenalezeny žádné soubory k analýze.</p>';
            return;
        }
        
        currentIndex = 0;
        okCount = 0;
        errorCount = 0;
        resultsDiv.innerHTML = '';
        controlsDiv.style.display = 'flex';
        spinner.style.display = 'inline-block';
        startButton.disabled = true;
        summaryTotal.textContent = filesToLint.length;
        summaryOk.textContent = '0';
        summaryError.textContent = '0';
        
        checkNextFile();
    }

    /**
     * Funkce, která rekurzivně volá sama sebe a zpracovává soubor po souboru.
     */
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
            const response = await fetch('../api/linter.php', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            updateUI(result);
        } catch (error) {
            updateUI({ status: 'error', file: file, message: `Chyba komunikace: ${error.message}` });
        }
        
        currentIndex++;
        checkNextFile();
    }
    
    /**
     * Funkce pro aktualizaci uživatelského rozhraní s výsledkem kontroly.
     * @param {object} result - Objekt s výsledkem z API.
     */
    function updateUI(result) {
        const resultItem = document.createElement('div');
        
        const fileAndLine = result.file;
        let lineNumber = '';

        const match = result.message ? result.message.match(/on line (\d+)/) : null;
        if (match) {
            lineNumber = match[1];
        }

        if (result.status === 'ok') {
            okCount++;
            summaryOk.textContent = okCount;
            resultItem.className = 'result-ok';
            resultItem.innerHTML = `✅ <strong>OK:</strong> ${fileAndLine}`;
        } else {
            errorCount++;
            summaryError.textContent = errorCount;
            resultItem.className = 'result-error';
            resultItem.innerHTML = `
                <div class="error-header">
                    <span>❌ <strong>Chyba:</strong> ${fileAndLine}</span>
                    <a href="#" class="view-code-btn" data-project="${selectedProject}" data-file="${fileAndLine}" data-line="${lineNumber}">Zobrazit kód</a>
                </div>
                <pre class="error-message-preview">${result.message}</pre>
            `;
        }
        resultsDiv.appendChild(resultItem);
        resultsDiv.scrollTop = resultsDiv.scrollHeight;
    }


    // ---- 4. Logika pro filtrování ----
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
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


    // ---- 5. Logika pro interaktivní zobrazení kódu ----
    resultsDiv.addEventListener('click', async (event) => {
        if (event.target.classList.contains('view-code-btn')) {
            event.preventDefault();
            
            const button = event.target;
            const project = button.dataset.project;
            const file = button.dataset.file;
            const line = button.dataset.line;

            button.textContent = 'Načítám...';
            button.disabled = true;
            let responseText = ''; // Proměnná pro uložení textové odpovědi pro ladění

            try {
                // Vytvoříme novou formData konstantu specificky pro tento požadavek.
                const formData = new FormData();
                formData.append('project', project);
                formData.append('file', file);
                
                const response = await fetch('../api/get_file_content.php', { method: 'POST', body: formData });
                responseText = await response.text(); // Nejdříve přečteme text
                const data = JSON.parse(responseText); // Až potom parsujeme JSON

                if (data.status === 'ok') {
                    const pre = document.createElement('pre');
                    if (line) pre.setAttribute('data-line', line);
                    pre.className = 'line-numbers';
                    
                    const code = document.createElement('code');
                    code.className = 'language-php';
                    code.textContent = data.content;
                    
                    pre.appendChild(code);
                    
                    codeDisplayContent.innerHTML = '';
                    codeDisplayContent.appendChild(pre);
                    codeDisplayFilename.textContent = file;

                    // Zkusíme spustit Prism, ale obalíme ho do try...catch
                    try {
                        Prism.highlightAllUnder(codeDisplayContent);
                    } catch (prismError) {
                        console.error("Chyba v knihovně Prism.js:", prismError);
                        codeDisplayContent.innerHTML += `<p class="error-message">Chyba při zvýrazňování syntaxe.</p>`;
                    }
                    
                    codeDisplayContainer.style.display = 'block';
                    codeDisplayContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

                } else {
                    alert('Chyba načtení souboru: ' + data.message);
                }
            } catch (error) {
                const errorMessage = `Chyba zpracování v JavaScriptu: ${error.name} - ${error.message}.`;
                alert(errorMessage + ' Zkontrolujte konzoli (F12) pro více detailů.');
                console.error("Detailní chyba při zobrazování kódu:", error);
                // Pro ladění vypíšeme i text odpovědi, pokud není platný JSON
                if (responseText) {
                    console.error("Původní odpověď ze serveru, která není platný JSON:", responseText);
                }
            } finally {
                button.textContent = 'Zobrazit kód';
                button.disabled = false;
            }
        }
    });
});