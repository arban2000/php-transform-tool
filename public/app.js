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
    const codeDisplayContainer = document.getElementById('code-display-container');
    const codeDisplayContent = document.getElementById('code-display-content');
    const codeDisplayFilename = document.getElementById('code-display-filename');
    const codeDisplayCloseBtn = document.getElementById('code-display-close-btn');

    if (!startButton) return;

    // ---- 2. Přidání hlavních posluchačů událostí ----
    startButton.addEventListener('click', startSyntaxCheck);
    codeDisplayCloseBtn.addEventListener('click', () => {
        codeDisplayContainer.style.display = 'none';
    });

    // ---- 4. Logika pro interaktivní zobrazení kódu (PŘEPRACOVANÁ PRO HIGHLIGHT.JS) ----
    resultsDiv.addEventListener('click', async (event) => {
        if (event.target.classList.contains('view-code-btn')) {
            event.preventDefault();
            
            const button = event.target;
            const project = button.dataset.project;
            const file = button.dataset.file;
            const line = button.dataset.line;

            button.textContent = 'Načítám...';
            button.disabled = true;

            try {
                const formData = new FormData();
                formData.append('project', project);
                formData.append('file', file);

                const response = await fetch('../api/get_file_content.php', { method: 'POST', body: formData });
                const data = await response.json();

                if (data.status === 'ok') {
                    codeDisplayFilename.textContent = file;
                    
                    const codeBlock = document.createElement('code');
                    codeBlock.className = 'language-php';
                    codeBlock.textContent = data.content;
                    hljs.highlightElement(codeBlock);

                    const finalHtml = addLineNumbersAndHighlight(codeBlock.innerHTML, line);
                    codeDisplayContent.innerHTML = `<pre><table><tbody>${finalHtml}</tbody></table></pre>`;
                    
                    // Nastavíme výchozí zobrazení na "Kontext chyby"
                    codeDisplayContainer.dataset.view = 'context';
                    document.querySelector('.code-view-btn[data-view="context"]').classList.add('active');
                    document.querySelector('.code-view-btn[data-view="full"]').classList.remove('active');

                    codeDisplayContainer.style.display = 'block';
                    codeDisplayContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

                } else {
                    alert('Chyba načtení souboru: ' + data.message);
                }
            } catch (error) {
                alert('Chyba komunikace se serverem.');
                console.error("Chyba při zobrazování kódu:", error);
            } finally {
                button.textContent = 'Zobrazit kód';
                button.disabled = false;
            }
        }
    });
    
    // ---- 3. Všechny funkce pro analýzu (zůstávají stejné) ----
    let currentIndex = 0;
    let okCount = 0;
    let errorCount = 0;

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

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const filter = button.dataset.filter;
            const allResults = resultsDiv.querySelectorAll('.result-ok, .result-error');
            allResults.forEach(result => {
                if (filter === 'all') { result.style.display = 'block'; } 
                else if (filter === 'ok') { result.style.display = result.classList.contains('result-ok') ? 'block' : 'none'; } 
                else if (filter === 'error') { result.style.display = result.classList.contains('result-error') ? 'block' : 'none'; }
            });
        });
    });

    /**
     * Nová pomocná funkce, která vezme obarvený kód, rozdělí ho na řádky
     * a přidá k nim čísla v tabulkové struktuře.
     * @param {string} highlightedHtml - HTML kód po zpracování knihovnou highlight.js
     * @param {string} lineToHighlight - Číslo řádku, který se má zvýraznit
     * @returns {string} - Finální HTML pro vložení do tabulky
     */
    /**
     * Funkce pro přidání čísel řádků (UPRAVENO)
     * Nyní přidává i třídu 'in-context' pro řádky v okolí chyby.
     */
    function addLineNumbersAndHighlight(highlightedHtml, lineToHighlight) {
        const lines = highlightedHtml.split('\n');
        const contextLines = 5; // Počet řádků před a za chybou
        let numberedHtml = '';

        for (let i = 0; i < lines.length; i++) {
            const lineNumber = i + 1;
            const isHighlighted = (lineNumber == lineToHighlight);
            // Zjistíme, zda je řádek v kontextu
            const isInContext = (lineNumber >= lineToHighlight - contextLines && lineNumber <= parseInt(lineToHighlight) + contextLines);
            
            const lineContent = lines[i] || '&nbsp;'; 
            
            let rowClass = '';
            if(isHighlighted) rowClass = 'highlight-line';
            if(isInContext) rowClass += ' in-context';
            
            numberedHtml += `
                <tr class="${rowClass}" data-line-number="${lineNumber}">
                    <td class="line-number">${lineNumber}</td>
                    <td class="line-code">${lineContent}</td>
                </tr>
            `;
        }
        return numberedHtml;
    }

    codeViewToggles.forEach(button => {
        button.addEventListener('click', (event) => {
            // Zabráníme případným dalším nechtěným akcím
            event.stopPropagation();
            
            // Odebereme 'active' třídu ze všech tlačítek a přidáme ji jen na to kliknuté
            codeViewToggles.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            const view = button.dataset.view;
            // Nastavíme data-atribut na hlavním kontejneru prohlížeče kódu
            codeDisplayContainer.dataset.view = view;
        });
    });
});
