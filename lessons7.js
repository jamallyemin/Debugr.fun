// Chapter 10: Pythonic Python (comprehensions, lambda, *args, generators, decorators, modern bits, final project).
(function (root) {
  "use strict";
  const L = typeof module !== "undefined" && module.exports ? require("./lessons.js") : root.Lessons;

  L.add({ id: 10, name: "Pythonic Python", sub: "comprehensions, lambda, generators, decorators", lessons: [
    { id: "10.1", title: "Comprehensions", bug: "A comprehension builds a whole list in one line: [what for item in things if condition].",
      read: [
        "A <b>list comprehension</b> builds a list in one line. <code>[n * 2 for n in range(4)]</code> means: for every n in range(4), take n * 2. It is a loop and an append in one.",
        "Add a filter at the end: <code>[n for n in range(10) if n % 2 == 0]</code> keeps only the even numbers.",
        "The same idea works for dictionaries <code>{n: n * n for n in range(4)}</code> and sets <code>{c.lower() for c in text}</code>. Keep them short: when it gets hard to read, use a normal loop.",
      ],
      try: { code: 'print([n * 2 for n in range(4)])\nprint([n for n in range(10) if n % 2 == 0])\nprint({n: n * n for n in range(4)})\nwords = ["Hi", "there"]\nprint([w.upper() for w in words])', note: "Make a list of the lengths of the words." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "print([n * n for n in range(4)])", why: "The squares of 0, 1, 2 and 3." },
        { type: "predict", prompt: "What will this show?", code: "print([n for n in range(10) if n % 3 == 0])", why: "Only the numbers that divide by 3 are kept: 0, 3, 6, 9." },
        { type: "fill", prompt: "Fill the blank so it shows the <b>dictionary</b> <code>{1: 1, 2: 4, 3: 9}</code>.", code: "print({n: ___ for n in range(1, 4)})", answer: "n * n", expect: "{1: 1, 2: 4, 3: 9}", why: "Each value is n times n." },
        { type: "write", prompt: "Write <code>evens(nums)</code> that returns a new list with only the even numbers, in a <b>list comprehension</b>.", start: "", solution: "def evens(nums):\n    return [n for n in nums if n % 2 == 0]", tests: [["evens([1, 2, 3, 4])", "[2, 4]"], ["evens([])", "[]"], ["evens([7])", "[]"]], must: /\[[^\]]*\bfor\b[^\]]*\bin\b/, why: "[n for n in nums if n % 2 == 0]." },
      ] },
    { id: "10.2", title: "lambda, map, filter, sort keys", bug: "lambda is a tiny function without a name. Perfect for 'sort by this' in one line.",
      read: [
        "A <b>lambda</b> is a one-line function without a name: <code>lambda x: x * 2</code>. It is the same as <code>def f(x): return x * 2</code>. Use it for tiny throw-away functions.",
        "Functions are values too, so you can pass them around. <code>sorted(words, key=len)</code> sorts by length. <code>max(items, key=...)</code> uses the same idea. <code>map(f, items)</code> applies f to each item, and <code>filter(f, items)</code> keeps the ones where f is True. Wrap them in <code>list(...)</code> to see the result.",
        "A comprehension is usually easier to read than map and filter, but you will meet both in other people's code.",
      ],
      try: { code: 'double = lambda x: x * 2\nprint(double(4))\nwords = ["pear", "fig", "banana"]\nprint(sorted(words, key=len))\nprint(list(map(lambda w: w.upper(), words)))\nprint(list(filter(lambda w: len(w) > 3, words)))\npairs = [("a", 3), ("b", 1), ("c", 2)]\nprint(sorted(pairs, key=lambda p: p[1]))', note: "Sort the words by their last letter." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "f = lambda a, b: a + b\nprint(f(2, 3))", why: "A lambda is a function, so f(2, 3) is 5." },
        { type: "predict", prompt: "What will this show?", code: 'print(sorted(["ccc", "a", "bb"], key=len))', why: "Sorted by length: a (1), bb (2), ccc (3)." },
        { type: "predict", prompt: "What will this show?", code: "print(list(filter(lambda n: n > 2, [1, 2, 3, 4])))", why: "filter keeps the items where the lambda gives True: 3 and 4." },
        { type: "write", prompt: "Write <code>by_score(pairs)</code> that sorts a list of (name, score) pairs from the <b>highest</b> score to the lowest, using <code>sorted</code> with a lambda key.", start: "", solution: "def by_score(pairs):\n    return sorted(pairs, key=lambda p: p[1], reverse=True)", tests: [["by_score([('a', 3), ('b', 9), ('c', 5)])", "[('b', 9), ('c', 5), ('a', 3)]"], ["by_score([])", "[]"]], must: /lambda/, why: "sorted(pairs, key=lambda p: p[1], reverse=True)." },
      ] },
    { id: "10.3", title: "*args and **kwargs", bug: "*args collects extra arguments into a tuple. **kwargs collects extra named ones into a dict.",
      read: [
        "A parameter with a star, <code>*nums</code>, collects <b>any number of arguments</b> into a tuple: <code>def total(*nums): return sum(nums)</code> works for <code>total(1, 2)</code> and for <code>total(1, 2, 3, 4)</code>. By tradition it is called <code>*args</code>.",
        "A parameter with two stars, <code>**info</code>, collects extra <b>named</b> arguments into a dictionary: <code>show(name=\"Ada\", age=36)</code> gives <code>info == {'name': 'Ada', 'age': 36}</code>. By tradition it is called <code>**kwargs</code>.",
        "Stars work the other way when calling: <code>total(*[1, 2, 3])</code> spreads a list into separate arguments, and <code>f(**d)</code> spreads a dictionary into named arguments.",
      ],
      try: { code: 'def total(*nums):\n    return sum(nums)\n\nprint(total(1, 2), total(1, 2, 3, 4))\n\ndef show(**info):\n    for key, value in info.items():\n        print(key, "=", value)\n\nshow(name="Ada", age=36)\nnumbers = [5, 6]\nprint(total(*numbers))', note: "Print type(nums) inside total." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "def count(*args):\n    return len(args)\n\nprint(count(7, 8, 9))", why: "The three arguments are collected into one tuple of length 3." },
        { type: "predict", prompt: "What will this show?", code: "def add(a, b):\n    return a + b\n\nprint(add(*[2, 3]))", why: "The star spreads the list into the two arguments a and b." },
        { type: "write", prompt: "Write <code>biggest(*nums)</code> that returns the biggest of all the numbers given.", start: "", solution: "def biggest(*nums):\n    return max(nums)", tests: [["biggest(3, 9, 4)", "9"], ["biggest(5)", "5"]], must: /\*nums/, why: "nums is a tuple of all the arguments, and max works on it." },
        { type: "write", prompt: "Write <code>describe(**kwargs)</code> that returns the pairs as text like <b>name=Ada, age=36</b>.", start: "", solution: "def describe(**kwargs):\n    return ', '.join(f'{k}={v}' for k, v in kwargs.items())", tests: [["describe(name='Ada', age=36)", "'name=Ada, age=36'"], ["describe()", "''"]], must: /\*\*kwargs/, why: "Loop over kwargs.items() and join the pieces with a comma and space." },
      ] },
    { id: "10.4", title: "Generators", bug: "yield hands out one value at a time and remembers where it stopped. It never builds the whole list.",
      read: [
        "A <b>generator</b> makes values <b>one at a time</b>, only when asked. Write it like a function but use <code>yield</code> instead of <code>return</code>. After a yield the function <b>pauses</b> and remembers where it was.",
        "Loop over it with <code>for</code>, turn it into a list with <code>list(gen)</code>, or get the next value yourself with <code>next(gen)</code>. When it runs out, <code>for</code> simply stops.",
        "Generators can even be endless, since they never build the whole list. <b>Generator expressions</b> look like comprehensions in round brackets: <code>sum(n * n for n in range(1000))</code> uses no list at all.",
      ],
      try: { code: 'def countdown(n):\n    while n > 0:\n        yield n\n        n -= 1\n\nfor x in countdown(3):\n    print(x)\n\ng = countdown(2)\nprint(next(g), next(g))\nprint(sum(n * n for n in range(5)))', note: "Call next(g) a third time. What happens?" },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "def gen():\n    yield 1\n    yield 2\n\nprint(list(gen()))", why: "Each yield hands out one value, and list collects them." },
        { type: "predict", prompt: "What will this show?", code: "print(sum(n for n in range(5)))", why: "0 + 1 + 2 + 3 + 4 = 10." },
        { type: "fix", prompt: "<code>evens</code> stops at the first value. Make it hand out <b>all</b> the even numbers below the limit, one at a time.", code: "def evens(limit):\n    for i in range(limit):\n        if i % 2 == 0:\n            return i", solution: "def evens(limit):\n    for i in range(limit):\n        if i % 2 == 0:\n            yield i", tests: [["list(evens(7))", "[0, 2, 4, 6]"], ["list(evens(1))", "[0]"]], why: "return ends the function at the first match. yield hands out a value and carries on." },
        { type: "write", prompt: "Write a generator <code>squares(n)</code> that yields the squares 1, 4, 9, ... of the numbers 1 to n.", start: "", solution: "def squares(n):\n    for i in range(1, n + 1):\n        yield i * i", tests: [["list(squares(4))", "[1, 4, 9, 16]"], ["list(squares(0))", "[]"]], must: /yield/, why: "Loop from 1 to n and yield i * i." },
      ] },
    { id: "10.5", title: "Closures and decorators", bug: "Functions are values: you can return one, and a function can wrap another function to add behaviour.",
      read: [
        "Because functions are values, a function can <b>create and return another function</b>. The inner function <b>remembers</b> the variables around it. That is called a <b>closure</b>: <code>make_adder(3)</code> returns a function that always adds 3.",
        "A <b>decorator</b> is a function that takes a function and returns an improved version of it. You apply it with <code>@name</code> above the <code>def</code>: <code>@shout</code> is a short form of <code>hi = shout(hi)</code>.",
        "Decorators add things like logging, timing or checks without changing the function's own code. The inner <b>wrapper</b> usually accepts <code>*args, **kwargs</code> so that it works for any function.",
      ],
      try: { code: 'def make_adder(n):\n    def add(x):\n        return x + n\n    return add\n\nadd3 = make_adder(3)\nprint(add3(4))\n\ndef shout(func):\n    def wrapper(*args, **kwargs):\n        return func(*args, **kwargs).upper()\n    return wrapper\n\n@shout\ndef hello(name):\n    return "hello " + name\n\nprint(hello("ada"))', note: "Make a decorator that adds an exclamation mark." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "def make_mul(n):\n    def mul(x):\n        return x * n\n    return mul\n\ndouble = make_mul(2)\nprint(double(21))", why: "double remembers n = 2, so double(21) is 42." },
        { type: "predict", prompt: "What will this show?", code: "def twice(f):\n    def wrapper():\n        f()\n        f()\n    return wrapper\n\n@twice\ndef hi():\n    print('hi')\n\nhi()", why: "The decorator replaced hi with the wrapper, which calls the original function two times." },
        { type: "write", prompt: "Write <code>make_adder(n)</code> that returns a function which adds n to its argument.", start: "", solution: "def make_adder(n):\n    def add(x):\n        return x + n\n    return add", tests: [["make_adder(3)(4)", "7"], ["make_adder(0)(9)", "9"]], why: "Define add inside and return it, without brackets." },
        { type: "write", prompt: "Write a decorator <code>shout</code> that makes the <b>text a function returns</b> uppercase.", start: "", solution: "def shout(func):\n    def wrapper(*args, **kwargs):\n        return func(*args, **kwargs).upper()\n    return wrapper", tests: [["@shout\ndef hi():\n    return 'hello'", "hi()", "'HELLO'"], ["@shout\ndef greet(name):\n    return 'hi ' + name", "greet('ada')", "'HI ADA'"]], why: "The wrapper calls the original with the same arguments and uppercases the result." },
      ] },
    { id: "10.6", title: "Modern Python bits", bug: "Python keeps getting nicer. These small features make everyday code shorter and clearer.",
      read: [
        "<code>match</code> compares a value with patterns, like a neat chain of ifs: <code>match cmd:</code> then <code>case \"go\":</code> ... <code>case _:</code> (the underscore means anything else).",
        "The walrus <code>:=</code> assigns inside an expression: <code>if (n := len(items)) &gt; 3:</code> uses n afterwards. <code>any(...)</code> and <code>all(...)</code> ask whether some or all items are True. In lists, <code>[*a, *b]</code> merges two lists and <code>d1 | d2</code> merges dictionaries.",
        "<b>Type hints</b> describe what a function expects, <code>def add(a: int, b: int) -&gt; int:</code>. Python ignores them when it runs, but humans and tools love them. In f-strings <code>f\"{x = }\"</code> shows the name and the value, which is great for debugging.",
      ],
      try: { code: 'def move(cmd):\n    match cmd:\n        case "up":\n            return "going up"\n        case "down":\n            return "going down"\n        case _:\n            return "unknown"\n\nprint(move("up"), move("x"))\nprint(any(n > 3 for n in [1, 5]), all(n > 3 for n in [1, 5]))\na, b = [1, 2], [3]\nprint([*a, *b])\nx = 5\nprint(f"{x = }")', note: "Try the walrus: print((n := 10) * 2, n)." },
      ex: [
        { type: "predict", prompt: "What will this show?", code: "print(all([True, False]), any([True, False]))", why: "all needs every item to be True (not the case). any needs just one (it is the case)." },
        { type: "predict", prompt: "What will this show?", code: "print([*[1, 2], *[3]])", why: "The stars unpack both lists into one new list." },
        { type: "write", prompt: "Write <code>size(n)</code> with a <code>match</code>: it returns <b>'zero'</b> for 0, <b>'one'</b> for 1 and <b>'many'</b> for anything else.", start: "", solution: "def size(n):\n    match n:\n        case 0:\n            return 'zero'\n        case 1:\n            return 'one'\n        case _:\n            return 'many'", tests: [["size(0)", "'zero'"], ["size(1)", "'one'"], ["size(7)", "'many'"]], must: /\bmatch\b/, why: "case 0, case 1, and case _ for the rest." },
        { type: "write", prompt: "Write <code>has_negative(nums)</code> that returns True if <b>any</b> number is below 0, using <code>any</code>. Add type hints: <code>nums: list</code> and <code>-&gt; bool</code>.", start: "", solution: "def has_negative(nums: list) -> bool:\n    return any(n < 0 for n in nums)", tests: [["has_negative([1, -2, 3])", "True"], ["has_negative([1, 2])", "False"], ["has_negative([])", "False"]], must: /any\s*\(/, why: "any(n < 0 for n in nums)." },
      ] },
    { id: "10.7", title: "Final project", bug: "You know the whole language now. Break each problem down, name the pieces, test the awkward cases.",
      read: [
        "The last chapter ends with three bigger exercises that use ideas from many chapters: functions, collections, comprehensions, classes and generators. Take your time. There is no timer here.",
      ],
      try: { code: 'from collections import Counter\n\ndef word_freq(text, n):\n    counts = Counter(text.lower().split())\n    return sorted(counts.items(), key=lambda p: (-p[1], p[0]))[:n]\n\nprint(word_freq("the cat and the hat and the bat", 2))', note: "This is a model of the kind of function you will write below." },
      ex: [
        { type: "write", prompt: "Write <code>first_primes(n)</code> that returns a list of the first n prime numbers (2, 3, 5, 7, ...).", start: "", solution: "def first_primes(n):\n    primes = []\n    candidate = 2\n    while len(primes) < n:\n        if all(candidate % p != 0 for p in primes):\n            primes.append(candidate)\n        candidate += 1\n    return primes", tests: [["first_primes(5)", "[2, 3, 5, 7, 11]"], ["first_primes(1)", "[2]"], ["first_primes(0)", "[]"]], why: "A number is prime if no earlier prime divides it. Keep counting up until you have n primes." },
        { type: "write", prompt: "Write <code>top_words(text, n)</code> that returns the n most common words (lower case) as (word, count) pairs, most common first. If two words have the same count, put the one that comes first in the alphabet first.", start: "", solution: "from collections import Counter\n\ndef top_words(text, n):\n    counts = Counter(text.lower().split())\n    return sorted(counts.items(), key=lambda p: (-p[1], p[0]))[:n]", tests: [["top_words('the cat and the hat and the bat', 2)", "[('the', 3), ('and', 2)]"], ["top_words('b a B A c', 2)", "[('a', 2), ('b', 2)]"], ["top_words('', 3)", "[]"]], why: "Count with Counter, then sort by (-count, word). The minus puts the big counts first while ties are ordered by the word." },
        { type: "write", prompt: "Write a class <code>Inventory</code> with <code>add(item, qty)</code> (adds to the count of an item), <code>remove(item, qty)</code> (raises <code>ValueError</code> if there is not enough) and <code>count(item)</code> (0 for unknown items).", start: "", solution: "class Inventory:\n    def __init__(self):\n        self.items = {}\n\n    def add(self, item, qty):\n        self.items[item] = self.items.get(item, 0) + qty\n\n    def remove(self, item, qty):\n        if self.items.get(item, 0) < qty:\n            raise ValueError('not enough')\n        self.items[item] -= qty\n\n    def count(self, item):\n        return self.items.get(item, 0)", tests: [["i = Inventory(); i.add('apple', 3); i.add('apple', 2)", "i.count('apple')", "5"], ["Inventory().count('pear')", "0"], ["i = Inventory(); i.add('a', 1); i.remove('a', 1)", "i.count('a')", "0"], ["i = Inventory(); i.add('a', 1); i.remove('a', 2)", "i.count('a')", "error: ValueError: not enough"]], must: /class\s+Inventory/, why: "A dictionary in the object keeps the counts. remove checks before it subtracts." },
      ] },
  ] });
})(typeof window !== "undefined" ? window : globalThis);
