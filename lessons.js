// Python lessons, written as plain data so new ones are easy to add.
// A lesson = read (short paragraphs) + try (code the player can run and change) + exercises.
// Real Python (Pyodide) runs the code. Exercise types:
//   choice   pick one answer: options[], answer (index)
//   fill     code has ___ ; the player types what goes there. `answer` is the model answer; the check runs the code and compares the output to `expect`.
//   predict  the player types what the code prints (`expect` if given, otherwise it is worked out by running the code)
//   fix      the player edits broken code until it prints `expect`
//   write    the player writes code from scratch (`start` is the starting text) until it prints `expect`
// Optional on fix/write/fill: `tests` = [["expression", "expected repr"]] checked after the code runs (for functions), `stdin` = lines given to input().
// Also optional: `must` (regex the code has to match). `why` is shown after every answer.
(function (root) {
  "use strict";

  const CHAPTERS = [
    { id: 1, name: "Say hello", sub: "print and variables", lessons: [
      { id: "1.1", title: "Your first line", bug: "Python reads your code top to bottom, one line at a time. print() shows something on the screen.",
        read: [
          "A program is a list of instructions. Python reads them from the top, one line at a time.",
          "The instruction <code>print()</code> shows something on the screen. Whatever you put between the brackets is what gets shown.",
        ],
        try: { code: 'print("Hello, world!")', note: "Press RUN. Then change the words and run it again." },
        ex: [
          { type: "fill", prompt: "Fill the blank so the program shows <b>Hi there</b>.", code: '___("Hi there")', answer: "print", expect: "Hi there", why: "The instruction that shows things on the screen is print." },
          { type: "predict", prompt: "What will this show?", code: 'print("one")\nprint("two")', why: "Each print starts a new line, and Python runs the lines in order." },
          { type: "fix", prompt: "This should show <b>Hello</b>, but Python is unhappy. Fix it.", code: 'prnt("Hello")', solution: 'print("Hello")', expect: "Hello", why: "Python only knows print if you spell it exactly: p-r-i-n-t." },
          { type: "write", prompt: "Write one line that shows <b>Hello, Debugr</b>.", start: "", solution: 'print("Hello, Debugr")', expect: "Hello, Debugr", why: "Use print( then the words in quotes, then a closing bracket." },
        ] },
      { id: "1.2", title: "Text in quotes", bug: "Quotes tell Python 'this is just text'. Without them, Python thinks you mean a name.",
        read: [
          "Text is called a <b>string</b>. You write it between quotes, either \"double\" or 'single'. Both work the same.",
          "Quotes are not shown. They only tell Python where the text starts and ends.",
          "Text in quotes stays text, even if it looks like a number. <code>\"5\"</code> is text, <code>5</code> is a number.",
        ],
        try: { code: 'print("I like bugs")\nprint(\'single quotes work too\')\nprint("5" + "5")', note: "Look at the last line. Why isn't it 10?" },
        ex: [
          { type: "predict", prompt: "What will this show?", code: 'print("5" + "5")', why: "Between quotes, 5 is text. Adding text glues it together: 55, not 10." },
          { type: "fix", prompt: "One quote is missing. Fix it so it shows <b>good morning</b>.", code: 'print("good morning)', solution: 'print("good morning")', expect: "good morning", why: "Every opening quote needs a closing quote." },
          { type: "fill", prompt: "Fill the blank so it shows <b>Python</b>.", code: 'print(___)', answer: '"Python"', expect: "Python", why: "The word is text, so it needs quotes around it." },
          { type: "write", prompt: "Write one line that shows <b>I am learning Python</b>.", start: "", solution: 'print("I am learning Python")', expect: "I am learning Python", why: "print(\"...\") with the sentence inside the quotes." },
        ] },
      { id: "1.3", title: "Variables", bug: "A variable is a name stuck on a value, like a label on a box. name = value puts the value in the box.",
        read: [
          "A <b>variable</b> is a name that holds a value, like a label stuck on a box.",
          "You make one with <code>=</code>. The name goes on the left and the value on the right: <code>age = 12</code>.",
          "Now you can use the name instead of the value. <code>print(age)</code> shows 12. No quotes, because you want the value inside the box, not the word \"age\".",
        ],
        try: { code: 'age = 12\nprint(age)\nprint("age")', note: "One line shows 12 and the other shows the word. Why?" },
        ex: [
          { type: "predict", prompt: "What will this show?", code: 'city = "Baku"\nprint(city)', why: "print(city) shows what is inside the variable, which is Baku." },
          { type: "predict", prompt: "What will this show?", code: 'city = "Baku"\nprint("city")', why: "With quotes it is just the word city. Without quotes it would be the variable." },
          { type: "fill", prompt: "Fill the blank so it shows <b>12</b>.", code: 'age = ___\nprint(age)', answer: "12", expect: "12", why: "The variable age has to hold 12." },
          { type: "write", prompt: "Make a variable called <b>name</b> that holds <b>Sam</b>, then print it. Show <b>Sam</b>.", start: "", solution: 'name = "Sam"\nprint(name)', expect: "Sam", must: /name\s*=/, why: "Two lines: name = \"Sam\" and then print(name)." },
        ] },
      { id: "1.4", title: "Changing variables", bug: "A variable can change whenever you like. The newest value wins.",
        read: [
          "A variable can get a new value any time. The old value is forgotten.",
          "A line like <code>score = score + 1</code> reads: take what is in score, add 1, and put the answer back into score.",
          "Copying works one way only. <code>b = a</code> copies the value that a holds right now. If a changes later, b does not.",
        ],
        try: { code: 'score = 10\nscore = score + 5\nprint(score)\n\na = 1\nb = a\na = 99\nprint(b)', note: "Predict both numbers before you run it." },
        ex: [
          { type: "predict", prompt: "What will this show?", code: 'x = 3\nx = x + 1\nprint(x)', why: "x starts as 3, then becomes 3 + 1 = 4." },
          { type: "predict", prompt: "What will this show?", code: 'a = 5\nb = a\na = 100\nprint(b)', why: "b copied the 5 earlier. Changing a afterwards does not change b." },
          { type: "fill", prompt: "Fill the blank so the program shows <b>20</b>.", code: 'coins = 15\ncoins = coins + ___\nprint(coins)', answer: "5", expect: "20", why: "15 plus what makes 20?" },
          { type: "write", prompt: "Start with <code>lives = 3</code>, then make lives go up by 1, then print it. Show <b>4</b>.", start: "lives = 3\n", solution: 'lives = 3\nlives = lives + 1\nprint(lives)', expect: "4", must: /lives\s*=\s*lives\s*\+\s*1|lives\s*\+=\s*1/, why: "Use lives = lives + 1, then print(lives)." },
        ] },
      { id: "1.5", title: "Choosing names", bug: "Good names say what is inside. Python is picky: no spaces, and a name can't start with a number.",
        read: [
          "Names can use letters, numbers and underscores. They cannot have spaces and cannot start with a number.",
          "Capital letters matter: <code>Score</code> and <code>score</code> are two different variables.",
          "Use names that say what is inside, like <code>player_name</code> instead of <code>x</code>.",
        ],
        try: { code: 'player_name = "Ada"\nplayer_score = 7\nprint(player_name)\nprint(player_score)', note: "Try breaking it: put a space in a name and read the message." },
        ex: [
          { type: "fix", prompt: "A name can't have spaces. Fix it so it shows <b>Sam</b>.", code: 'my name = "Sam"\nprint(my name)', solution: 'my_name = "Sam"\nprint(my_name)', expect: "Sam", why: "Replace the space with an underscore: my_name." },
          { type: "fix", prompt: "The name does not match. Fix it so it shows <b>7</b>.", code: 'Score = 7\nprint(score)', solution: 'score = 7\nprint(score)', expect: "7", why: "Score and score are different names. Use the same capital letters both times." },
          { type: "fix", prompt: "A name can't start with a number. Fix it so it shows <b>3</b>.", code: '1st = 3\nprint(1st)', solution: 'first = 3\nprint(first)', expect: "3", why: "Start the name with a letter, like first." },
          { type: "write", prompt: "Make a variable called <b>player_name</b> holding <b>Ada</b>, then print it.", start: "", solution: 'player_name = "Ada"\nprint(player_name)', expect: "Ada", must: /player_name\s*=/, why: "player_name = \"Ada\" then print(player_name)." },
        ] },
    ] },
    { id: 2, name: "Numbers and text", sub: "math, joining, f-strings", lessons: [
      { id: "2.1", title: "Doing math", bug: "Python is a calculator. Multiplication is *, and ** means 'to the power of'.",
        read: [
          "Python can do math. Use <code>+</code> to add, <code>-</code> to subtract, <code>*</code> to multiply and <code>/</code> to divide.",
          "Two stars <code>**</code> mean power: <code>2 ** 3</code> is 2 × 2 × 2 = 8.",
          "Like in school, multiplying happens before adding. Use brackets to choose the order: <code>(2 + 3) * 4</code>.",
        ],
        try: { code: 'print(2 + 3)\nprint(10 / 4)\nprint(2 ** 3)\nprint(2 + 3 * 4)\nprint((2 + 3) * 4)', note: "Notice that / gives a decimal." },
        ex: [
          { type: "predict", prompt: "What will this show?", code: 'print(2 + 3 * 4)', why: "Multiplication goes first: 3 * 4 = 12, then 2 + 12 = 14." },
          { type: "predict", prompt: "What will this show?", code: 'print(2 ** 4)', why: "2 * 2 * 2 * 2 = 16." },
          { type: "fill", prompt: "Fill the blank so it shows <b>20</b>.", code: 'print((2 + 3) ___ 4)', answer: "*", expect: "20", why: "5 times 4 is 20, so you need the multiply sign." },
          { type: "write", prompt: "Print the answer to <b>6 times 7</b>. Let Python do the math.", start: "", solution: 'print(6 * 7)', expect: "42", must: /6\s*\*\s*7/, why: "print(6 * 7)." },
        ] },
      { id: "2.2", title: "Division and leftovers", bug: "// is division without the decimals, and % tells you what is left over. Handy for even/odd!",
        read: [
          "Normal division <code>/</code> always gives a decimal: <code>7 / 2</code> is 3.5.",
          "<code>//</code> is <b>whole-number division</b>. It throws the decimals away: <code>7 // 2</code> is 3.",
          "<code>%</code> gives the <b>leftover</b>. 7 shared between 2 leaves 1, so <code>7 % 2</code> is 1. If <code>n % 2</code> is 0, the number is even.",
        ],
        try: { code: 'print(7 / 2)\nprint(7 // 2)\nprint(7 % 2)\nprint(10 % 5)', note: "Try other numbers. What is 17 % 5?" },
        ex: [
          { type: "predict", prompt: "What will this show?", code: 'print(7 // 2)', why: "// keeps only the whole part of 3.5, which is 3." },
          { type: "predict", prompt: "What will this show?", code: 'print(17 % 5)', why: "5 fits into 17 three times (15). Leftover: 2." },
          { type: "fill", prompt: "Fill the blank so it shows <b>0</b> (10 shares evenly into 5).", code: 'print(10 ___ 5)', answer: "%", expect: "0", why: "Nothing is left over, so the leftover sign % gives 0." },
          { type: "write", prompt: "Print how many whole <b>weeks</b> are in <b>30 days</b> (a week is 7 days).", start: "", solution: 'print(30 // 7)', expect: "4", must: /\/\//, why: "Use whole-number division: 30 // 7." },
        ] },
      { id: "2.3", title: "Joining text", bug: "You can add text to text, but not text to a number. str() turns a number into text.",
        read: [
          "You can glue text together with <code>+</code>: <code>\"Hi \" + \"Sam\"</code> gives Hi Sam.",
          "<code>\"ab\" * 3</code> repeats the text: ababab.",
          "You cannot glue text and a number. <code>\"Age: \" + 12</code> is an error. Turn the number into text first with <code>str(12)</code>.",
        ],
        try: { code: 'print("Hi " + "Sam")\nprint("ha" * 3)\nprint("Age: " + str(12))', note: "Remove str() and read the error message." },
        ex: [
          { type: "predict", prompt: "What will this show?", code: 'print("ha" * 3)', why: "Multiplying text repeats it." },
          { type: "predict", prompt: "What will this show?", code: 'first = "Ada"\nlast = "Lovelace"\nprint(first + " " + last)', why: "Three pieces glued together: Ada, a space, Lovelace." },
          { type: "fix", prompt: "Text and a number can't be joined. Fix it so it shows <b>Age: 12</b>.", code: 'print("Age: " + 12)', solution: 'print("Age: " + str(12))', expect: "Age: 12", why: "Turn the number into text with str(12)." },
          { type: "write", prompt: "Use <code>*</code> to print <b>ababab</b>.", start: "", solution: 'print("ab" * 3)', expect: "ababab", must: /\*/, why: "print(\"ab\" * 3)." },
        ] },
      { id: "2.4", title: "Text tools", bug: "Text has built-in tools. Write a dot after it, like name.upper(). len() counts the characters.",
        read: [
          "<code>len(text)</code> tells you how many characters the text has, spaces included.",
          "Text has tools you call with a dot: <code>.upper()</code>, <code>.lower()</code>, <code>.title()</code> and <code>.replace(\"a\", \"b\")</code>.",
          "The tools do not change the original. They give you a new text back, so print it or keep it in a variable.",
        ],
        try: { code: 'word = "python"\nprint(len(word))\nprint(word.upper())\nprint(word.replace("p", "j"))', note: "Try .title() on a sentence." },
        ex: [
          { type: "predict", prompt: "What will this show?", code: 'print(len("hello"))', why: "hello has 5 letters." },
          { type: "predict", prompt: "What will this show?", code: 'print("cat".replace("c", "b"))', why: "Every c becomes b, so cat turns into bat." },
          { type: "fill", prompt: "Fill the blank so it shows <b>HELLO</b>.", code: 'word = "hello"\nprint(word.___())', answer: "upper", expect: "HELLO", why: "The tool that makes capitals is upper()." },
          { type: "write", prompt: "Make a variable <code>word</code> holding <b>bug</b> and print it in capitals. Show <b>BUG</b>.", start: "", solution: 'word = "bug"\nprint(word.upper())', expect: "BUG", must: /\.upper\(\)/, why: "word = \"bug\" then print(word.upper())." },
        ] },
      { id: "2.5", title: "f-strings", bug: "Put an f before the quote and you can drop variables right into the text with {curly brackets}.",
        read: [
          "Joining with <code>+</code> gets messy. An <b>f-string</b> is easier: put <code>f</code> in front of the quote and write variables inside <code>{ }</code>.",
          "<code>f\"Hello, {name}!\"</code> becomes Hello, Sam! when name is \"Sam\". Numbers work too, with no str() needed.",
          "You can even do math inside the brackets: <code>{2 + 3}</code> shows 5.",
        ],
        try: { code: 'name = "Sam"\nage = 12\nprint(f"{name} is {age} years old")\nprint(f"Next year: {age + 1}")', note: "Change the name and age, then run again." },
        ex: [
          { type: "predict", prompt: "What will this show?", code: 'pet = "cat"\nprint(f"I have a {pet}")', why: "{pet} is replaced by what the variable holds." },
          { type: "predict", prompt: "What will this show?", code: 'print(f"{2 + 3} apples")', why: "Python does the math inside the brackets first." },
          { type: "fill", prompt: "Fill the blank so it shows <b>Hello, Ada!</b>.", code: 'name = "Ada"\nprint(___"Hello, {name}!")', answer: "f", expect: "Hello, Ada!", why: "Put an f right before the opening quote." },
          { type: "write", prompt: "With <code>name = \"Ada\"</code> and <code>score = 7</code>, use an f-string to print <b>Ada scored 7</b>.", start: 'name = "Ada"\nscore = 7\n', solution: 'name = "Ada"\nscore = 7\nprint(f"{name} scored {score}")', expect: "Ada scored 7", must: /f["']/, why: "print(f\"{name} scored {score}\")." },
        ] },
    ] },
  ];

  // chapters 3 and up live in lessons3.js ... lessons6.js and register themselves here
  const add = (ch) => { const i = CHAPTERS.findIndex((c) => c.id === ch.id); if (i >= 0) CHAPTERS[i] = ch; else CHAPTERS.push(ch); CHAPTERS.sort((x, y) => x.id - y.id); };
  const api = { CHAPTERS, add };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Lessons = api;
})(typeof window !== "undefined" ? window : globalThis);
