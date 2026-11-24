// Chapter 13: Under the hood (mutability, scope, numbers, bytes, odd types).
(function (root) {
  "use strict";
  const L = typeof module !== "undefined" && module.exports ? require("./lessons.js") : root.Lessons;

  L.add({ id: 13, name: "Under the hood", sub: "mutability, scope, bits, bytes", lessons: [
    { id: "13.1", title: "Names, objects and copies", bug: "A variable is a label on an object. Two labels can point at the same list.",
      read: [
        "<code>b = a</code> does <b>not</b> copy a list. It puts a second label on the <b>same</b> object, so changing it through one name shows through the other. <code>is</code> asks \"same object?\", <code>==</code> asks \"same contents?\".",
        "Lists, dicts and sets are <b>mutable</b> (can change). Numbers, strings and tuples are <b>immutable</b>.",
        "Make a copy with <code>a.copy()</code>, <code>list(a)</code> or <code>a[:]</code>. These copy only the <b>outer</b> list. For nested lists use <code>copy.deepcopy(a)</code>.",
      ],
      try: { code: 'import copy\n\na = [[1], [2]]\nb = a\nc = a.copy()\nd = copy.deepcopy(a)\n\na[0].append(99)\nprint(b)\nprint(c)\nprint(d)\nprint(a is b, a is c, a == d)', note: "c is a copy, yet it shows 99 too. Why? (The inner lists are shared.)" },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "a = [1, 2]\nb = a\nb.append(3)\nprint(a)", why: "Both names point at the same list." },
        { type: "predict", prompt: "What will this show?", code: "a = [[1], [2]]\nb = a.copy()\nb[0].append(9)\nprint(a)", why: "A shallow copy shares the inner lists." },
        { type: "fix", prompt: "Changing <code>copy</code> also changes <code>original</code>. Make the program print <b>[1, 2, 3]</b> then <b>[1, 2]</b>.", code: "original = [1, 2]\ncopy = original\ncopy.append(3)\nprint(copy)\nprint(original)", solution: "original = [1, 2]\ncopy = original.copy()\ncopy.append(3)\nprint(copy)\nprint(original)", expect: "[1, 2, 3]\n[1, 2]", why: ".copy() makes a new list." },
        { type: "write", prompt: "Write <code>add_row(grid)</code> that returns a <b>new</b> grid (list of lists) with a row <code>[0, 0]</code> added at the end, <b>without changing</b> the grid you were given, even inside its rows.", start: "", solution: "import copy\n\ndef add_row(grid):\n    new = copy.deepcopy(grid)\n    new.append([0, 0])\n    return new", tests: [["g = [[1, 2]]; r = add_row(g)", "(r, g)", "([[1, 2], [0, 0]], [[1, 2]])"], ["g = [[1, 2]]; r = add_row(g); r[0].append(5)", "g", "[[1, 2]]"]], why: "deepcopy protects the inner lists too." },
      ] },
    { id: "13.2", title: "Scope: global and nonlocal", bug: "Where a name lives decides who can change it. global and nonlocal reach outwards.",
      read: [
        "A name made inside a function is <b>local</b>. Assigning to a name makes it local, even if an outer one exists. That causes the classic <code>UnboundLocalError</code> when you try <code>count += 1</code> on an outer name.",
        "<code>global name</code> says \"use the module level one\". <code>nonlocal name</code> says \"use the one from the function around me\". That is how a closure can change its own saved value.",
        "Prefer passing values in and returning results. Use <code>global</code> rarely, <code>nonlocal</code> for small counters and closures.",
      ],
      try: { code: 'def make_counter():\n    n = 0\n    def step():\n        nonlocal n\n        n += 1\n        return n\n    return step\n\nc = make_counter()\nprint(c(), c(), c())\n\ntotal = 0\ndef add(x):\n    global total\n    total += x\n\nadd(5); add(6)\nprint(total)', note: "Remove the nonlocal line and see the error." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "x = 'outer'\ndef f():\n    x = 'inner'\nf()\nprint(x)", why: "Assigning inside makes a new local x. The outer one is untouched." },
        { type: "predict", prompt: "What will this show?", code: "def outer():\n    n = 1\n    def inner():\n        nonlocal n\n        n += 10\n    inner()\n    return n\n\nprint(outer())", why: "nonlocal lets inner change outer's n." },
        { type: "fix", prompt: "This crashes with an <code>UnboundLocalError</code>. Make it print <b>3</b>.", code: "count = 0\n\ndef bump():\n    count += 1\n\nbump(); bump(); bump()\nprint(count)", solution: "count = 0\n\ndef bump():\n    global count\n    count += 1\n\nbump(); bump(); bump()\nprint(count)", expect: "3", must: /global/, why: "Without global, += tries to read a local count that does not exist." },
        { type: "write", prompt: "Write <code>make_accumulator()</code> that returns a function. Each call of that function adds its argument to a running total and <b>returns the total</b>.", start: "", solution: "def make_accumulator():\n    total = 0\n    def add(x):\n        nonlocal total\n        total += x\n        return total\n    return add", tests: [["a = make_accumulator(); a(5)", "a(10)", "15"], ["a = make_accumulator(); b = make_accumulator(); a(1)", "b(2)", "2"]], must: /nonlocal/, why: "Every accumulator keeps its own total." },
      ] },
    { id: "13.3", title: "Bits and numbers", bug: "Numbers are bits underneath. Bitwise operators work on those bits directly.",
      read: [
        "<code>&amp;</code> is AND, <code>|</code> is OR, <code>^</code> is XOR (different), <code>~</code> flips, <code>&lt;&lt;</code> and <code>&gt;&gt;</code> shift bits left or right. Shifting left by 1 doubles a number, right by 1 halves it.",
        "<code>bin(n)</code> shows binary, <code>hex(n)</code> shows hexadecimal and <code>int(\"101\", 2)</code> reads binary. <code>n.bit_count()</code> counts the 1 bits.",
        "A common trick is a <b>flags</b> number: each bit means one yes/no setting. <code>flags &amp; 4</code> checks bit 2, <code>flags | 4</code> turns it on.",
      ],
      try: { code: 'print(bin(10), hex(255), int("101", 2))\nprint(6 & 3, 6 | 3, 6 ^ 3)\nprint(1 << 4, 64 >> 2)\nprint((10).bit_count())\n\nflags = 0\nflags |= 4\nprint(flags, bool(flags & 4), bool(flags & 2))', note: "What is 5 ^ 5?" },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "print(5 & 3, 5 | 3, 5 ^ 3)", why: "101 and 011 give 001 (1), 111 (7) and 110 (6)." },
        { type: "predict", prompt: "What will this show?", code: "print(3 << 3)", why: "Each shift left doubles: 3 * 8." },
        { type: "fill", prompt: "Fill the blank to test whether <code>n</code> is <b>odd</b> using its lowest bit.", code: "n = 7\nprint(n ___ 1 == 1)", answer: "&", expect: "True", why: "The lowest bit of an odd number is 1." },
        { type: "write", prompt: "Write <code>is_power_of_two(n)</code> for positive ints using the trick that such a number has <b>exactly one 1 bit</b>.", start: "", solution: "def is_power_of_two(n):\n    return n > 0 and n & (n - 1) == 0", tests: [["is_power_of_two(8)", "True"], ["is_power_of_two(12)", "False"], ["is_power_of_two(1)", "True"], ["is_power_of_two(0)", "False"]], why: "n & (n - 1) removes the lowest 1 bit. A power of two has only one." },
      ] },
    { id: "13.4", title: "Text, bytes and characters", bug: "Text is made of numbered characters. Bytes are raw numbers. Encoding connects them.",
      read: [
        "Every character has a number. <code>ord(\"A\")</code> is 65 and <code>chr(65)</code> is \"A\". That is how a Caesar cipher or sorting by letter works.",
        "<code>str</code> is text. <code>bytes</code> is raw data, like <code>b\"hi\"</code>. <code>\"é\".encode(\"utf-8\")</code> turns text to bytes (some characters need more than one byte) and <code>.decode()</code> goes back.",
        "<code>textwrap.wrap(text, 20)</code> breaks long text into lines of a given width. <code>textwrap.dedent</code> removes shared indentation.",
      ],
      try: { code: 'import textwrap\n\nprint(ord("a"), chr(100))\nb = "héllo".encode("utf-8")\nprint(b, len("héllo"), len(b))\nprint(b.decode("utf-8"))\nprint(list(b"AB"))\nprint(textwrap.wrap("the quick brown fox jumps", 10))', note: "What is chr(ord('a') + 1)?" },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "print(chr(ord('a') + 2))", why: "a is 97, plus 2 is 99, which is c." },
        { type: "predict", prompt: "What will this show?", code: "print(len('é'), len('é'.encode('utf-8')))", why: "One character, but two bytes in UTF-8." },
        { type: "write", prompt: "Write <code>shift(text, n)</code> that moves every <b>lowercase letter</b> forward by <code>n</code> places in the alphabet, wrapping from z to a. Other characters stay.", start: "", solution: "def shift(text, n):\n    out = ''\n    for ch in text:\n        if 'a' <= ch <= 'z':\n            out += chr((ord(ch) - ord('a') + n) % 26 + ord('a'))\n        else:\n            out += ch\n    return out", tests: [["shift('abc', 1)", "'bcd'"], ["shift('xyz', 3)", "'abc'"], ["shift('hi there!', 2)", "'jk vjgtg!'"]], why: "The % 26 wraps around the alphabet." },
        { type: "write", prompt: "Write <code>byte_size(text)</code> returning how many <b>bytes</b> the text takes in UTF-8.", start: "", solution: "def byte_size(text):\n    return len(text.encode('utf-8'))", tests: [["byte_size('abc')", "3"], ["byte_size('é')", "2"], ["byte_size('')", "0"]], must: /encode/, why: "Encode to bytes, then count them." },
      ] },
    { id: "13.5", title: "Odd types: frozenset, slice, reversed", bug: "A few small types that make code shorter once you know them.",
      read: [
        "A <b>frozenset</b> is a set that cannot change, so it can be a dict key or live inside another set. <code>set</code> operations like <code>&amp;</code> (both) and <code>-</code> (difference) work on it too.",
        "A <b>slice</b> object stores a range: <code>s = slice(1, 4)</code> then <code>items[s]</code>. Slices can also have a step: <code>items[::-1]</code> reverses.",
        "<code>reversed(x)</code> walks backwards without copying. <code>abs</code>, <code>min</code>, <code>max</code> and <code>sorted(..., reverse=True)</code> round off the everyday toolbox.",
      ],
      try: { code: 'fs = frozenset([1, 2, 3])\nd = {fs: "numbers"}\nprint(d[frozenset([3, 2, 1])])\n\nitems = [10, 20, 30, 40, 50]\nmiddle = slice(1, 4)\nprint(items[middle], items[::2], items[::-1])\nprint(list(reversed(items))[:2])\nprint({1, 2, 3} & {2, 3, 4}, {1, 2, 3} - {2})', note: "Can a normal set be a dict key? Try it." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "print([1, 2, 3, 4, 5][1::2])", why: "Start at index 1, then every second item." },
        { type: "predict", prompt: "What will this show?", code: "print(sorted({3, 1, 2} - {1}))", why: "Take away 1 from the set, then sort what is left." },
        { type: "write", prompt: "Write <code>is_palindrome(s)</code> that ignores case and returns <b>True</b> when the text reads the same backwards.", start: "", solution: "def is_palindrome(s):\n    s = s.lower()\n    return s == s[::-1]", tests: [["is_palindrome('Level')", "True"], ["is_palindrome('abc')", "False"], ["is_palindrome('')", "True"]], why: "[::-1] reverses a string." },
        { type: "write", prompt: "Write <code>same_group(a, b)</code> that returns <b>True</b> if two lists hold the same items ignoring order and repeats. Use <code>frozenset</code>.", start: "", solution: "def same_group(a, b):\n    return frozenset(a) == frozenset(b)", tests: [["same_group([1, 2, 2], [2, 1])", "True"], ["same_group([1], [1, 2])", "False"]], must: /frozenset/, why: "Sets ignore order and repeats." },
      ] },
    { id: "13.6", title: "Under the hood project", bug: "Use what you know about objects, bits and copies to solve three small puzzles.",
      read: [
        "Three problems that need you to <b>think about how Python works</b>, not only what it prints.",
      ],
      try: { code: 'def history(f):\n    calls = []\n    def wrapper(*args):\n        calls.append(args)\n        return f(*args)\n    wrapper.calls = calls\n    return wrapper\n\n@history\ndef add(a, b):\n    return a + b\n\nadd(1, 2); add(3, 4)\nprint(add.calls)', note: "Functions are objects, so they can carry attributes like .calls." },
      ex: [
        { type: "write", prompt: "Write <code>count_bits(n)</code> that returns how many <b>1 bits</b> a non-negative int has. Do <b>not</b> use <code>bin</code> or <code>bit_count</code>; use bit operations.", start: "", solution: "def count_bits(n):\n    c = 0\n    while n:\n        c += n & 1\n        n >>= 1\n    return c", tests: [["count_bits(0)", "0"], ["count_bits(7)", "3"], ["count_bits(1024)", "1"], ["count_bits(255)", "8"]], must: /&/, why: "Check the lowest bit, shift right, repeat." },
        { type: "write", prompt: "Write <code>once(f)</code>, a decorator: the first call runs <code>f</code> and remembers the result. <b>Later calls return the same result</b> without running f again.", start: "", solution: "def once(f):\n    done = False\n    result = None\n    def wrapper(*args):\n        nonlocal done, result\n        if not done:\n            result = f(*args)\n            done = True\n        return result\n    return wrapper", tests: [["calls = []\n@once\ndef f(x):\n    calls.append(x)\n    return x * 2\nf(4); f(9)", "(f(1), calls)", "(8, [4])"]], must: /nonlocal/, why: "nonlocal lets the wrapper remember across calls." },
        { type: "write", prompt: "Write <code>flatten(items)</code> that turns a nested list of any depth into a flat list, keeping order. <code>[1, [2, [3]], 4]</code> gives <b>[1, 2, 3, 4]</b>.", start: "", solution: "def flatten(items):\n    out = []\n    for x in items:\n        if isinstance(x, list):\n            out.extend(flatten(x))\n        else:\n            out.append(x)\n    return out", tests: [["flatten([1, [2, [3]], 4])", "[1, 2, 3, 4]"], ["flatten([])", "[]"], ["flatten([[[]], 1])", "[1]"]], must: /isinstance/, why: "A nested list is handled by calling flatten on it." },
      ] },
  ] });
})(typeof window !== "undefined" ? window : globalThis);
