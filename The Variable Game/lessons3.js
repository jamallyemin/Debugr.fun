// Chapter 3 (Decisions) and chapter 4 (Loops). See lessons.js for the exercise types.
(function (root) {
  "use strict";
  const L = typeof module !== "undefined" && module.exports ? require("./lessons.js") : root.Lessons;

  L.add({ id: 3, name: "Decisions", sub: "True, False, if, elif, else", lessons: [
    { id: "3.1", title: "True and False", bug: "A comparison is a yes/no question. Python answers with True or False, nothing else.",
      read: [
        "Python can ask yes/no questions. The answer is a special value: <code>True</code> or <code>False</code>. They are called <b>booleans</b>, and they are written with a capital first letter.",
        "To ask a question you compare two things: <code>==</code> equal, <code>!=</code> not equal, <code>&lt;</code> smaller, <code>&gt;</code> bigger, <code>&lt;=</code> smaller or equal, <code>&gt;=</code> bigger or equal.",
        "Careful: one <code>=</code> <b>stores</b> a value (<code>x = 5</code>). Two <code>==</code> <b>ask</b> if things are equal (<code>x == 5</code>). Text is compared letter by letter, and capitals count.",
      ],
      try: { code: 'print(5 > 3)\nprint(5 == 6)\nprint(4 != 4)\nprint("a" == "A")\nage = 15\nprint(age >= 13)', note: "Read each line and guess True or False before you run it." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "print(10 > 3)", why: "10 is bigger than 3, so the answer is True." },
        { type: "choice", prompt: "Which line <b>asks</b> whether x is equal to 5?", options: ["<code>x = 5</code>", "<code>x == 5</code>", "<code>x => 5</code>"], answer: 1, why: "== asks the question. A single = stores a value, and => is not valid Python." },
        { type: "fill", prompt: "Fill the blank so it shows <b>False</b>.", code: "print(7 ___ 7)", answer: "!=", expect: "False", why: "7 is equal to 7, so 'not equal' is False." },
        { type: "write", prompt: "Make <code>age = 15</code> and print whether age is at least 13. Show <b>True</b>.", start: "", solution: "age = 15\nprint(age >= 13)", expect: "True", must: /age\s*>=\s*13/, why: "print(age >= 13) asks the question and prints the answer." },
      ] },
    { id: "3.2", title: "if", bug: "if asks a question. If the answer is True, the indented lines run. The colon and the 4 spaces are part of the rule.",
      read: [
        "An <code>if</code> statement runs some code only when a condition is <code>True</code>.",
        "The line ends with a colon <code>:</code>, and the code that belongs to it is <b>indented</b> (pushed in 4 spaces). The indentation is how Python knows which lines are inside the if.",
        "When the condition is False, Python skips the indented lines and carries on with the first line that is not indented.",
      ],
      try: { code: 'temp = 31\nif temp > 30:\n    print("It is hot")\n    print("Drink water")\nprint("Done")', note: "Change temp to 20. Which lines still run?" },
      ex: [
        { type: "predict", prompt: "What will this show?", code: 'x = 4\nif x > 10:\n    print("big")\nprint("end")', why: "4 is not bigger than 10, so the indented line is skipped. The last line is not indented, so it always runs." },
        { type: "fix", prompt: "Python complains. Fix it so it shows <b>yes</b>.", code: 'if 5 > 3\n    print("yes")', solution: 'if 5 > 3:\n    print("yes")', expect: "yes", why: "An if line must end with a colon." },
        { type: "fill", prompt: "Fill the blank so it shows <b>Winner</b>.", code: 'score = 12\nif score ___ 10:\n    print("Winner")', answer: ">", expect: "Winner", why: "12 is bigger than 10, so score > 10 is True." },
        { type: "write", prompt: "With <code>temp = 31</code>, print <b>Hot</b> only if temp is above 30.", start: "temp = 31\n", solution: 'temp = 31\nif temp > 30:\n    print("Hot")', expect: "Hot", must: /if\s+temp\s*>\s*30\s*:/, why: "if temp > 30: then an indented print." },
      ] },
    { id: "3.3", title: "else and elif", bug: "elif means 'otherwise, if...'. Python checks from the top and stops at the first True one.",
      read: [
        "<code>else</code> runs when the if condition was False. It has no condition of its own.",
        "For more than two choices use <code>elif</code> (short for 'else if'). Python checks the conditions <b>from the top</b>, runs the first one that is True, and skips all the rest.",
        "So the order matters. Put the most specific check first.",
      ],
      try: { code: 'score = 75\nif score >= 90:\n    print("A")\nelif score >= 70:\n    print("B")\nelse:\n    print("C")', note: "Try score = 95, 70 and 20." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: 'n = 5\nif n > 10:\n    print("big")\nelse:\n    print("small")', why: "5 is not above 10, so the else part runs." },
        { type: "predict", prompt: "What will this show?", code: 'n = 15\nif n > 5:\n    print("one")\nelif n > 10:\n    print("two")', why: "Python stops at the first True condition. n > 5 is already True, so 'two' is never checked." },
        { type: "fix", prompt: "One thing is wrong in the first line. Fix it so it shows <b>three</b>.", code: 'x = 3\nif x = 3:\n    print("three")', solution: 'x = 3\nif x == 3:\n    print("three")', expect: "three", why: "Inside a condition you ask with ==. A single = would store a value." },
        { type: "write", prompt: "With <code>score = 75</code>: print <b>A</b> if it is 90 or more, <b>B</b> if it is 70 or more, otherwise <b>C</b>. It should show <b>B</b>.", start: "score = 75\n", solution: 'score = 75\nif score >= 90:\n    print("A")\nelif score >= 70:\n    print("B")\nelse:\n    print("C")', expect: "B", must: /elif/, why: "Use if, elif and else, with the 90 check first." },
      ] },
    { id: "3.4", title: "and, or, not", bug: "and needs both sides True. or needs only one. not flips the answer.",
      read: [
        "You can combine questions. <code>and</code> is True only if <b>both</b> sides are True. <code>or</code> is True if <b>at least one</b> side is True. <code>not</code> flips True to False and the other way round.",
        "You can chain comparisons the way you would in maths: <code>10 &lt; x &lt; 20</code> means x is between 10 and 20.",
        "Use brackets when you mix them, so it is clear what goes with what: <code>(a or b) and c</code>.",
      ],
      try: { code: 'age = 15\nhas_ticket = True\nprint(age >= 12 and has_ticket)\nprint(age < 10 or age > 60)\nprint(not has_ticket)\nprint(10 < age < 20)', note: "Change age to 8 and run again." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "print(True and False)", why: "and needs both sides to be True. One is False, so the answer is False." },
        { type: "predict", prompt: "What will this show?", code: "print(not (3 > 5))", why: "3 > 5 is False, and not flips it to True." },
        { type: "fill", prompt: "Fill the blank so it shows <b>True</b>.", code: "print(2 > 5 ___ 9 > 5)", answer: "or", expect: "True", why: "The first part is False but the second is True, and or only needs one." },
        { type: "write", prompt: "With <code>x = 15</code>, print whether x is bigger than 10 <b>and</b> smaller than 20. Show <b>True</b>.", start: "x = 15\n", solution: "x = 15\nprint(x > 10 and x < 20)", expect: "True", must: /and|<\s*x\s*</, why: "print(x > 10 and x < 20)." },
      ] },
    { id: "3.5", title: "Truthy, falsy and shortcuts", bug: "Python treats empty things and zero as False. Handy shortcut, but it can surprise you.",
      read: [
        "<code>in</code> checks if something is inside something else: <code>\"a\" in \"cat\"</code> is True.",
        "Python can treat any value as True or False. These count as <b>False</b>: <code>0</code>, <code>0.0</code>, <code>\"\"</code> (empty text), <code>[]</code> (an empty list) and <code>None</code>. Almost everything else counts as True. <code>bool(value)</code> shows which one.",
        "A one-line if/else is called a <b>conditional expression</b>: <code>\"even\" if n % 2 == 0 else \"odd\"</code>. Use <code>is None</code> to check for nothing.",
      ],
      try: { code: 'print(bool(0), bool(7), bool(""), bool("hi"))\nprint("a" in "cat")\nn = 8\nprint("even" if n % 2 == 0 else "odd")\nname = ""\nif not name:\n    print("no name yet")', note: "Find what else is falsy: try bool([]) and bool(None)." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: 'print(bool(""))', why: "Empty text counts as False." },
        { type: "predict", prompt: "What will this show?", code: 'print("z" in "cat")', why: "There is no z in cat." },
        { type: "choice", prompt: "Which of these counts as <b>False</b>?", options: ["<code>\"False\"</code>", "<code>0</code>", "<code>[0]</code>", "<code>\" \"</code>"], answer: 1, why: "Zero is False. Text with anything in it (even \"False\" or a space) is True, and so is a list with something in it." },
        { type: "write", prompt: "With <code>n = 8</code>, use a one-line if/else to print <b>even</b> or <b>odd</b>. Show <b>even</b>.", start: "n = 8\n", solution: 'n = 8\nprint("even" if n % 2 == 0 else "odd")', expect: "even", must: /\bif\b.*\belse\b/, why: "print(\"even\" if n % 2 == 0 else \"odd\")." },
      ] },
    { id: "3.6", title: "Mini project: decisions", bug: "Break each problem into small yes/no questions, then write one if for each.",
      read: [
        "Time to use everything from this chapter: comparisons, <code>if / elif / else</code>, <code>and / or / not</code> and the remainder <code>%</code>.",
        "Work one question at a time. Think about which question has to be asked first.",
      ],
      try: { code: 'year = 2100\nif year % 400 == 0 or (year % 4 == 0 and year % 100 != 0):\n    print("leap year")\nelse:\n    print("not a leap year")', note: "A leap year divides by 4, except centuries, unless they divide by 400. Try 2000, 2024 and 2100." },
      ex: [
        { type: "write", prompt: "<code>year = 2024</code>. Print <b>Leap</b> if it is a leap year, otherwise <b>Normal</b>. (Divisible by 4, but not by 100 unless also by 400.)", start: "year = 2024\n", solution: 'year = 2024\nif year % 400 == 0 or (year % 4 == 0 and year % 100 != 0):\n    print("Leap")\nelse:\n    print("Normal")', expect: "Leap", must: /%/, why: "Combine three remainder checks with and / or." },
        { type: "write", prompt: "<code>n = 30</code>. Print <b>FizzBuzz</b> if n divides by 3 and by 5, <b>Fizz</b> if only by 3, <b>Buzz</b> if only by 5, else the number.", start: "n = 30\n", solution: 'n = 30\nif n % 15 == 0:\n    print("FizzBuzz")\nelif n % 3 == 0:\n    print("Fizz")\nelif n % 5 == 0:\n    print("Buzz")\nelse:\n    print(n)', expect: "FizzBuzz", must: /elif/, why: "Check the 'both' case first, otherwise the Fizz check would catch it." },
        { type: "write", prompt: "<code>speed = 72</code> and <code>limit = 50</code>. If the speed is over the limit, print <b>Fine: 22</b> (the number is how much over). Otherwise print <b>OK</b>. Use an f-string.", start: "speed = 72\nlimit = 50\n", solution: 'speed = 72\nlimit = 50\nif speed > limit:\n    print(f"Fine: {speed - limit}")\nelse:\n    print("OK")', expect: "Fine: 22", must: /f["']/, why: "An f-string can do the math inside the brackets: {speed - limit}." },
      ] },
  ] });

  L.add({ id: 4, name: "Loops", sub: "for, while, break, continue", lessons: [
    { id: "4.1", title: "for loops", bug: "A for loop repeats the indented lines. range(3) gives 0, 1, 2. Programmers start counting at 0!",
      read: [
        "A <b>loop</b> repeats code so you do not have to write it again and again.",
        "<code>for i in range(3):</code> runs the indented lines 3 times. The variable <code>i</code> takes the values <code>0, 1, 2</code>, one for each round.",
        "Note that <code>range(3)</code> stops <b>before</b> 3. Python counts from 0. As with <code>if</code>, the loop line ends with a colon and the body is indented.",
      ],
      try: { code: 'for i in range(3):\n    print("round", i)\nprint("finished")', note: "Change 3 to 5. Then use i in a sum: print(i * 10)." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: 'for i in range(3):\n    print("hi")', why: "The body runs 3 times." },
        { type: "predict", prompt: "What will this show?", code: "for i in range(3):\n    print(i)", why: "range(3) gives 0, 1 and 2. It stops before 3." },
        { type: "fill", prompt: "Fill the blank so it shows <b>0 1 2 3</b> (one per line).", code: "for i in ___(4):\n    print(i)", answer: "range", expect: "0\n1\n2\n3", why: "range(4) gives 0, 1, 2, 3." },
        { type: "write", prompt: "Use a loop to print <b>Bug!</b> three times.", start: "", solution: 'for i in range(3):\n    print("Bug!")', expect: "Bug!\nBug!\nBug!", must: /\bfor\b/, why: "for i in range(3): and an indented print." },
      ] },
    { id: "4.2", title: "range tricks", bug: "range(start, stop, step): it starts AT start, stops BEFORE stop, and jumps by step.",
      read: [
        "<code>range</code> can take up to three numbers: <code>range(start, stop, step)</code>.",
        "<code>range(2, 5)</code> gives 2, 3, 4. <code>range(0, 10, 3)</code> gives 0, 3, 6, 9. A negative step counts down: <code>range(5, 0, -1)</code> gives 5, 4, 3, 2, 1.",
        "The stop number is never included. It is the first number you do <b>not</b> want.",
      ],
      try: { code: 'for i in range(2, 5):\n    print(i)\nprint("--")\nfor i in range(10, 0, -3):\n    print(i)', note: "Print the even numbers from 2 to 10 using a step of 2." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "for i in range(2, 5):\n    print(i)", why: "It starts at 2 and stops before 5: 2, 3, 4." },
        { type: "predict", prompt: "What will this show?", code: "for i in range(0, 10, 3):\n    print(i)", why: "It jumps by 3: 0, 3, 6, 9. The next would be 12, which is past the end." },
        { type: "fill", prompt: "Fill the blank so it counts down: <b>3 2 1</b> (one per line).", code: "for i in range(3, 0, ___):\n    print(i)", answer: "-1", expect: "3\n2\n1", why: "A step of -1 counts downwards." },
        { type: "write", prompt: "Print the numbers <b>5 4 3 2 1</b> (one per line) with a loop and a negative step.", start: "", solution: "for i in range(5, 0, -1):\n    print(i)", expect: "5\n4\n3\n2\n1", must: /range\(\s*5\s*,\s*0\s*,\s*-1\s*\)/, why: "range(5, 0, -1) starts at 5 and stops before 0." },
      ] },
    { id: "4.3", title: "Adding things up", bug: "Make the box (total = 0) BEFORE the loop, then put something into it each round.",
      read: [
        "A very common pattern is an <b>accumulator</b>: a variable that grows while the loop runs. Make it before the loop, then update it inside.",
        "<code>total = total + i</code> can be shortened to <code>total += i</code>. The same works for <code>-=</code>, <code>*=</code> and so on.",
        "If you create the variable <b>inside</b> the loop, it is reset to its start value in every round, and you lose the total.",
      ],
      try: { code: 'total = 0\nfor i in range(1, 5):\n    total += i\n    print(i, total)\nprint("sum:", total)', note: "Watch how total grows. Change range to include 10." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "total = 0\nfor i in range(1, 5):\n    total += i\nprint(total)", why: "1 + 2 + 3 + 4 = 10." },
        { type: "fix", prompt: "This should show <b>6</b>, but total keeps being reset. Fix it.", code: "for i in range(1, 4):\n    total = 0\n    total = total + i\nprint(total)", solution: "total = 0\nfor i in range(1, 4):\n    total = total + i\nprint(total)", expect: "6", why: "Create total once, before the loop. Inside the loop it was reset every round." },
        { type: "write", prompt: "Add up the numbers 1 to 100 with a loop and print the result (<b>5050</b>).", start: "", solution: "total = 0\nfor i in range(1, 101):\n    total += i\nprint(total)", expect: "5050", must: /\bfor\b/, why: "range(1, 101) includes 100. Start total at 0." },
        { type: "write", prompt: "Print 5 factorial: 1 × 2 × 3 × 4 × 5, with a loop (<b>120</b>). Start from 1, not 0!", start: "", solution: "result = 1\nfor i in range(1, 6):\n    result *= i\nprint(result)", expect: "120", must: /\bfor\b/, why: "A product has to start at 1. If it started at 0, everything would be 0." },
      ] },
    { id: "4.4", title: "while loops", bug: "while repeats as long as its question stays True. Make sure something inside changes it, or it never stops!",
      read: [
        "<code>for</code> is for when you know how many times. <code>while</code> keeps going <b>as long as a condition is True</b>, and you do not need to know how many rounds that is.",
        "Something inside the loop has to change the condition. Otherwise it is an <b>infinite loop</b>. (Our editor stops your program after 5 seconds, so you will not get stuck.)",
        "A typical pattern: <code>n = 3</code>, then <code>while n &gt; 0:</code>, do something, then <code>n -= 1</code>.",
      ],
      try: { code: 'n = 3\nwhile n > 0:\n    print(n)\n    n -= 1\nprint("liftoff!")', note: "Change the starting number. What happens if you remove the n -= 1 line? (The editor stops it after 5 seconds.)" },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "n = 3\nwhile n > 0:\n    print(n)\n    n -= 1", why: "It prints 3, 2, 1, and stops when n reaches 0." },
        { type: "predict", prompt: "What will this show?", code: "x = 1\nwhile x < 100:\n    x = x * 2\nprint(x)", why: "x doubles: 2, 4, 8, 16, 32, 64, 128. The loop stops as soon as x is not below 100 anymore." },
        { type: "fill", prompt: "Fill the blank so it counts up to <b>3</b> (one per line).", code: "n = 1\nwhile n <= 3:\n    print(n)\n    n = n ___ 1", answer: "+", expect: "1\n2\n3", why: "Add 1 each round, otherwise the loop would never end." },
        { type: "write", prompt: "Use a <code>while</code> loop to print <b>1 2 3 4 5</b> (one per line).", start: "", solution: "n = 1\nwhile n <= 5:\n    print(n)\n    n += 1", expect: "1\n2\n3\n4\n5", must: /\bwhile\b/, why: "Start at 1, loop while n <= 5, and add 1 each round." },
      ] },
    { id: "4.5", title: "break and continue", bug: "break leaves the loop completely. continue skips only the rest of this round.",
      read: [
        "<code>break</code> stops the loop right away, even if there would have been more rounds.",
        "<code>continue</code> jumps straight to the next round and skips the lines below it.",
        "<code>while True:</code> loops forever, and a <code>break</code> inside is how you get out. You will use that a lot.",
      ],
      try: { code: 'for i in range(1, 8):\n    if i == 3:\n        continue\n    if i == 6:\n        break\n    print(i)', note: "Which numbers show up? Why not 3 and 6?" },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "for i in range(5):\n    if i == 2:\n        continue\n    print(i)", why: "When i is 2, continue skips the print. Everything else shows." },
        { type: "predict", prompt: "What will this show?", code: "for i in range(5):\n    if i == 2:\n        break\n    print(i)", why: "At 2 the loop stops completely, so only 0 and 1 are printed." },
        { type: "choice", prompt: "What does <code>continue</code> do?", options: ["Stops the whole loop", "Skips the rest of this round and goes on with the next", "Starts the program again"], answer: 1, why: "continue only skips the current round. break is the one that stops everything." },
        { type: "write", prompt: "Print the numbers 1 to 10, one per line, but <b>skip 5</b> using <code>continue</code>.", start: "", solution: "for i in range(1, 11):\n    if i == 5:\n        continue\n    print(i)", expect: "1\n2\n3\n4\n6\n7\n8\n9\n10", must: /continue/, why: "if i == 5: continue, then print(i)." },
      ] },
    { id: "4.6", title: "Loops inside loops", bug: "For every round of the outer loop, the inner loop runs completely. Think of minutes and hours on a clock.",
      read: [
        "You can put a loop inside another loop. For <b>each</b> round of the outer loop, the inner loop runs all its rounds.",
        "With <code>for i in range(2)</code> outside and <code>for j in range(3)</code> inside, the inner body runs 2 × 3 = 6 times.",
        "Text can be repeated with <code>*</code>, so <code>\"*\" * 3</code> is <code>***</code>. That is handy for drawing shapes.",
      ],
      try: { code: 'for i in range(2):\n    for j in range(3):\n        print(i, j)\nprint("--")\nfor row in range(1, 4):\n    print("*" * row)', note: "Look at the order of the pairs." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "for i in range(2):\n    for j in range(2):\n        print(i, j)", why: "For i = 0 the inner loop gives j = 0, 1, then for i = 1 again j = 0, 1." },
        { type: "predict", prompt: "What will this show?", code: 'for n in range(1, 4):\n    print("#" * n)', why: "The text is repeated n times: 1, 2, then 3 characters." },
        { type: "fix", prompt: "Fix the indentation so it shows <b>0 0</b> then <b>0 1</b>.", code: "for i in range(1):\n    for j in range(2):\n    print(i, j)", solution: "for i in range(1):\n    for j in range(2):\n        print(i, j)", expect: "0 0\n0 1", why: "The print belongs to the inner loop, so it needs one more level of indentation." },
        { type: "write", prompt: "Print this triangle with a loop:<br><code>*</code><br><code>**</code><br><code>***</code><br><code>****</code>", start: "", solution: 'for i in range(1, 5):\n    print("*" * i)', expect: "*\n**\n***\n****", must: /\bfor\b/, why: "for i in range(1, 5): print(\"*\" * i)." },
      ] },
    { id: "4.7", title: "Mini project: loops", bug: "Pick the loop that fits: for when you know the count, while True with break when you are searching.",
      read: [
        "Time to combine loops with decisions. Remember: accumulators start before the loop, and a search loop stops with <code>break</code> as soon as it finds what it wants.",
      ],
      try: { code: 'for n in range(1, 16):\n    if n % 3 == 0 and n % 5 == 0:\n        print("FizzBuzz")\n    elif n % 3 == 0:\n        print("Fizz")\n    elif n % 5 == 0:\n        print("Buzz")\n    else:\n        print(n)', note: "This is the famous FizzBuzz. Read it line by line before you run it." },
      ex: [
        { type: "write", prompt: "Add up only the <b>even</b> numbers from 1 to 20 and print the total (<b>110</b>).", start: "", solution: "total = 0\nfor i in range(1, 21):\n    if i % 2 == 0:\n        total += i\nprint(total)", expect: "110", must: /%/, why: "Check i % 2 == 0 inside the loop before adding." },
        { type: "write", prompt: "Print the 7 times table up to 3: <b>7 x 1 = 7</b>, <b>7 x 2 = 14</b>, <b>7 x 3 = 21</b> (one per line). Use an f-string.", start: "", solution: 'for i in range(1, 4):\n    print(f"7 x {i} = {7 * i}")', expect: "7 x 1 = 7\n7 x 2 = 14\n7 x 3 = 21", must: /f["']/, why: "print(f\"7 x {i} = {7 * i}\") inside a loop over 1, 2, 3." },
        { type: "write", prompt: "Find the first number (counting up from 1) that divides by both 7 and 5, print it (<b>35</b>) and stop with <code>break</code>.", start: "", solution: "n = 1\nwhile True:\n    if n % 7 == 0 and n % 5 == 0:\n        print(n)\n        break\n    n += 1", expect: "35", must: /break/, why: "A while True loop that counts up and breaks when both remainders are 0." },
      ] },
  ] });
})(typeof window !== "undefined" ? window : globalThis);
