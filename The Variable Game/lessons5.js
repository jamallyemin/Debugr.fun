// Chapter 6 (functions) and chapter 7 (input and errors). See lessons.js for the exercise types.
(function (root) {
  "use strict";
  const L = typeof module !== "undefined" && module.exports ? require("./lessons.js") : root.Lessons;

  L.add({ id: 6, name: "Functions", sub: "def, return, scope, recursion", lessons: [
    { id: "6.1", title: "Your own tools", bug: "def teaches Python a new word. Defining does nothing by itself. You have to call it with brackets!",
      read: [
        "A <b>function</b> is a named block of code you can use again and again. You have already used some: <code>print</code>, <code>len</code>, <code>range</code>.",
        "You make your own with <code>def</code>: <code>def say_hi():</code>, a colon, and the body indented underneath. Writing the <code>def</code> only <b>teaches</b> Python the word. Nothing runs until you <b>call</b> it: <code>say_hi()</code>.",
        "Functions stop you from copying the same lines again and again. Fix a bug in one place and it is fixed everywhere.",
      ],
      try: { code: 'def say_hi():\n    print("Hi!")\n    print("Welcome to Debugr")\n\nsay_hi()\nsay_hi()', note: "Remove one of the calls. What changes? Remove both?" },
      ex: [
        { type: "predict", prompt: "What will this show?", code: 'def beep():\n    print("beep")\n\nbeep()\nbeep()\nbeep()', why: "The function is called three times, so it runs three times." },
        { type: "predict", prompt: "What will this show?", code: 'def beep():\n    print("beep")\n\nprint("start")', why: "The def only teaches Python the word. Nobody calls beep(), so it never runs." },
        { type: "fix", prompt: "Nothing shows up. Fix it so it shows <b>Hello</b>.", code: 'def hello():\n    print("Hello")\n\nhello', solution: 'def hello():\n    print("Hello")\n\nhello()', expect: "Hello", why: "Without the brackets Python only looks at the function and does not run it." },
        { type: "write", prompt: "Define a function <code>greet</code> that prints <b>Hello, Debugr</b>, then call it once.", start: "", solution: 'def greet():\n    print("Hello, Debugr")\n\ngreet()', expect: "Hello, Debugr", must: /def\s+greet\s*\(\s*\)/, why: "def greet(): with an indented print, then greet() on its own line." },
      ] },
    { id: "6.2", title: "Parameters", bug: "A parameter is a blank the function fills in when it's called. The value you pass is the argument.",
      read: [
        "Functions become powerful when you can give them something to work with. A <b>parameter</b> is a variable in the brackets of the <code>def</code> line: <code>def greet(name):</code>.",
        "When you call it, the value you pass in is the <b>argument</b>: <code>greet(\"Ada\")</code> sets <code>name = \"Ada\"</code> for that call. Use several parameters separated by commas, and the arguments are matched <b>in order</b>.",
        "Calling it with the wrong number of arguments is a <code>TypeError</code>.",
      ],
      try: { code: 'def greet(name):\n    print("Hello,", name)\n\ngreet("Ada")\ngreet("Bob")\n\ndef add(a, b):\n    print(a + b)\n\nadd(2, 3)', note: "Call add with only one argument and read the error." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: 'def shout(word):\n    print(word.upper() + "!")\n\nshout("hey")', why: "word is \"hey\" in this call, so it prints HEY!" },
        { type: "predict", prompt: "What will this show?", code: "def sub(a, b):\n    print(a - b)\n\nsub(10, 3)", why: "Arguments match in order: a = 10, b = 3." },
        { type: "fill", prompt: "Fill the blank so it shows <b>Hi Sam</b>.", code: 'def hi(___):\n    print("Hi", name)\n\nhi("Sam")', answer: "name", expect: "Hi Sam", why: "The parameter has to have the same name that the body uses." },
        { type: "write", prompt: "Write <code>show_double(n)</code> that prints n times 2, then call it with 21. Show <b>42</b>.", start: "", solution: "def show_double(n):\n    print(n * 2)\n\nshow_double(21)", expect: "42", must: /def\s+show_double\s*\(\s*n\s*\)/, why: "def show_double(n): print(n * 2), then show_double(21)." },
      ] },
    { id: "6.3", title: "return", bug: "print SHOWS a value to a human. return HANDS it back to the code that called the function.",
      read: [
        "<code>print</code> only shows something on the screen. A function that should <b>give back an answer</b> uses <code>return</code>: <code>return a + b</code>. The caller can store it: <code>total = add(2, 3)</code>.",
        "<code>return</code> also <b>ends</b> the function straight away. Lines after it never run.",
        "A function with no <code>return</code> gives back <code>None</code> (nothing). That is the classic beginner bug: the function prints the answer, but <code>total</code> ends up as None.",
      ],
      try: { code: 'def add(a, b):\n    return a + b\n\ntotal = add(2, 3)\nprint(total * 10)\n\ndef show(n):\n    print(n)\n\nresult = show(5)\nprint(result)', note: "The second function only prints. What does result hold?" },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "def show(n):\n    print(n)\n\nresult = show(5)\nprint(result)", why: "show prints 5, but it returns nothing, so result is None." },
        { type: "choice", prompt: "What happens to the lines <b>after</b> a <code>return</code> inside a function?", options: ["They still run", "They never run, because return ends the function", "Python gives an error"], answer: 1, why: "return leaves the function immediately." },
        { type: "fix", prompt: "<code>add</code> prints instead of giving back the answer, so <code>add(2, 3)</code> is None. Fix it.", code: "def add(a, b):\n    print(a + b)", solution: "def add(a, b):\n    return a + b", tests: [["add(2, 3)", "5"], ["add(10, -4)", "6"]], why: "Use return, so the caller can use the answer." },
        { type: "write", prompt: "Write <code>square(n)</code> that <b>returns</b> n times n.", start: "def square(n):\n    ", solution: "def square(n):\n    return n * n", tests: [["square(4)", "16"], ["square(-3)", "9"]], must: /return/, why: "return n * n gives the answer back to the caller." },
      ] },
    { id: "6.4", title: "Defaults and keywords", bug: "A parameter with = gets a default. Callers can leave it out, or name it: greet(name='Ada').",
      read: [
        "A parameter can have a <b>default value</b>: <code>def power(base, exp=2):</code>. If the caller leaves it out, the default is used.",
        "You can pass arguments by <b>name</b> (keyword arguments), in any order: <code>power(exp=3, base=2)</code>. Parameters with defaults go <b>after</b> the ones without.",
        "Never use a list as a default value (<code>def f(items=[])</code>): the same list is shared by every call. Use <code>None</code> and make the list inside.",
      ],
      try: { code: 'def power(base, exp=2):\n    return base ** exp\n\nprint(power(5))\nprint(power(2, 3))\nprint(power(exp=4, base=2))', note: "Which calls use the default?" },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "def power(base, exp=2):\n    return base ** exp\n\nprint(power(5))", why: "exp was left out, so it is 2: 5 ** 2 = 25." },
        { type: "predict", prompt: "What will this show?", code: "def power(base, exp=2):\n    return base ** exp\n\nprint(power(exp=3, base=2))", why: "Named arguments can come in any order: 2 ** 3 = 8." },
        { type: "fix", prompt: "Parameters with a default have to come last. Fix it so it shows <b>Hello, Ada!</b>.", code: 'def greet(greeting="Hello", name):\n    return f"{greeting}, {name}!"\n\nprint(greet(name="Ada"))', solution: 'def greet(name, greeting="Hello"):\n    return f"{greeting}, {name}!"\n\nprint(greet(name="Ada"))', expect: "Hello, Ada!", why: "Put the parameter without a default first." },
        { type: "write", prompt: "Write <code>greet(name, greeting=\"Hello\")</code> that returns text like <b>Hello, Ada!</b>.", start: "", solution: 'def greet(name, greeting="Hello"):\n    return f"{greeting}, {name}!"', tests: [["greet('Ada')", "'Hello, Ada!'"], ["greet('Bob', 'Hi')", "'Hi, Bob!'"]], must: /greeting\s*=/, why: "Give greeting a default of \"Hello\" in the def line." },
      ] },
    { id: "6.5", title: "Scope", bug: "Variables made inside a function live only inside it, like a note you throw away when you leave the room.",
      read: [
        "Variables created <b>inside</b> a function are <b>local</b>: they exist only while the function runs and are invisible outside. Parameters are local too.",
        "Variables created outside all functions are <b>global</b>. A function can <b>read</b> them. If it assigns to the same name, it makes a new local variable and the global one is untouched.",
        "The <code>global</code> keyword lets a function change a global variable, but it makes code hard to follow. Prefer <b>parameters in, return out</b>.",
      ],
      try: { code: 'x = 10\n\ndef f():\n    x = 5\n    print("inside", x)\n\nf()\nprint("outside", x)', note: "Why does x stay 10 outside?" },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "x = 10\n\ndef f():\n    x = 5\n    print(x)\n\nf()\nprint(x)", why: "The x inside f is a separate local variable. The global x never changed." },
        { type: "predict", prompt: "What will this show?", code: "limit = 3\n\ndef too_big(n):\n    return n > limit\n\nprint(too_big(5))", why: "A function may read a global variable. 5 > 3 is True." },
        { type: "fix", prompt: "<code>secret</code> only exists inside the function, so the last line fails. Return it instead, so it shows <b>5</b>.", code: "def make():\n    secret = 5\n\nmake()\nprint(secret)", solution: "def make():\n    secret = 5\n    return secret\n\nsecret = make()\nprint(secret)", expect: "5", why: "Hand the value out with return and store it in a variable outside." },
        { type: "write", prompt: "Write <code>add_one(n)</code> that <b>returns</b> n + 1 without touching any outside variable.", start: "", solution: "def add_one(n):\n    return n + 1", tests: [["add_one(1)", "2"], ["add_one(-1)", "0"]], why: "Parameters in, return out." },
      ] },
    { id: "6.6", title: "Functions that build on each other", bug: "Small functions that do one thing, combined, beat one giant function. A function can call other functions.",
      read: [
        "Good functions are small and do <b>one</b> thing. A function can call other functions, so you build big things from small helpers.",
        "A function can return <b>several values</b> at once: <code>return low, high</code> actually returns a tuple, and you can unpack it: <code>low, high = min_max(nums)</code>.",
        "Right under the <code>def</code> line you can write a <b>docstring</b>, a text in triple quotes that explains what the function does. It is a note for humans.",
      ],
      try: { code: 'def min_max(nums):\n    """Return the smallest and the biggest number."""\n    return min(nums), max(nums)\n\nlow, high = min_max([3, 9, 1])\nprint(low, high)', note: "Print min_max([3, 9, 1]) without unpacking. What type is it?" },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "def two():\n    return 1, 2\n\nprint(two())", why: "Several returned values arrive as one tuple." },
        { type: "write", prompt: "Write <code>is_even(n)</code> that returns True if n is even, otherwise False.", start: "", solution: "def is_even(n):\n    return n % 2 == 0", tests: [["is_even(4)", "True"], ["is_even(7)", "False"], ["is_even(0)", "True"]], why: "The comparison n % 2 == 0 is already True or False, so return it directly." },
        { type: "write", prompt: "<code>is_even</code> is given. Write <code>count_evens(nums)</code> that uses it to count the even numbers in a list.", start: "def is_even(n):\n    return n % 2 == 0\n\n", solution: "def is_even(n):\n    return n % 2 == 0\n\ndef count_evens(nums):\n    count = 0\n    for n in nums:\n        if is_even(n):\n            count += 1\n    return count", tests: [["count_evens([1, 2, 3, 4])", "2"], ["count_evens([])", "0"], ["count_evens([7])", "0"]], must: /is_even\s*\(/, why: "Loop over the list, call is_even for each item and add 1 when it is True." },
        { type: "write", prompt: "Write <code>min_max(nums)</code> that returns the smallest and the biggest number (two values).", start: "", solution: "def min_max(nums):\n    return min(nums), max(nums)", tests: [["min_max([3, 9, 1])", "(1, 9)"], ["min_max([5])", "(5, 5)"]], why: "return min(nums), max(nums) returns a tuple." },
      ] },
    { id: "6.7", title: "Functions that call themselves", bug: "Recursion: a function solves a small piece and asks itself to solve the rest. It needs a stopping case, or it never ends.",
      read: [
        "A function can call <b>itself</b>. That is called <b>recursion</b>. It works when a big problem is just a small problem plus a smaller copy of the same problem.",
        "Every recursive function needs a <b>base case</b>: an answer it can give without calling itself. Otherwise it calls itself forever and Python stops it with a <code>RecursionError</code>.",
        "Example: <code>factorial(n)</code> is <code>n * factorial(n - 1)</code>, and the base case is <code>factorial(0) = 1</code>.",
      ],
      try: { code: 'def factorial(n):\n    if n == 0:\n        return 1\n    return n * factorial(n - 1)\n\nprint(factorial(5))', note: "Follow factorial(3) by hand: 3 * factorial(2), which is 2 * factorial(1)..." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "def countdown(n):\n    if n == 0:\n        print('go')\n        return\n    print(n)\n    countdown(n - 1)\n\ncountdown(3)", why: "It prints 3, calls itself with 2, then 1, and at 0 the base case prints go and stops." },
        { type: "fix", prompt: "This function never stops. Add the missing <b>base case</b> so <code>total(3)</code> is 6.", code: "def total(n):\n    return n + total(n - 1)", solution: "def total(n):\n    if n == 0:\n        return 0\n    return n + total(n - 1)", tests: [["total(3)", "6"], ["total(0)", "0"]], why: "total(0) must answer 0 without calling itself again." },
        { type: "write", prompt: "Write <code>fib(n)</code> that returns the n-th Fibonacci number (0, 1, 1, 2, 3, 5, 8, 13...). <code>fib(0)</code> is 0 and <code>fib(1)</code> is 1.", start: "", solution: "def fib(n):\n    if n < 2:\n        return n\n    return fib(n - 1) + fib(n - 2)", tests: [["fib(0)", "0"], ["fib(1)", "1"], ["fib(7)", "13"]], why: "Base case for 0 and 1, otherwise add the two numbers before." },
      ] },
    { id: "6.8", title: "Mini project: functions", bug: "Write the function, then test it with a few easy and a few tricky inputs. Empty and zero are the tricky ones.",
      read: [
        "Three small functions to finish the chapter. Think about the <b>tricky</b> inputs too: the empty text, the single item, zero.",
      ],
      try: { code: 'def is_palindrome(text):\n    return text == text[::-1]\n\nprint(is_palindrome("level"))\nprint(is_palindrome("abc"))', note: "A palindrome reads the same forwards and backwards." },
      ex: [
        { type: "write", prompt: "Write <code>is_palindrome(text)</code> that returns True if the text reads the same backwards.", start: "", solution: "def is_palindrome(text):\n    return text == text[::-1]", tests: [["is_palindrome('level')", "True"], ["is_palindrome('abc')", "False"], ["is_palindrome('')", "True"]], why: "Compare the text with the text reversed by a slice." },
        { type: "write", prompt: "Write <code>average(nums)</code> that returns the average of a list of numbers.", start: "", solution: "def average(nums):\n    return sum(nums) / len(nums)", tests: [["average([1, 2, 3, 4])", "2.5"], ["average([10])", "10.0"]], why: "sum divided by len." },
        { type: "write", prompt: "Write <code>fizzbuzz(n)</code> that <b>returns</b> 'FizzBuzz' for multiples of 15, 'Fizz' for 3, 'Buzz' for 5, and otherwise the number as text.", start: "", solution: "def fizzbuzz(n):\n    if n % 15 == 0:\n        return 'FizzBuzz'\n    if n % 3 == 0:\n        return 'Fizz'\n    if n % 5 == 0:\n        return 'Buzz'\n    return str(n)", tests: [["fizzbuzz(15)", "'FizzBuzz'"], ["fizzbuzz(9)", "'Fizz'"], ["fizzbuzz(10)", "'Buzz'"], ["fizzbuzz(7)", "'7'"]], why: "Check the multiples of 15 first, and use str(n) for the number." },
      ] },
  ] });

  L.add({ id: 7, name: "Input and errors", sub: "input(), reading errors, try/except", lessons: [
    { id: "7.1", title: "Asking the player", bug: "input() always gives you TEXT, even if the player types digits. Use int() to turn it into a number.",
      read: [
        "<code>input()</code> pauses the program and waits for the player to type a line. What they type comes back <b>as text</b>: <code>name = input(\"Your name? \")</code>. The text in the brackets is the question that is shown.",
        "Even if the player types <code>5</code>, you get the <b>text</b> \"5\". Convert it with <code>int()</code> for whole numbers or <code>float()</code> for decimals before you do any maths.",
        "In these lessons there is no keyboard to type on while the program runs, so the exercises tell you what the player types.",
      ],
      try: { code: 'name = input("Your name? ")\nage = int(input("Your age? "))\nprint(f"{name} will be {age + 1} next year")', stdin: ["Ada", "36"], note: "The box below holds what the player types, one line for each input(). Change the values." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: 'word = input()\nprint(word * 2)', stdin: ["ha"], why: "The text ha is repeated twice." },
        { type: "predict", prompt: "What will this show?", code: 'n = input()\nprint(n * 2)', stdin: ["21"], why: "input gives text, so \"21\" * 2 repeats the text: 2121, not 42." },
        { type: "fix", prompt: "The player types <b>5</b> and it should show <b>6</b>, but it crashes. Fix it.", code: "age = input()\nprint(age + 1)", stdin: ["5"], solution: "age = int(input())\nprint(age + 1)", expect: "6", why: "input gives text. Turn it into a number with int()." },
        { type: "write", prompt: "Read a name and an age, and print <b>Ada will be 37 next year</b> (age + 1, converted to a number first).", stdin: ["Ada", "36"], start: "", solution: 'name = input()\nage = int(input())\nprint(f"{name} will be {age + 1} next year")', expect: "Ada will be 37 next year", must: /int\s*\(/, why: "name = input(), age = int(input()), then an f-string." },
      ] },
    { id: "7.2", title: "Reading error messages", bug: "An error message is a clue, not an insult. Read the LAST line first: it names the problem. The line number tells you where.",
      read: [
        "When Python can't continue, it stops with an <b>error message</b>. Read the <b>last line first</b>: it starts with the error's name and tells you what went wrong. The line number says where to look.",
        "The common ones: <code>SyntaxError</code> (the code is written wrongly, like a missing colon or quote), <code>NameError</code> (a name that does not exist, usually a typo), <code>TypeError</code> (wrong kind of value, like text + number), <code>ValueError</code> (right kind but a bad value, like <code>int(\"abc\")</code>), <code>IndexError</code> (a list position that is not there), <code>KeyError</code> (a missing dictionary key), <code>ZeroDivisionError</code>.",
        "To find <b>bugs that don't crash</b>, print the values: <code>print(\"x is\", x)</code> shows what your program really thinks.",
      ],
      try: { code: 'nums = [1, 2, 3]\nprint(nums[5])', expectError: true, note: "Run it, read the red message, then fix it. Break other things on purpose: use an undefined name, add text to a number." },
      ex: [
        { type: "choice", prompt: "<code>print(score)</code> when <code>score</code> was never created gives:", options: ["SyntaxError", "NameError", "TypeError"], answer: 1, why: "A name that Python does not know is a NameError." },
        { type: "choice", prompt: "<code>\"age: \" + 5</code> gives:", options: ["ValueError", "NameError", "TypeError"], answer: 2, why: "You can't add text and a number. That is a wrong kind of value: TypeError." },
        { type: "choice", prompt: "<code>int(\"abc\")</code> gives:", options: ["ValueError", "TypeError", "IndexError"], answer: 0, why: "The kind (text) is fine for int(), but this value can't become a number. That is a ValueError." },
        { type: "fix", prompt: "This program has <b>two</b> bugs. Fix both so it shows <b>6</b>.", code: "numbers = [1, 2, 3]\ntotal = 0\nfor n in numbers\n    total += n\nprint(totl)", solution: "numbers = [1, 2, 3]\ntotal = 0\nfor n in numbers:\n    total += n\nprint(total)", expect: "6", why: "A missing colon, and a typo in the name total." },
      ] },
    { id: "7.3", title: "try and except", bug: "try runs the risky code. If it fails, Python jumps to except instead of crashing.",
      read: [
        "Some errors you can't avoid: the player may type letters where you expect a number. With <code>try</code> / <code>except</code> you decide what happens instead of crashing.",
        "Python runs the <code>try</code> block. If an error of the named type happens, it jumps to the matching <code>except</code> block. If nothing goes wrong, <code>except</code> is skipped. An optional <code>else</code> block runs only when there was no error.",
        "Name the error you expect: <code>except ValueError:</code>. A bare <code>except:</code> catches everything, even your own typos, which hides bugs.",
      ],
      try: { code: 'text = input("A number: ")\ntry:\n    n = int(text)\n    print("Double:", n * 2)\nexcept ValueError:\n    print("That is not a number")', stdin: ["abc"], note: "Try the input 12 and the input abc." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: 'try:\n    n = int("x")\n    print("ok")\nexcept ValueError:\n    print("bad")', why: "int(\"x\") fails before the ok line, so Python jumps to the except block." },
        { type: "predict", prompt: "What will this show?", code: 'try:\n    print(10 / 2)\nexcept ZeroDivisionError:\n    print("no")\nelse:\n    print("fine")', why: "Nothing failed, so except is skipped and else runs after the try block." },
        { type: "write", prompt: "Write <code>safe_int(text)</code> that returns <code>int(text)</code>, or <b>0</b> if the text is not a number.", start: "", solution: "def safe_int(text):\n    try:\n        return int(text)\n    except ValueError:\n        return 0", tests: [["safe_int('12')", "12"], ["safe_int('x')", "0"], ["safe_int('')", "0"]], must: /except/, why: "try: return int(text) and except ValueError: return 0." },
        { type: "write", prompt: "Write <code>divide(a, b)</code> that returns a / b, or <code>None</code> when b is 0.", start: "", solution: "def divide(a, b):\n    try:\n        return a / b\n    except ZeroDivisionError:\n        return None", tests: [["divide(6, 3)", "2.0"], ["divide(1, 0)", "None"]], must: /except/, why: "Catch ZeroDivisionError and return None." },
      ] },
    { id: "7.4", title: "raise, finally and assert", bug: "raise lets YOU start an error when something is wrong. finally runs no matter what.",
      read: [
        "You can create an error yourself with <code>raise</code>: <code>raise ValueError(\"age can't be negative\")</code>. That is how a function says 'you gave me something I can't work with'. Catch it as <code>except ValueError as e:</code> and <code>e</code> holds the message.",
        "A <code>finally</code> block runs <b>always</b>, whether there was an error or not. Use it for clean-up.",
        "<code>assert condition, \"message\"</code> is a quick check for yourself: if the condition is False, it stops with an AssertionError.",
      ],
      try: { code: 'def check_age(age):\n    if age < 0:\n        raise ValueError("age can\'t be negative")\n    return age\n\ntry:\n    check_age(-1)\nexcept ValueError as e:\n    print("caught:", e)\nfinally:\n    print("done")', note: "Change -1 to 5." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: 'try:\n    raise ValueError("bad")\nexcept ValueError as e:\n    print("caught", e)', why: "raise starts the error, except catches it, and e holds the message." },
        { type: "predict", prompt: "What will this show?", code: 'try:\n    print("a")\nfinally:\n    print("b")\nprint("c")', why: "finally always runs after the try block." },
        { type: "write", prompt: "Write <code>check_age(age)</code> that raises <code>ValueError(\"negative\")</code> if age is below 0, otherwise returns age.", start: "", solution: 'def check_age(age):\n    if age < 0:\n        raise ValueError("negative")\n    return age', tests: [["check_age(5)", "5"], ["check_age(0)", "0"], ["check_age(-1)", "error: ValueError: negative"]], must: /raise/, why: "if age < 0: raise ValueError(\"negative\")." },
      ] },
    { id: "7.5", title: "Mini project: safe calculator", bug: "Assume the player will type something silly. Wrap the risky parts, give a friendly message, and keep going.",
      read: [
        "Real programs expect bad input. Combine <code>input</code>, <code>int/float</code>, <code>try/except</code> and functions to make a calculator that never crashes.",
      ],
      try: { code: 'a = float(input("First: "))\nb = float(input("Second: "))\ntry:\n    print(a / b)\nexcept ZeroDivisionError:\n    print("Cannot divide by zero")', stdin: ["10", "0"], note: "Try the inputs 10 and 4." },
      ex: [
        { type: "write", prompt: "Read two numbers (as whole numbers). Print their quotient <code>a / b</code>, but if the second is 0 print <b>Cannot divide by zero</b>.", stdin: ["10", "0"], start: "", solution: 'a = int(input())\nb = int(input())\ntry:\n    print(a / b)\nexcept ZeroDivisionError:\n    print("Cannot divide by zero")', expect: "Cannot divide by zero", must: /except/, why: "Convert both inputs, then try the division and catch ZeroDivisionError." },
        { type: "write", prompt: "Read one value. If it is not a whole number, print <b>Not a number</b>, otherwise print the number plus one.", stdin: ["abc"], start: "", solution: 'text = input()\ntry:\n    print(int(text) + 1)\nexcept ValueError:\n    print("Not a number")', expect: "Not a number", must: /except/, why: "int(text) fails for abc with a ValueError, which you catch." },
        { type: "write", prompt: "Write <code>parse_number(text)</code> that returns the text as a float, or <code>None</code> if that is not possible.", start: "", solution: "def parse_number(text):\n    try:\n        return float(text)\n    except ValueError:\n        return None", tests: [["parse_number('2.5')", "2.5"], ["parse_number('7')", "7.0"], ["parse_number('abc')", "None"]], why: "try: return float(text), except ValueError: return None." },
      ] },
  ] });
})(typeof window !== "undefined" ? window : globalThis);
