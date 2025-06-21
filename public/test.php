<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <title>Test Zvýrazňování Syntaxe</title>

    <!-- 1. Načtení potřebných CSS stylů z internetu (pro test) -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-okaidia.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/line-numbers/prism-line-numbers.min.css">
    
    <style>
        body { background-color: #1a1a1a; color: #e0e0e0; padding: 20px; font-family: sans-serif; }
        pre { border: 1px solid #444; border-radius: 5px; }
    </style>
</head>
<body>

    <h1>Test Knihovny Prism.js</h1>
    <p>Pokud se následující kód zobrazí správně barevně a s čísly řádků, knihovna je v pořádku a chyba je v našem `app.js`.</p>

    <!-- 2. Pevně daný blok s PHP kódem -->
    <pre class="line-numbers"><code class="language-php">
&lt;?php
// Toto je testovací PHP kód

class HelloWorld {
    public function sayHello() {
        $message = "Vše funguje správně!";
        echo $message;
    }
}

$instance = new HelloWorld();
$instance-&gt;sayHello();
?&gt;
    </code></pre>


    <!-- 3. Ruční načtení všech JS souborů ve správném pořadí z internetu (pro test) -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-core.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-clike.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-markup.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/markup-templating/prism-markup-templating.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-php.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/line-numbers/prism-line-numbers.min.js"></script>

</body>
</html>